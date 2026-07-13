import { windColor, degToCompass } from './wind-utils.js';

const WIND_MOTION_SCALE = 0.12;
const MIN_PARTICLES = 120;
const PX_PER_PARTICLE = 4500;

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

    if (this.particles.length) {
      for (const p of this.particles) {
        p.x = Math.min(p.x, w);
        p.y = Math.min(p.y, h);
      }
    }
  }

  targetCount() {
    return Math.max(MIN_PARTICLES, Math.floor((this.w * this.h) / PX_PER_PARTICLE));
  }

  topUpParticles(force = false) {
    const w = this.w || 300;
    const h = this.h || 200;
    const target = this.targetCount();
    if (force) this.particles = [];
    while (this.particles.length < target) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
      });
    }
  }

  pageToGeo(x, y) {
    try {
      if (this.map.converter?.pageToCoordinates) {
        const c = this.map.converter.pageToCoordinates([x, y]);
        if (c && Number.isFinite(c[0])) return c;
      }
    } catch {
      // fallback
    }

    try {
      const zoom = this.map.getZoom();
      const projection = this.map.options.get('projection');
      const center = this.map.getGlobalPixelCenter();
      const size = this.map.container.getSize();
      const globalX = center[0] - size[0] / 2 + x;
      const globalY = center[1] - size[1] / 2 + y;
      return projection.fromGlobalPixels([globalX, globalY], zoom);
    } catch {
      return null;
    }
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

  moveScreen(p, wind, dt) {
    const zoom = this.map.getZoom();
    const blowRad = (((wind.dir ?? 0) + 180) % 360) * (Math.PI / 180);
    const px = wind.speed * dt * WIND_MOTION_SCALE * 1000 * (zoom / 11);
    p.x += Math.sin(blowRad) * px;
    p.y -= Math.cos(blowRad) * px;
  }

  tick(dt) {
    const w = this.w;
    const h = this.h;
    const pad = 4;

    for (const p of this.particles) {
      const geo = this.pageToGeo(p.x, p.y);
      const wind = geo ? this.sampleWind(geo[0], geo[1]) : { speed: 3, dir: 0 };
      this.moveScreen(p, wind, dt);

      if (p.x < -pad) p.x = w + pad;
      if (p.x > w + pad) p.x = -pad;
      if (p.y < -pad) p.y = h + pad;
      if (p.y > h + pad) p.y = -pad;
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

    for (const p of this.particles) {
      const geo = this.pageToGeo(p.x, p.y);
      const wind = geo ? this.sampleWind(geo[0], geo[1]) : { speed: 3, dir: 0 };
      this.drawArrow(p.x, p.y, wind.dir, wind.speed);
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
