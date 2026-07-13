import { initMap, updateWindField, updateMapSummary } from './map.js';
import { renderAll, showError } from './ui.js';
import {
  initTimeline,
  setupTimelineEvents,
  buildWindField,
  getCenterWindFromField,
  getSelectedHourIndex,
} from './wind-field.js';

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

let mapReady = false;
let weatherData = null;

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

function applyWindForHour(hourIndex) {
  if (!weatherData || !mapReady) return;

  const field = buildWindField(weatherData, hourIndex);
  updateWindField(field);

  const wind = getCenterWindFromField(field);
  updateMapSummary(wind.speed, wind.dir, wind.source, wind.mode);
}

function onTimelineChange(hourIndex) {
  applyWindForHour(hourIndex);
  if (weatherData) renderAll(weatherData, hourIndex);
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

    try {
      weatherData = await loadWeather(lat, lon);
      renderAll(weatherData, getSelectedHourIndex());
      initTimeline(weatherData, onTimelineChange, true);
      applyWindForHour(getSelectedHourIndex());
    } catch (err) {
      showError('Погода: ' + (err.message || 'ошибка загрузки'));
    }

    if (mapReady && weatherData) {
      applyWindForHour(getSelectedHourIndex());
    }

    if (weatherData) {
      const errors = [];
      for (const [, sources] of Object.entries({ forecast: weatherData.forecast, current: weatherData.current })) {
        for (const [name, src] of Object.entries(sources)) {
          if (src && !src.ok) errors.push(`${name}: ${src.error}`);
        }
      }
      if (weatherData.windField?.grid && !weatherData.windField.grid.ok) {
        errors.push(`windGrid: ${weatherData.windField.grid.error}`);
      }
      if (errors.length) {
        showError('Часть источников недоступна: ' + errors.slice(0, 2).join('; '));
      }
    }
  } catch (err) {
    showError(err.message || 'Ошибка загрузки данных');
  } finally {
    btn.disabled = false;
  }
}

setupTimelineEvents();
document.getElementById('refresh-btn').addEventListener('click', refresh);

refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);
