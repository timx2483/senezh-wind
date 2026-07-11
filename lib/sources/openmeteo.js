import { fetchJson } from '../fetch.js';

const HOURLY_PARAMS = [
  'temperature_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_speed_80m',
  'wind_direction_80m',
  'rain',
  'showers',
  'snowfall',
  'pressure_msl',
].join(',');

function normalizeHourly(data, model) {
  const hourly = data?.hourly;
  if (!hourly?.time) return null;

  return hourly.time.map((time, i) => ({
    time,
    model,
    temperature: hourly.temperature_2m?.[i] ?? null,
    windSpeed10m: hourly.wind_speed_10m?.[i] ?? null,
    windDir10m: hourly.wind_direction_10m?.[i] ?? null,
    windSpeed80m: hourly.wind_speed_80m?.[i] ?? null,
    windDir80m: hourly.wind_direction_80m?.[i] ?? null,
    rain: hourly.rain?.[i] ?? null,
    showers: hourly.showers?.[i] ?? null,
    snowfall: hourly.snowfall?.[i] ?? null,
    pressure: hourly.pressure_msl?.[i] ?? null,
    precipitation: (hourly.rain?.[i] ?? 0) + (hourly.showers?.[i] ?? 0) + (hourly.snowfall?.[i] ?? 0),
  }));
}

export async function fetchOpenMeteo(lat, lon) {
  const base = 'https://api.open-meteo.com/v1/forecast';
  const common = `latitude=${lat}&longitude=${lon}&hourly=${HOURLY_PARAMS}&timezone=Europe%2FMoscow&forecast_days=3&wind_speed_unit=ms`;

  const [icon, ecmwf] = await Promise.all([
    fetchJson(`${base}?${common}&models=icon_seamless`),
    fetchJson(`${base}?${common}&models=ecmwf_ifs`),
  ]);

  return {
    icon: normalizeHourly(icon, 'ICON'),
    ecmwf: normalizeHourly(ecmwf, 'ECMWF'),
  };
}
