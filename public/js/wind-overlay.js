import { windColor, degToCompass } from './wind-utils.js';

const MIN_PARTICLES = 120;
const PX_PER_PARTICLE = 4500;
const METERS_PER_DEG_LAT = 111320;

const FALLBACK_BOUNDS = {
  south: 56.13,
  north: 56.26,
  west: 36.9,
  east: 37.08,
};

export class WindOverlay {
  constructor(map, canvas) {
    this.map = map;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gridPoints = [];
    this.particles = [];

    Object.assign(this.canvas.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '1000',
    });

    this._onMapChange = () => {
      this.resize();
      this.topUpParticles();
    };

    map.events.add('boundschange', this._onMapChange);
    map.events.add('sizechange', this._onMapChange);
    map.events.add('actionend', this._onMapChange);

    this.resize();
    this._running = true;
    this._lastTime = performance.now();
    this._loop = (t) => {
      if (!this._running) return;
      requestAnimationFrame(this._loop);
      const dt = Math.min((t - this._lastTime) / 1000, 0.05);
      this._lastTime = t;
      if (this.gridPoints.length) {
        this.tick(dt);
        this.draw();
      }
    };
    requestAnimationFrame(this._loop);
  }

  setWindField(field) {
    this.gridPoints = (field?.points ?? []).filter(
      (p) => p.speed != null && p.dir != null
    );
    this.particles = [];
    this.topUpParticles(true);
    this.resize();
  }

  resize() {
    const size = this.map.container.getSize();
    const w = Math.max(size[0] || 0, 100);
    const h = Math.max(size[1] || 0, 100);
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.max(1, Math.floor(w * dpr));
    this.canvas.height = Math.max(1, Math.floor(h * dpr));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.style.display = 'block';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
  }

  getBounds() {
    try {
      const bounds = this.map.getBounds();
      if (!bounds?.length) return { ...FALLBACK_BOUNDS };
      const [sw, ne] = bounds;
      return {
        south: Math.min(sw[0], ne[0]),
        north: Math.max(sw[0], ne[0]),
        west: Math.min(sw[1], ne[1]),
        east: Math.max(sw[1], ne[1]),
      };
    } catch {
      return { ...FALLBACK_BOUNDS };
    }
  }

  targetCount() {
    return Math.max(MIN_PARTICLES, Math.floor((this.w * this.h) / PX_PER_PARTICLE));
  }

  randomInBounds(b) {
    return {
      lat: b.south + Math.random() * (b.north - b.south),
      lon: b.west + Math.random() * (b.east - b.west),
    };
  }

  topUpParticles(force = false) {
    const b = this.getBounds();
    const target = this.targetCount();
    if (force) this.particles = [];
    while (this.particles.length < target) {
      const pos = this.randomInBounds(b);
      this.particles.push({ lat: pos.lat, lon: pos.lon });
    }
    if (this.particles.length > target * 1.4) {
      this.particles.length = target;
    }
  }

  geoToPage(lat, lon) {
    try {
      if (this.map.converter?.coordinatesToPage) {
        const p = this.map.converter.coordinatesToPage([lat, lon]);
        if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) return p;
      }
    } catch {
      // fallback
    }

    try {
      const zoom = this.map.getZoom();
      const projection = this.map.options.get('projection');
      const global = projection.toGlobalPixels([lat, lon], zoom);
      const center = this.map.getGlobalPixelCenter();
      const size = this.map.container.getSize();
      return [
        global[0] - center[0] + size[0] / 2,
        global[1] - center[1] + size[1] / 2,
      ];
    } catch {
      return null;
    }
  }

  /** Смещение в метрах по реальной скорости ветра (м/с) */
  advancePosition(lat, lon, speed, fromDir, dt) {
    const blowRad = (((fromDir ?? 0) + 180) % 360) * (Math.PI / 180);
    const meters = speed * dt;
    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.max(Math.cos(latRad), 0.01);

    return {
      lat: lat + (meters * Math.cos(blowRad)) / METERS_PER_DEG_LAT,
      lon: lon + (meters * Math.sin(blowRad)) / (METERS_PER_DEG_LAT * cosLat),
    };
  }

  sampleWind(lat, lon) {
    if (!this.gridPoints.length) return { speed: 0, dir: 0 };

    const nearby = this.gridPoints
      .map((p) => ({ ...p, d: (p.lat - lat) ** 2 + (p.lon - lon) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);

    if (nearby[0].d < 1e-8) {
      return { speed: nearby[0].speed, dir: nearby[0].dir };
    }

    let ws = 0;
    let sinSum = 0;
    let cosSum = 0;
    let wt = 0;

    for (const p of nearby) {
      const w = 1 / (p.d + 1e-6);
      ws += p.speed * w;
      const rad = (p.dir * Math.PI) / 180;
      sinSum += Math.sin(rad) * w;
      cosSum += Math.cos(rad) * w;
      wt += w;
    }

    return {
      speed: ws / wt,
      dir: ((Math.atan2(sinSum / wt, cosSum / wt) * 180) / Math.PI + 360) % 360,
    };
  }

  tick(dt) {
    const b = this.getBounds();
    const pad = 0.008;

    for (const p of this.particles) {
      const wind = this.sampleWind(p.lat, p.lon);
      const next = this.advancePosition(p.lat, p.lon, wind.speed, wind.dir, dt);
      p.lat = next.lat;
      p.lon = next.lon;

      if (
        p.lat < b.south - pad ||
        p.lat > b.north + pad ||
        p.lon < b.west - pad ||
        p.lon > b.east + pad
      ) {
        const pos = this.randomInBounds(b);
        p.lat = pos.lat;
        p.lon = pos.lon;
      }
    }
  }

  drawArrow(x, y, fromDir, speed) {
    const ctx = this.ctx;
    const blow = (((fromDir ?? 0) + 180) % 360) * (Math.PI / 180);
    const len = 7 + Math.min(speed ?? 0, 14) * 0.55;
    const color = windColor(speed);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(blow - Math.PI / 2);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(len * 0.4, len * 0.55);
    ctx.lineTo(0, len * 0.2);
    ctx.lineTo(-len * 0.4, len * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.w || 1;
    const h = this.h || 1;
    ctx.clearRect(0, 0, w, h);

    if (!this.particles.length) {
      this.topUpParticles();
    }

    const margin = 24;
    for (const p of this.particles) {
      const pos = this.geoToPage(p.lat, p.lon);
      if (!pos) continue;
      const [x, y] = pos;
      if (x < -margin || x > w + margin || y < -margin || y > h + margin) continue;

      const wind = this.sampleWind(p.lat, p.lon);
      this.drawArrow(x, y, wind.dir, wind.speed);
    }
  }

  destroy() {
    this._running = false;
    this.map.events.remove('boundschange', this._onMapChange);
    this.map.events.remove('sizechange', this._onMapChange);
    this.map.events.remove('actionend', this._onMapChange);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

export function windBlowsToCompass(fromDeg) {
  if (fromDeg == null) return '—';
  return degToCompass((fromDeg + 180) % 360);
}
