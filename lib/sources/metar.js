import { fetchJson } from '../lib/fetch.js';
import { METAR_STATION } from '../config.js';
import { ktsToMps } from '../wind.js';

export async function fetchMetar(apiKey, icao = METAR_STATION) {
  if (!apiKey) throw new Error('CHECKWX_API_KEY not configured');

  const data = await fetchJson(`https://api.checkwx.com/metar/${icao}/decoded`, {
    headers: { 'X-API-Key': apiKey },
  });

  const report = data.data?.[0];
  if (!report) return null;

  const wind = report.wind || {};
  const speedMps = wind.speed_mps ?? ktsToMps(wind.speed_kts);

  return {
    icao: report.icao,
    station: report.station?.name ?? icao,
    observed: report.observed,
    raw: report.raw_text,
    windSpeed: speedMps,
    windDirection: wind.degrees ?? null,
    windVariable: wind.variable ?? null,
    gustMps: wind.gust_kts ? ktsToMps(wind.gust_kts) : null,
    temperature: report.temperature?.celsius ?? null,
    pressure: report.barometer?.hpa ?? report.barometer?.mb ?? null,
    humidity: report.humidity ?? null,
    visibility: report.visibility?.meters ?? null,
    flightCategory: report.flight_category ?? null,
    clouds: report.clouds ?? [],
    distanceKm: 35,
  };
}
