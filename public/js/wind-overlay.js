import { windColor, degToCompass } from './wind-utils.js';

export class WindOverlay {
  constructor(map, layerEl) {
    this.map = map;
    this.layer = layerEl;
    this.points = [];
    this.mode = 'fact';
    this._onMapChange = () => this.render();
    map.events.add('boundschange', this._onMapChange);
    map.events.add('sizechange', this._onMapChange);
  }

  setWindField(field) {
    this.points = field?.points ?? [];
    this.mode = field?.mode ?? 'fact';
    this.render();
  }

  blowBearing(fromDeg) {
    return ((fromDeg ?? 0) + 180) % 360;
  }

  animDuration(speed) {
    if (speed == null) return 2.4;
    return Math.max(0.55, 2.6 - speed * 0.2);
  }

  getMapBounds() {
    const bounds = this.map.getBounds();
    if (!bounds || bounds.length < 2) return null;
    const [sw, ne] = bounds;
    return {
      south: Math.min(sw[0], ne[0]),
      north: Math.max(sw[0], ne[0]),
      west: Math.min(sw[1], ne[1]),
      east: Math.max(sw[1], ne[1]),
    };
  }

  getVisiblePoints() {
    const withSpeed = this.points.filter((p) => p.speed != null && p.dir != null);
    if (!withSpeed.length) return [];

    const b = this.getMapBounds();
    let visible = withSpeed;
    if (b) {
      const pad = 0.02;
      visible = withSpeed.filter(
        (p) =>
          p.lat >= b.south - pad &&
          p.lat <= b.north + pad &&
          p.lon >= b.west - pad &&
          p.lon <= b.east + pad
      );
    }

    if (!visible.length) visible = withSpeed;

    const zoom = this.map.getZoom();
    const maxArrows = zoom >= 14 ? 150 : zoom >= 12 ? 100 : 60;
    if (visible.length <= maxArrows) return visible;

    const step = Math.ceil(visible.length / maxArrows);
    return visible.filter((_, i) => i % step === 0);
  }

  arrowHtml(point) {
    const bearing = this.blowBearing(point.dir);
    const color = windColor(point.speed);
    const duration = this.animDuration(point.speed);
    const stationClass = point.isStation ? ' wind-arrow-anim--station' : '';

    return `
      <div class="wind-arrow-anim${stationClass}"
           data-lat="${point.lat}" data-lon="${point.lon}"
           style="--bearing:${bearing}deg;--color:${color};--duration:${duration}s">
        <div class="wind-arrow-anim__body">
          <svg viewBox="0 0 32 56" aria-hidden="true">
            <line class="wind-arrow-anim__shaft" x1="16" y1="50" x2="16" y2="14"/>
            <polygon class="wind-arrow-anim__head" points="16,4 26,20 16,15 6,20"/>
            <circle class="wind-arrow-anim__dot wind-arrow-anim__dot--1" cx="16" cy="42" r="1.5"/>
            <circle class="wind-arrow-anim__dot wind-arrow-anim__dot--2" cx="16" cy="32" r="1.5"/>
            <circle class="wind-arrow-anim__dot wind-arrow-anim__dot--3" cx="16" cy="22" r="1.5"/>
          </svg>
        </div>
      </div>
    `;
  }

  render() {
    const visible = this.getVisiblePoints();
    if (!visible.length) {
      this.layer.innerHTML = '';
      return;
    }

    this.layer.innerHTML = visible.map((p) => this.arrowHtml(p)).join('');
    this.reposition();
  }

  coordToPixel(lat, lon) {
    if (this.map.converter?.coordinatesToPage) {
      return this.map.converter.coordinatesToPage([lat, lon]);
    }
    const zoom = this.map.getZoom();
    const projection = this.map.options.get('projection');
    const global = projection.toGlobalPixels([lat, lon], zoom);
    const mapCenter = this.map.getGlobalPixelCenter();
    const size = this.map.container.getSize();
    return [
      global[0] - mapCenter[0] + size[0] / 2,
      global[1] - mapCenter[1] + size[1] / 2,
    ];
  }

  reposition() {
    this.layer.querySelectorAll('.wind-arrow-anim').forEach((el) => {
      const lat = parseFloat(el.dataset.lat);
      const lon = parseFloat(el.dataset.lon);
      const [x, y] = this.coordToPixel(lat, lon);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.transform = `translate(-50%, -50%) rotate(var(--bearing))`;
    });
  }

  destroy() {
    this.map.events.remove('boundschange', this._onMapChange);
    this.map.events.remove('sizechange', this._onMapChange);
    this.layer.innerHTML = '';
  }
}

export function windBlowsToCompass(fromDeg) {
  if (fromDeg == null) return '—';
  return degToCompass((fromDeg + 180) % 360);
}
