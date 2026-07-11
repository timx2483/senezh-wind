export const DEFAULT_LOCATION = {
  name: 'Озеро Сенеж',
  lat: 56.195,
  lon: 36.989,
};

export const METAR_STATION = 'UUEE';

// Точки на озере для отрисовки стрелок ветра
export const LAKE_WIND_POINTS = [
  { id: 'north', lat: 56.208, lon: 36.978, label: 'Север' },
  { id: 'center', lat: 56.195, lon: 36.989, label: 'Центр' },
  { id: 'south', lat: 56.182, lon: 36.995, label: 'Юг' },
  { id: 'west', lat: 56.193, lon: 36.968, label: 'Запад' },
  { id: 'east', lat: 56.197, lon: 37.008, label: 'Восток' },
  { id: 'nw', lat: 56.202, lon: 36.972, label: 'СЗ' },
  { id: 'se', lat: 56.188, lon: 37.002, label: 'ЮВ' },
];

// Контур озера (приблизительный полигон)
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
