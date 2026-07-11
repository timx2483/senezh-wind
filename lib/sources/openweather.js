import { fetchJson } from '../fetch.js';

export async function fetchOpenWeather(lat, lon, apiKey) {
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY not configured');

  const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,alerts&units=metric&lang=ru&appid=${apiKey}`;
  const data = await fetchJson(url);

  const current = data.current
    ? {
        time: new Date(data.current.dt * 1000).toISOString(),
        model: 'OpenWeather (GFS blend)',
        temperature: data.current.temp,
        windSpeed: data.current.wind?.speed ?? null,
        windDirection: data.current.wind?.deg ?? null,
        gust: data.current.wind?.gust ?? null,
        pressure: data.current.pressure,
        humidity: data.current.humidity,
        precipitation: data.current.rain?.['1h'] ?? data.current.snow?.['1h'] ?? 0,
        weather: data.current.weather?.[0]?.description ?? null,
      }
    : null;

  const hourly = (data.hourly || []).map((h) => ({
    time: new Date(h.dt * 1000).toISOString(),
    model: 'OpenWeather',
    temperature: h.temp,
    windSpeed: h.wind_speed ?? null,
    windDirection: h.wind_deg ?? null,
    gust: h.wind_gust ?? null,
    pressure: h.pressure,
    precipitation: h.rain?.['1h'] ?? h.snow?.['1h'] ?? 0,
    pop: h.pop ?? null,
  }));

  return { current, hourly };
}
