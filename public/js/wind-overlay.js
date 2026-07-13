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

  getVisiblePoints() {
    if (!this.points.length) return [];
    const bounds = this.map.getBounds();
    const [[south, west], [north, east]] = bounds;

    const visible = this.points.filter(
      (p) => p.lat >= south && p.lat <= north && p.lon >= west && p.lon <= east
        && p.speed != null
    );

    const zoom = this.map.getZoom();
    const maxArrows = zoom >= 14 ? 120 : zoom >= 12 ? 80 : 50;
    if (visible.length <= maxArrows) return visible;

    const step = Math.ceil(visible.length / maxArrows);
    return visible.filter((_, i) => i % step === 0);
  }

  arrowHtml(point, isCenter) {
    const bearing = this.blowBearing(point.dir);
    const color = windColor(point.speed);
    const duration = this.animDuration(point.speed);
    const isStation = point.isStation;
    const sizeClass = isCenter
      ? 'wind-arrow-anim--center'
      : isStation
        ? 'wind-arrow-anim--station'
        : '';

    return `
      <div class="wind-arrow-anim ${sizeClass}"
           data-lat="${point.lat}" data-lon="${point.lon}"
           style="--bearing:${bearing}deg;--color:${color};--duration:${duration}s">
        <div class="wind-arrow-anim__body">
          <svg viewBox="0 0 32 56" aria-hidden="true">
            <line class="wind-arrow-anim__shaft" x1="16" y1="50" x2="16" y2="14"/>
            <polygon class="wind-arrow-anim__head" points="16,4 26,20 16,15 6,20"/>
            <circle class="wind-arrow-anim__dot wind-arrow-anim__dot--1" cx="16" cy="42" r="2.5"/>
            <circle class="wind-arrow-anim__dot wind-arrow-anim__dot--2" cx="16" cy="32" r="2.5"/>
            <circle class="wind-arrow-anim__dot wind-arrow-anim__dot--3" cx="16" cy="22" r="2.5"/>
          </svg>
        </div>
        ${isCenter ? `<span class="wind-arrow-anim__speed">${point.speed.toFixed(1)} м/с</span>` : ''}
        ${isStation && !isCenter ? `<span class="wind-arrow-anim__station">${point.source?.replace('METAR ', '') ?? ''}</span>` : ''}
      </div>
    `;
  }

  render() {
    const visible = this.getVisiblePoints();
    if (!visible.length) {
      this.layer.innerHTML = '';
      return;
    }

    const center = this.map.getCenter();
    const centerLat = center[0];
    const centerLon = center[1];

    let centerIdx = 0;
    let minD = Infinity;
    visible.forEach((p, i) => {
      const d = (p.lat - centerLat) ** 2 + (p.lon - centerLon) ** 2;
      if (d < minD) {
        minD = d;
        centerIdx = i;
      }
    });

    this.layer.innerHTML = visible
      .map((p, i) => this.arrowHtml(p, i === centerIdx))
      .join('');

    this.reposition();
  }

  coordToPixel(lat, lon) {
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
    const arrows = this.layer.querySelectorAll('.wind-arrow-anim');
    arrows.forEach((el) => {
      const lat = parseFloat(el.dataset.lat);
      const lon = parseFloat(el.dataset.lon);
      const [x, y] = this.coordToPixel(lat, lon);
      el.style.transform = `translate(${x}px, ${y}px) rotate(var(--bearing))`;
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
