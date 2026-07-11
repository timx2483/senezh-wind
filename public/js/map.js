import { windColor } from './wind-utils.js';
import { WindOverlay, windBlowsToCompass } from './wind-overlay.js';

let map = null;
let windOverlay = null;

const CENTER = [56.195, 36.989];
const ZOOM = 13;

export async function initMap(apiKey) {
  const container = document.getElementById('map');
  if (!apiKey) {
    container.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8fa3bf;padding:20px;text-align:center;font-size:0.85rem">Задайте YANDEX_MAPS_API_KEY в переменных окружения Vercel</div>';
    return null;
  }

  try {
    await loadYmaps(apiKey);
  } catch (err) {
    container.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8fa3bf;padding:20px;text-align:center;font-size:0.85rem;line-height:1.5">' +
      'Не удалось загрузить Яндекс.Карты.<br><small>Проверьте ключ API и ограничения по домену:<br>senezh-wind.vercel.app</small></div>';
    throw err;
  }

  return new Promise((resolve) => {
    ymaps.ready(() => {
      map = new ymaps.Map(container, {
        center: CENTER,
        zoom: ZOOM,
        controls: ['zoomControl'],
      }, {
        suppressMapOpenBlock: true,
      });

      const layerEl = document.getElementById('wind-layer');
      if (layerEl) {
        windOverlay = new WindOverlay(map, layerEl);
      }

      resolve(map);
    });
  });
}

function loadYmaps(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.ymaps) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Yandex Maps script load failed'));
    document.head.appendChild(script);
  });
}

export function updateWindOverlay(windSpeed, windDirection) {
  if (!windOverlay) return;
  windOverlay.setWind(windSpeed, windDirection);
}

export function updateMapSummary(windSpeed, windDirection, source) {
  const el = document.getElementById('map-wind-summary');
  if (!el) return;

  const color = windColor(windSpeed);
  const blowsTo = windBlowsToCompass(windDirection);
  el.innerHTML = `
    <div class="map-wind-summary__speed" style="color:${color}">
      ${windSpeed != null ? windSpeed.toFixed(1) : '—'} <small style="font-size:0.5em;font-weight:500">м/с</small>
    </div>
    <div class="map-wind-summary__dir">дует → ${blowsTo}</div>
    <div class="map-wind-summary__label">${source || 'прогноз'} · ${windDirection ?? '—'}°</div>
  `;
}
