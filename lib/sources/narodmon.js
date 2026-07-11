import { fetchJson } from '../lib/fetch.js';

const MAX_DISTANCE_KM = 25;

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseSensor(sensor, targetLat, targetLon) {
  const lat = parseFloat(sensor.lat ?? sensor.LAT);
  const lon = parseFloat(sensor.lon ?? sensor.LON);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

  const distanceKm = haversineKm(targetLat, targetLon, lat, lon);
  if (distanceKm > MAX_DISTANCE_KM) return null;

  const wind = parseFloat(sensor.wind ?? sensor.WIND ?? sensor.windspeed);
  const windDir = parseFloat(sensor.wind_dir ?? sensor.WDIR ?? sensor.winddirection);
  const temp = parseFloat(sensor.temp ?? sensor.TEMP);
  const pressure = parseFloat(sensor.pressure ?? sensor.PRESS ?? sensor.press);

  return {
    id: sensor.id ?? sensor.mac ?? sensor.MAC,
    name: sensor.name ?? sensor.devname ?? 'Станция',
    owner: sensor.owner ?? null,
    lat,
    lon,
    distanceKm: Math.round(distanceKm * 10) / 10,
    windSpeed: Number.isNaN(wind) ? null : wind,
    windDirection: Number.isNaN(windDir) ? null : windDir,
    temperature: Number.isNaN(temp) ? null : temp,
    pressure: Number.isNaN(pressure) ? null : pressure,
    updated: sensor.time ?? sensor.updated ?? null,
  };
}

export async function fetchNarodmon(lat, lon, apiKey, uuid) {
  if (!apiKey || !uuid) {
    return { stations: [], note: 'NARODMON_API_KEY и NARODMON_UUID не заданы' };
  }

  const body = {
    cmd: 'sensorsList',
    uuid,
    api_key: apiKey,
    lat,
    lon,
    lang: 'ru',
  };

  const data = await fetchJson('https://api.narodmon.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const rawList = data.sensors || data.data || data.list || [];
  const stations = rawList
    .map((s) => parseSensor(s, lat, lon))
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return { stations };
}
