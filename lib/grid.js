import { DEFAULT_LOCATION } from './config.js';

/** Сетка точек ветра вокруг озера Сенеж (~1.5 км шаг) */
export function buildWindGrid(
  centerLat = DEFAULT_LOCATION.lat,
  centerLon = DEFAULT_LOCATION.lon,
  rows = 9,
  cols = 9,
  stepLat = 0.012,
  stepLon = 0.018
) {
  const points = [];
  const halfR = Math.floor(rows / 2);
  const halfC = Math.floor(cols / 2);

  for (let r = -halfR; r <= halfR; r++) {
    for (let c = -halfC; c <= halfC; c++) {
      points.push({
        id: `g_${r}_${c}`,
        lat: +(centerLat + r * stepLat).toFixed(4),
        lon: +(centerLon + c * stepLon).toFixed(4),
      });
    }
  }

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);

  return {
    points,
    bounds: {
      north: Math.max(...lats),
      south: Math.min(...lats),
      west: Math.min(...lons),
      east: Math.max(...lons),
    },
    stepLat,
    stepLon,
  };
}

export function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
