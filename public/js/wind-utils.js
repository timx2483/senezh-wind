export const DEFAULT_LOCATION = { name: 'Озеро Сенеж', lat: 56.195, lon: 36.989 };

export function windColor(speed) {
  if (speed == null || Number.isNaN(speed)) return '#90a4ae';
  if (speed < 4) return '#29b6f6';
  if (speed < 5) return '#26c6da';
  if (speed < 9) return '#66bb6a';
  if (speed < 12) return '#ffca28';
  if (speed < 15) return '#ff9800';
  return '#ef5350';
}

export function windLabel(speed) {
  if (speed == null) return '—';
  if (speed < 4) return 'слабый';
  if (speed < 9) return 'рабочий';
  if (speed < 12) return 'сильный';
  return 'дозит';
}

export function degToCompass(deg) {
  if (deg == null) return '—';
  const dirs = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  return dirs[Math.round(deg / 45) % 8];
}

export function formatTime(iso, options = {}) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    day: options.showDay ? '2-digit' : undefined,
    month: options.showDay ? '2-digit' : undefined,
    ...options,
  });
}

export function formatPressure(hpa) {
  if (hpa == null) return '—';
  return `${Math.round(hpa)} гПа`;
}

export function formatPrecip(mm) {
  if (mm == null || mm === 0) return '0';
  return mm < 0.1 ? '<0.1' : mm.toFixed(1);
}

export function windArrowSvg(deg, color, size = 32) {
  const rotation = (deg ?? 0) + 180;
  return `<svg class="wind-marker__arrow" width="${size}" height="${size}" viewBox="0 0 32 32" style="transform:rotate(${rotation}deg)">
    <polygon points="16,2 26,28 16,22 6,28" fill="${color}" stroke="#fff" stroke-width="1.5"/>
  </svg>`;
}

export const LAKE_WIND_POINTS = [
  { id: 'north', lat: 56.208, lon: 36.978, label: 'Север' },
  { id: 'center', lat: 56.195, lon: 36.989, label: 'Центр' },
  { id: 'south', lat: 56.182, lon: 36.995, label: 'Юг' },
  { id: 'west', lat: 56.193, lon: 36.968, label: 'Запад' },
  { id: 'east', lat: 56.197, lon: 37.008, label: 'Восток' },
  { id: 'nw', lat: 56.202, lon: 36.972, label: 'СЗ' },
  { id: 'se', lat: 56.188, lon: 37.002, label: 'ЮВ' },
];

export const LAKE_POLYGON = [
  [36.962, 56.212],
  [36.975, 56.215],
  [36.995, 56.210],
  [37.015, 56.200],
  [37.018, 56.188],
  [37.008, 56.178],
  [36.985, 56.175],
  [36.965, 56.182],
  [36.958, 56.195],
  [36.962, 56.208],
];

export const MODEL_COLORS = {
  ICON: '#29b6f6',
  ECMWF: '#ab47bc',
  'OpenWeather': '#ff9800',
  'GFS (NOAA)': '#66bb6a',
  'Stormglass AI': '#ef5350',
  METAR: '#ffd54f',
};
