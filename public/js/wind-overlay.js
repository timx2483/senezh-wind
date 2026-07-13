import { windColor, degToCompass } from './wind-utils.js';

const WIND_MOTION_SCALE = 14;
const MIN_PARTICLES = 100;
const PX_PER_PARTICLE = 5500;

export class WindOverlay {
  constructor(map, canvas) {
    this.map = map;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gridPoints = [];
    this.particles = [];
    this.running = false;
    this.lastTime = 0;
    this.rafId = null;

    this._onMapChange = () => {
      this.resize();
      this.topUpParticles();
    };

    map.events.add('boundschange', this._onMapChange);
    map.events.add('sizechange', this._onMapChange);
    this.resize();
    this.start();
  }

  setWindField(field) {
    this.gridPoints = (field?.points ?? []).filter(
      (p) => p.speed != null && p.dir != null
    );
    this.particles = [];
    this.topUpParticles(true);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(loop);
      const dt = Math.min((t - this.lastTime) / 1000, 0.05);
      this.lastTime = t;
      this.tick(dt);
      this.draw();
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  resize() {
    const size = this.map.container.getSize();
    const w = size[0];
    const h = size[1];
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, w * dpr);
    this.canvas.height = Math.max(1, h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
  }

  getBounds() {
    const bounds = this.map.getBounds();
    if (!bounds?.length) return null;
    const [sw, ne] = bounds;
    return {
      south: Math.min(sw[0], ne[0]),
      north: Math.max(sw[0], ne[0]),
      west: Math.min(sw[1], ne[1]),
      east: Math.max(sw[1], ne[1]),
    };
  }

  targetCount() {
    const area = (this.w || 400) * (this.h || 300);
    return Math.max(MIN_PARTICLES, Math.floor(area / PX_PER_PARTICLE));
  }

  randomInBounds(b) {
    return {
      lat: b.south + Math.random() * (b.north - b.south),
      lon: b.west + Math.random() * (b.east - b.west),
    };
  }

  topUpParticles(force = false) {
    const b = this.getBounds();
    if (!b) return;
    const target = this.targetCount();
    if (force) this.particles = [];
    while (this.particles.length < target) {
      const pos = this.randomInBounds(b);
      this.particles.push({ lat: pos.lat, lon: pos.lon });
    }
    if (this.particles.length > target * 1.5) {
      this.particles.length = target;
    }
  }

  geoToPage(lat, lon) {
    try {
      if (this.map.converter?.coordinatesToPage) {
        return this.map.converter.coordinatesToPage([lat, lon]);
      }
    } catch {
      return null;
    }
    return null;
  }

  sampleWind(lat, lon) {
    if (!this.gridPoints.length) return { speed: 0, dir: 0 };

    let best = null;
    let bestD = Infinity;
    const nearby = [];

    for (const p of this.gridPoints) {
      const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
      nearby.push({ ...p, d });
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }

    if (bestD < 1e-8) return { speed: best.speed, dir: best.dir };

    nearby.sort((a, b) => a.d - b.d);
    const k = nearby.slice(0, 6);
    let ws = 0;
    let sinSum = 0;
    let cosSum = 0;
    let wt = 0;

    for (const p of k) {
      const w = 1 / (p.d + 1e-6);
      ws += p.speed * w;
      const rad = (p.dir * Math.PI) / 180;
      sinSum += Math.sin(rad) * w;
      cosSum += Math.cos(rad) * w;
      wt += w;
    }

    const dir = ((Math.atan2(sinSum / wt, cosSum / wt) * 180) / Math.PI + 360) % 360;
    return { speed: ws / wt, dir };
  }

  moveParticle(p, speed, fromDir, dt) {
    const blowRad = (((fromDir ?? 0) + 180) % 360) * (Math.PI / 180);
    const meters = speed * dt * WIND_MOTION_SCALE;
    const latRad = (p.lat * Math.PI) / 180;
    p.lat += (meters * Math.cos(blowRad)) / 111320;
    p.lon += (meters * Math.sin(blowRad)) / (111320 * Math.cos(latRad));
  }

  tick(dt) {
    if (!this.gridPoints.length) return;
    const b = this.getBounds();
    if (!b) return;

    const pad = 0.01;
    for (const p of this.particles) {
      const wind = this.sampleWind(p.lat, p.lon);
      this.moveParticle(p, wind.speed, wind.dir, dt);

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
    const len = 3 + Math.min(speed ?? 0, 14) * 0.35;
    const color = windColor(speed);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(blow - Math.PI / 2);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(len * 0.38, len * 0.55);
    ctx.lineTo(0, len * 0.15);
    ctx.lineTo(-len * 0.38, len * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.w || this.canvas.width;
    const h = this.h || this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!this.gridPoints.length) return;

    const margin = 20;
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
    this.stop();
    this.map.events.remove('boundschange', this._onMapChange);
    this.map.events.remove('sizechange', this._onMapChange);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

export function windBlowsToCompass(fromDeg) {
  if (fromDeg == null) return '—';
  return degToCompass((fromDeg + 180) % 360);
}
