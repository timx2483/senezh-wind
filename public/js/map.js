import { windColor } from './wind-utils.js';
import { WindOverlay, windBlowsToCompass } from './wind-overlay.js';

let map = null;
let windOverlay = null;

const CENTER = [56.195, 36.989];
const ZOOM = 12;

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
      'Не удалось загрузить Яндекс.Карты.<br><small>Проверьте ключ API и ограничения по домену</small></div>';
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

      if (!map.panes.get('windFlow')) {
        map.panes.append('windFlow', new ymaps.pane.StaticPane(map, {
          zIndex: 100500,
          css: {
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          },
        }));
      }

      const layerEl = document.getElementById('wind-layer');
      if (layerEl) {
        const paneEl = map.panes.get('windFlow').getElement();
        paneEl.appendChild(layerEl);
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

export function updateWindField(field) {
  if (!windOverlay) return;
  windOverlay.setWindField(field);
}

export function updateMapSummary(windSpeed, windDirection, source, mode) {
  const el = document.getElementById('map-wind-summary');
  if (!el) return;

  const color = windColor(windSpeed);
  const blowsTo = windBlowsToCompass(windDirection);
  const modeLabel = mode === 'fact' ? 'факт' : 'прогноз';

  el.innerHTML = `
    <div class="map-wind-summary__speed" style="color:${color}">
      ${windSpeed != null ? windSpeed.toFixed(1) : '—'} <small style="font-size:0.5em;font-weight:500">м/с</small>
    </div>
    <div class="map-wind-summary__dir">дует → ${blowsTo}</div>
    <div class="map-wind-summary__label">${source} · ${modeLabel}</div>
  `;
}
