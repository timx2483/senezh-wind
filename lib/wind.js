export function windColor(speedMps) {
  if (speedMps == null || Number.isNaN(speedMps)) return '#90a4ae';
  if (speedMps < 4) return '#29b6f6';
  if (speedMps < 5) return '#26c6da';
  if (speedMps < 9) return '#66bb6a';
  if (speedMps < 12) return '#ffca28';
  if (speedMps < 15) return '#ff9800';
  return '#ef5350';
}

export function windLabel(speedMps) {
  if (speedMps == null) return '—';
  if (speedMps < 4) return 'слабый';
  if (speedMps < 9) return 'рабочий';
  if (speedMps < 12) return 'сильный';
  return 'дозит';
}

export function degToCompass(deg) {
  if (deg == null) return '—';
  const dirs = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  return dirs[Math.round(deg / 45) % 8];
}

export function ktsToMps(kts) {
  return kts != null ? Math.round(kts * 0.514444 * 10) / 10 : null;
}

export function msToBeaufort(mps) {
  if (mps == null) return null;
  if (mps < 0.3) return 0;
  if (mps < 1.6) return 1;
  if (mps < 3.4) return 2;
  if (mps < 5.5) return 3;
  if (mps < 8.0) return 4;
  if (mps < 10.8) return 5;
  if (mps < 13.9) return 6;
  if (mps < 17.2) return 7;
  if (mps < 20.8) return 8;
  if (mps < 24.5) return 9;
  if (mps < 28.5) return 10;
  if (mps < 32.7) return 11;
  return 12;
}
