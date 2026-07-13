import { fetchJson } from '../fetch.js';
import { buildWindGrid, chunkArray } from '../grid.js';

const HOURLY_WIND = 'wind_speed_10m,wind_direction_10m';
const CHUNK_SIZE = 40;

function normalizeMultiHourly(data, points, model) {
  const hourly = data?.hourly;
  if (!hourly?.time) return [];

  const times = hourly.time;
  const isMulti = Array.isArray(times[0]);

  return points.map((point, idx) => {
    const pointTimes = isMulti ? times[idx] : times;
    const speeds = isMulti ? hourly.wind_speed_10m?.[idx] : hourly.wind_speed_10m;
    const dirs = isMulti ? hourly.wind_direction_10m?.[idx] : hourly.wind_direction_10m;

    const hourlyData = (pointTimes || []).map((time, i) => ({
      time,
      windSpeed: speeds?.[i] ?? null,
      windDir: dirs?.[i] ?? null,
    }));

    return { ...point, model, hourly: hourlyData };
  });
}

async function fetchChunk(points, model) {
  const lats = points.map((p) => p.lat).join(',');
  const lons = points.map((p) => p.lon).join(',');
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&hourly=${HOURLY_WIND}&models=${model}&timezone=Europe%2FMoscow` +
    `&forecast_days=3&wind_speed_unit=ms`;

  const data = await fetchJson(url, {}, 25000);
  return normalizeMultiHourly(data, points, model.toUpperCase());
}

export async function fetchIconWindGrid() {
  const grid = buildWindGrid();
  const chunks = chunkArray(grid.points, CHUNK_SIZE);
  const results = await Promise.all(chunks.map((chunk) => fetchChunk(chunk, 'icon_seamless')));
  const points = results.flat();

  const times = points[0]?.hourly?.map((h) => h.time) ?? [];

  return {
    model: 'ICON',
    bounds: grid.bounds,
    stepLat: grid.stepLat,
    stepLon: grid.stepLon,
    times,
    points,
  };
}
