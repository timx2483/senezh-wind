import { fetchJson } from '../lib/fetch.js';

const SOURCE_LABELS = {
  noaa: 'GFS (NOAA)',
  ecmwf: 'ECMWF',
  icon: 'ICON',
  sg: 'Stormglass AI',
  metno: 'MET Norway',
  dwd: 'DWD',
};

export async function fetchStormglass(lat, lon, apiKey) {
  if (!apiKey) throw new Error('STORMGLASS_API_KEY not configured');

  const params = [
    'windSpeed',
    'windDirection',
    'gust',
    'airTemperature',
    'pressure',
    'precipitation',
  ].join(',');

  const url = `https://api.stormglass.io/v2/weather/point?lat=${lat}&lng=${lon}&params=${params}`;
  const data = await fetchJson(url, {
    headers: { Authorization: apiKey },
  });

  const hours = (data.hours || []).map((hour) => {
    const models = {};
    for (const [source, label] of Object.entries(SOURCE_LABELS)) {
      const speed = hour.windSpeed?.[source];
      if (speed == null) continue;
      models[source] = {
        label,
        windSpeed: speed,
        windDirection: hour.windDirection?.[source] ?? null,
        gust: hour.gust?.[source] ?? null,
        temperature: hour.airTemperature?.[source] ?? null,
        pressure: hour.pressure?.[source] ?? null,
        precipitation: hour.precipitation?.[source] ?? null,
      };
    }
    return { time: hour.time, models };
  });

  return { hours, sourceLabels: SOURCE_LABELS };
}
