import { DEFAULT_LOCATION } from '../lib/config.js';
import { fetchOpenMeteo } from '../lib/sources/openmeteo.js';
import { fetchIconWindGrid } from '../lib/sources/openmeteo-grid.js';
import { fetchStormglass } from '../lib/sources/stormglass.js';
import { fetchOpenWeather } from '../lib/sources/openweather.js';
import { fetchMetar } from '../lib/sources/metar.js';
import { fetchNarodmon } from '../lib/sources/narodmon.js';

function buildObservations(metar, narodmon) {
  const obs = [];

  if (metar?.ok && metar.data) {
    const m = metar.data;
    obs.push({
      lat: 55.97686,
      lon: 37.41121,
      windSpeed: m.windSpeed,
      windDir: m.windDirection,
      source: `METAR ${m.icao}`,
      observed: m.observed,
      type: 'metar',
    });
  }

  if (narodmon?.ok && narodmon.data?.stations) {
    for (const s of narodmon.data.stations) {
      if (s.windSpeed == null) continue;
      obs.push({
        lat: s.lat,
        lon: s.lon,
        windSpeed: s.windSpeed,
        windDir: s.windDirection,
        source: s.name || 'Narodmon',
        observed: s.updated,
        type: 'narodmon',
      });
    }
  }

  return obs;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function wrapResult(name, result) {
  if (result.status === 'fulfilled') {
    return { ok: true, source: name, data: result.value };
  }
  return {
    ok: false,
    source: name,
    error: result.reason?.message || String(result.reason),
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).setHeader('Access-Control-Allow-Origin', '*').end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const lat = parseFloat(req.query.lat) || DEFAULT_LOCATION.lat;
  const lon = parseFloat(req.query.lon) || DEFAULT_LOCATION.lon;

  const env = process.env;

  const results = await Promise.allSettled([
    fetchOpenMeteo(lat, lon),
    fetchIconWindGrid(),
    fetchStormglass(lat, lon, env.STORMGLASS_API_KEY),
    fetchOpenWeather(lat, lon, env.OPENWEATHER_API_KEY),
    fetchMetar(env.CHECKWX_API_KEY),
    fetchNarodmon(lat, lon, env.NARODMON_API_KEY, env.NARODMON_UUID),
  ]);

  const [openMeteo, windGrid, stormglass, openWeather, metar, narodmon] = results.map((r, i) =>
    wrapResult(
      ['openMeteo', 'windGrid', 'stormglass', 'openWeather', 'metar', 'narodmon'][i],
      r
    )
  );

  const observations = buildObservations(metar, narodmon);

  const payload = {
    location: { ...DEFAULT_LOCATION, lat, lon },
    updatedAt: new Date().toISOString(),
    forecast: { openMeteo, stormglass, openWeather },
    windField: { grid: windGrid, observations },
    current: { metar, narodmon },
  };

  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=600');
  res.status(200).json(payload);
}

export const config = {
  maxDuration: 30,
};
