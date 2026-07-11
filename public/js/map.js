import {
  windColor,
  windArrowSvg,
  LAKE_WIND_POINTS,
  LAKE_POLYGON,
} from './wind-utils.js';

let map = null;
let markers = [];
let polygon = null;

const CENTER = { lat: 56.195, lon: 36.989 };
const ZOOM = 13;

export async function initMap(apiKey) {
  if (!apiKey) {
    document.getElementById('map').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8fa3bf;padding:20px;text-align:center;font-size:0.85rem">Задайте YANDEX_MAPS_API_KEY в переменных окружения Vercel</div>';
    return null;
  }

  await loadYmaps(apiKey);

  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker, YMapCollection } = ymaps3;

  await ymaps3.ready;

  map = new YMap(document.getElementById('map'), {
    location: { center: [CENTER.lon, CENTER.lat], zoom: ZOOM },
    showScaleInCopyrights: true,
  });

  map.addChild(new YMapDefaultSchemeLayer({}));
  map.addChild(new YMapDefaultFeaturesLayer({}));

  return map;
}

function loadYmaps(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.ymaps3) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${apiKey}&lang=ru_RU`;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Не удалось загрузить Яндекс.Карты'));
    document.head.appendChild(script);
  });
}

export function updateWindOverlay(windSpeed, windDirection) {
  if (!map || !window.ymaps3) return;

  clearOverlay();

  const { YMapMarker, YMapFeature } = ymaps3;
  const color = windColor(windSpeed);
  const fillOpacity = Math.min(0.15 + (windSpeed ?? 0) * 0.03, 0.45);

  polygon = new YMapFeature({
    id: 'lake-polygon',
    geometry: {
      type: 'Polygon',
      coordinates: [LAKE_POLYGON],
    },
    style: {
      fill: color,
      fillOpacity,
      stroke: [{ color, width: 2 }],
    },
  });
  map.addChild(polygon);

  LAKE_WIND_POINTS.forEach((point) => {
    const el = document.createElement('div');
    el.className = 'wind-marker';
    el.innerHTML = `
      ${windArrowSvg(windDirection, color)}
      <span class="wind-marker__speed">${windSpeed != null ? windSpeed.toFixed(1) : '—'}</span>
    `;

    const marker = new YMapMarker({ coordinates: [point.lon, point.lat] }, el);
    map.addChild(marker);
    markers.push(marker);
  });
}

function clearOverlay() {
  markers.forEach((m) => map?.removeChild(m));
  markers = [];
  if (polygon) {
    map?.removeChild(polygon);
    polygon = null;
  }
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
