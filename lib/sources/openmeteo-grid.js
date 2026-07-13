import { fetchJson } from '../fetch.js';
import { buildWindGrid, chunkArray } from '../grid.js';

const HOURLY_WIND = 'wind_speed_10m,wind_direction_10m';
const CHUNK_SIZE = 25;

function normalizeHourlyEntry(hourly) {
  const times = hourly?.time ?? [];
  return times.map((time, i) => ({
    time,
    windSpeed: hourly.wind_speed_10m?.[i] ?? null,
    windDir: hourly.wind_direction_10m?.[i] ?? null,
  }));
}

function normalizeMultiHourly(data, points, model) {
  if (Array.isArray(data)) {
    return data.map((item, idx) => {
      const fallback = points[idx];
      return {
        id: fallback?.id ?? `g_${idx}`,
        lat: item.latitude ?? fallback?.lat,
        lon: item.longitude ?? fallback?.lon,
        model,
        hourly: normalizeHourlyEntry(item.hourly),
      };
    });
  }

  if (data?.hourly?.time) {
    const times = data.hourly.time;
    const isMulti = Array.isArray(times[0]);

    if (isMulti) {
      return points.map((point, idx) => ({
        ...point,
        model,
        hourly: (times[idx] ?? []).map((time, i) => ({
          time,
          windSpeed: data.hourly.wind_speed_10m?.[idx]?.[i] ?? null,
          windDir: data.hourly.wind_direction_10m?.[idx]?.[i] ?? null,
        })),
      }));
    }

    const hourly = normalizeHourlyEntry(data.hourly);
    return points.map((point) => ({ ...point, model, hourly }));
  }

  return [];
}

async function fetchChunk(points, model) {
  const lats = points.map((p) => p.lat).join(',');
  const lons = points.map((p) => p.lon).join(',');
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&hourly=${HOURLY_WIND}&models=${model}&timezone=Europe%2FMoscow` +
    `&forecast_days=3&wind_speed_unit=ms`;

  const data = await fetchJson(url, {}, 30000);
  return normalizeMultiHourly(data, points, model.toUpperCase());
}

export async function fetchIconWindGrid() {
  const grid = buildWindGrid();
  const chunks = chunkArray(grid.points, CHUNK_SIZE);
  const results = await Promise.all(
    chunks.map((chunk) => fetchChunk(chunk, 'icon_seamless'))
  );
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
