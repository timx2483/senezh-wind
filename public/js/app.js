import { initMap, updateWindOverlay, updateMapSummary } from './map.js';
import { renderAll, getPrimaryWindForMap, showError } from './ui.js';

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

let mapReady = false;

async function loadConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Не удалось загрузить конфигурацию');
  return res.json();
}

async function loadWeather(lat, lon) {
  const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function refresh() {
  const btn = document.getElementById('refresh-btn');
  btn.disabled = true;

  try {
    const config = await loadConfig();
    const { lat, lon } = config.defaultLocation;

    if (!mapReady) {
      try {
        await initMap(config.yandexMapsApiKey);
        mapReady = true;
      } catch {
        // карта не загрузилась — остальной UI всё равно показываем
      }
    }

    const data = await loadWeather(lat, lon);
    renderAll(data);

    const wind = getPrimaryWindForMap();
    if (mapReady) {
      updateWindOverlay(wind.speed, wind.dir);
      updateMapSummary(wind.speed, wind.dir, wind.source);
    }

    const errors = [];
    for (const [group, sources] of Object.entries({ forecast: data.forecast, current: data.current })) {
      for (const [name, src] of Object.entries(sources)) {
        if (src && !src.ok) errors.push(`${name}: ${src.error}`);
      }
    }
    if (errors.length) {
      showError('Часть источников недоступна: ' + errors.slice(0, 2).join('; '));
    }
  } catch (err) {
    showError(err.message || 'Ошибка загрузки данных');
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('refresh-btn').addEventListener('click', refresh);

refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);
