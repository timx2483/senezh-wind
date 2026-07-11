import {
  windColor,
  LAKE_WIND_POINTS,
  LAKE_POLYGON,
} from './wind-utils.js';

let map = null;
let geoObjects = null;
let windLayout = null;

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
      windLayout = ymaps.templateLayoutFactory.createClass(
        '<div class="wind-marker">' +
          '<div class="wind-marker__arrow" style="' +
            'border-bottom-color:$[properties.color];' +
            'transform:rotate($[properties.rotation]deg)' +
          '"></div>' +
          '<span class="wind-marker__speed">$[properties.speed]</span>' +
        '</div>',
        {
          build: function () {
            this.constructor.superclass.build.call(this);
            this.getData().options.set('visible', true);
          },
        }
      );

      map = new ymaps.Map(container, {
        center: CENTER,
        zoom: ZOOM,
        controls: ['zoomControl'],
      }, {
        suppressMapOpenBlock: true,
      });

      geoObjects = new ymaps.GeoObjectCollection();
      map.geoObjects.add(geoObjects);
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
  if (!map || !geoObjects || !window.ymaps || !windLayout) return;

  geoObjects.removeAll();

  const color = windColor(windSpeed);
  const fillOpacity = Math.min(0.2 + (windSpeed ?? 0) * 0.04, 0.5);
  const rotation = (windDirection ?? 0) + 180;
  const speedText = windSpeed != null ? windSpeed.toFixed(1) : '—';

  const lakeCoords = LAKE_POLYGON.map(([lon, lat]) => [lat, lon]);

  geoObjects.add(new ymaps.Polygon(
    [lakeCoords],
    {},
    {
      fillColor: color,
      fillOpacity,
      strokeColor: color,
      strokeWidth: 3,
      strokeOpacity: 0.9,
      zIndex: 100,
    }
  ));

  LAKE_WIND_POINTS.forEach((point) => {
    geoObjects.add(new ymaps.Placemark(
      [point.lat, point.lon],
      { speed: speedText, rotation, color },
      {
        iconLayout: 'default#imageWithContent',
        iconImageHref: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        iconImageSize: [1, 1],
        iconImageOffset: [0, 0],
        iconContentLayout: windLayout,
        iconContentOffset: [-12, -28],
        zIndex: 200,
      }
    ));
  });
}

export function updateMapSummary(windSpeed, windDirection, source) {
  const el = document.getElementById('map-wind-summary');
  if (!el) return;

  const color = windColor(windSpeed);
  el.innerHTML = `
    <div class="map-wind-summary__speed" style="color:${color}">
      ${windSpeed != null ? windSpeed.toFixed(1) : '—'} <small style="font-size:0.5em;font-weight:500">м/с</small>
    </div>
    <div class="map-wind-summary__dir">${windDirection != null ? `${windDirection}°` : '—'}</div>
    <div class="map-wind-summary__label">${source || 'прогноз'}</div>
  `;
}
