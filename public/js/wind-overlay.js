import { windColor, degToCompass, LAKE_WIND_POINTS } from './wind-utils.js';

// Сетка стрелок над озером
const WIND_GRID = [
  ...LAKE_WIND_POINTS,
  { id: 'g1', lat: 56.200, lon: 36.982 },
  { id: 'g2', lat: 56.190, lon: 36.982 },
  { id: 'g3', lat: 56.200, lon: 36.996 },
  { id: 'g4', lat: 56.190, lon: 36.996 },
  { id: 'g5', lat: 56.185, lon: 36.978 },
  { id: 'g6', lat: 56.205, lon: 37.002 },
];

const CENTER_ID = 'center';

export class WindOverlay {
  constructor(map, layerEl) {
    this.map = map;
    this.layer = layerEl;
    this.speed = null;
    this.direction = null;
    this._onMapChange = () => this.reposition();
    map.events.add('boundschange', this._onMapChange);
    map.events.add('sizechange', this._onMapChange);
  }

  setWind(speed, direction) {
    this.speed = speed;
    this.direction = direction;
    this.render();
  }

  /** Метеорологическое направление → куда дует ветер (градусы) */
  blowBearing(fromDeg) {
    return ((fromDeg ?? 0) + 180) % 360;
  }

  animDuration(speed) {
    if (speed == null) return 2.4;
    return Math.max(0.6, 2.8 - speed * 0.22);
  }

  render() {
    const bearing = this.blowBearing(this.direction);
    const color = windColor(this.speed);
    const duration = this.animDuration(this.speed);
    const speedText = this.speed != null ? this.speed.toFixed(1) : '—';

    this.layer.innerHTML = WIND_GRID.map((point) => {
      const isCenter = point.id === CENTER_ID;
      return `
        <div class="wind-arrow-anim ${isCenter ? 'wind-arrow-anim--center' : ''}"
             data-id="${point.id}"
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
          ${isCenter ? `<span class="wind-arrow-anim__speed">${speedText} м/с</span>` : ''}
        </div>
      `;
    }).join('');

    this.reposition();
  }

  coordToPixel(lat, lon) {
    const zoom = this.map.getZoom();
    const projection = this.map.options.get('projection');
    const global = projection.toGlobalPixels([lat, lon], zoom);
    const center = this.map.getGlobalPixelCenter();
    const size = this.map.container.getSize();
    return [
      global[0] - center[0] + size[0] / 2,
      global[1] - center[1] + size[1] / 2,
    ];
  }

  reposition() {
    const arrows = this.layer.querySelectorAll('.wind-arrow-anim');
    WIND_GRID.forEach((point, i) => {
      const el = arrows[i];
      if (!el) return;
      const [x, y] = this.coordToPixel(point.lat, point.lon);
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
