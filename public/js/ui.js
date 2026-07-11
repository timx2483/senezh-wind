import { windColor, formatTime, formatPressure, formatPrecip, degToCompass, windLabel, MODEL_COLORS } from './wind-utils.js';

const MODELS = [
  { id: 'icon', label: 'ICON', key: 'icon' },
  { id: 'ecmwf', label: 'ECMWF', key: 'ecmwf' },
  { id: 'openweather', label: 'OpenWeather', key: 'openweather' },
  { id: 'stormglass', label: 'Stormglass', key: 'stormglass' },
];

let activeModel = 'icon';
let weatherData = null;

export function renderAll(data) {
  weatherData = data;
  renderCurrentCards(data);
  renderComparisonBar(data);
  renderModelTabs();
  renderForecastTable();
  renderChart(data);
  renderStations(data);
  document.getElementById('updated-at').textContent =
    `Обновлено: ${formatTime(data.updatedAt)} МСК`;
}

function renderComparisonBar(data) {
  const bar = document.getElementById('comparison-bar');
  const items = [];

  if (data.forecast?.openMeteo?.ok) {
    const icon = findClosestHour(data.forecast.openMeteo.data.icon);
    items.push({ model: 'ICON', speed: icon.windSpeed10m, dir: icon.windDir10m });
    const ecmwf = findClosestHour(data.forecast.openMeteo.data.ecmwf);
    items.push({ model: 'ECMWF', speed: ecmwf.windSpeed10m, dir: ecmwf.windDir10m });
  }

  if (data.forecast?.openWeather?.ok && data.forecast.openWeather.data.current) {
    const ow = data.forecast.openWeather.data.current;
    items.push({ model: 'GFS blend', speed: ow.windSpeed, dir: ow.windDirection });
  }

  if (data.forecast?.stormglass?.ok) {
    const sg = findClosestStormglass(data.forecast.stormglass.data.hours);
    if (sg?.models) {
      for (const [key, m] of Object.entries(sg.models)) {
        if (['noaa', 'ecmwf', 'icon'].includes(key)) {
          items.push({ model: m.label, speed: m.windSpeed, dir: m.windDirection });
        }
      }
    }
  }

  if (data.current?.metar?.ok) {
    const m = data.current.metar.data;
    items.push({ model: 'METAR', speed: m.windSpeed, dir: m.windDirection });
  }

  bar.innerHTML = items.map((item) => {
    const color = windColor(item.speed);
    return `
      <div class="comparison-item">
        <div class="comparison-item__model">${item.model}</div>
        <div class="comparison-item__speed" style="color:${color}">
          ${item.speed != null ? item.speed.toFixed(1) : '—'}
        </div>
        <div class="comparison-item__dir">${degToCompass(item.dir)} · ${item.speed != null ? 'м/с' : ''}</div>
      </div>
    `;
  }).join('') || '<div class="card card--loading" style="margin:0 16px">Нет данных</div>';
}

function getPrimaryWind() {
  if (!weatherData) return { speed: null, dir: null, source: '—' };

  if (weatherData.current?.metar?.ok) {
    const m = weatherData.current.metar.data;
    return { speed: m.windSpeed, dir: m.windDirection, source: 'METAR UUEE' };
  }

  const icon = weatherData.forecast?.openMeteo?.data?.icon;
  if (icon?.length) {
    const now = findClosestHour(icon);
    return { speed: now.windSpeed10m, dir: now.windDir10m, source: 'ICON' };
  }

  return { speed: null, dir: null, source: '—' };
}

export function getPrimaryWindForMap() {
  return getPrimaryWind();
}

function findClosestHour(hours) {
  const now = Date.now();
  let best = hours[0];
  let bestDiff = Infinity;
  for (const h of hours) {
    const diff = Math.abs(new Date(h.time).getTime() - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = h;
    }
  }
  return best;
}

function renderCurrentCards(data) {
  const grid = document.getElementById('current-grid');
  const cards = [];

  if (data.current?.metar?.ok) {
    const m = data.current.metar.data;
    cards.push(buildCard('METAR UUEE', m.windSpeed, m.windDirection, {
      meta: `Шереметьево · ${formatTime(m.observed)} · ~35 км`,
      extra: `Давл. ${formatPressure(m.pressure)} · ${m.temperature ?? '—'}°C`,
      badge: windLabel(m.windSpeed),
    }));
  } else if (data.current?.metar) {
    cards.push(`<div class="card card--error">METAR: ${data.current.metar.error}</div>`);
  }

  if (data.forecast?.openMeteo?.ok) {
    const icon = data.forecast.openMeteo.data.icon;
    const now = findClosestHour(icon);
    cards.push(buildCard('ICON', now.windSpeed10m, now.windDir10m, {
      meta: `10 м · ${formatTime(now.time)}`,
      extra: `80 м: ${now.windSpeed80m ?? '—'} м/с · ${formatPressure(now.pressure)}`,
      badge: windLabel(now.windSpeed10m),
    }));

    const ecmwf = data.forecast.openMeteo.data.ecmwf;
    const eNow = findClosestHour(ecmwf);
    cards.push(buildCard('ECMWF', eNow.windSpeed10m, eNow.windDir10m, {
      meta: `10 м · ${formatTime(eNow.time)}`,
      extra: `Осадки: ${formatPrecip(eNow.precipitation)} мм/ч`,
      badge: windLabel(eNow.windSpeed10m),
    }));
  }

  if (data.forecast?.openWeather?.ok) {
    const ow = data.forecast.openWeather.data.current;
    if (ow) {
      cards.push(buildCard('OpenWeather', ow.windSpeed, ow.windDirection, {
        meta: ow.weather || 'GFS blend',
        extra: `Порыв: ${ow.gust ?? '—'} м/с · ${formatPressure(ow.pressure)}`,
        badge: windLabel(ow.windSpeed),
      }));
    }
  }

  if (data.forecast?.stormglass?.ok) {
    const sg = data.forecast.stormglass.data.hours;
    const now = findClosestStormglass(sg);
    if (now) {
      const gfs = now.models.noaa;
      if (gfs) {
        cards.push(buildCard('GFS (Stormglass)', gfs.windSpeed, gfs.windDirection, {
          meta: formatTime(now.time),
          extra: `Порыв: ${gfs.gust ?? '—'} м/с`,
          badge: windLabel(gfs.windSpeed),
        }));
      }
    }
  }

  grid.innerHTML = cards.length ? cards.join('') : '<div class="card card--loading">Нет данных</div>';
}

function findClosestStormglass(hours) {
  const now = Date.now();
  let best = null;
  let bestDiff = Infinity;
  for (const h of hours) {
    const diff = Math.abs(new Date(h.time).getTime() - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = h;
    }
  }
  return best;
}

function buildCard(source, speed, dir, { meta, extra, badge }) {
  const color = windColor(speed);
  return `
    <div class="card">
      <div class="card__source">${source}</div>
      <div class="card__value" style="color:${color}">
        ${speed != null ? speed.toFixed(1) : '—'} <small>м/с</small>
      </div>
      <div class="card__meta">${degToCompass(dir)} (${dir ?? '—'}°)<br>${meta}</div>
      ${extra ? `<div class="card__meta">${extra}</div>` : ''}
      <span class="card__badge" style="background:${color};color:#0a1628">${badge}</span>
    </div>
  `;
}

function renderModelTabs() {
  const container = document.getElementById('model-tabs');
  container.innerHTML = MODELS.map((m) => `
    <button class="model-tab ${m.id === activeModel ? 'model-tab--active' : ''}"
            data-model="${m.id}">${m.label}</button>
  `).join('');

  container.querySelectorAll('.model-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeModel = btn.dataset.model;
      renderModelTabs();
      renderForecastTable();
    });
  });
}

function renderForecastTable() {
  const tbody = document.getElementById('forecast-tbody');
  const modelCol = document.getElementById('model-col-header');
  const rows = getModelHours(activeModel);
  const showModelCol = activeModel === 'stormglass';
  modelCol.hidden = !showModelCol;

  const next48 = showModelCol ? rows.slice(0, 48 * 4) : rows.slice(0, 48);

  tbody.innerHTML = next48.map((h) => {
    const speed = h.windSpeed ?? h.windSpeed10m;
    const dir = h.windDirection ?? h.windDir10m;
    const color = windColor(speed);
    return `
      <tr>
        <td>${formatTime(h.time, { showDay: true })}</td>
        ${showModelCol ? `<td>${h.model || '—'}</td>` : ''}
        <td>
          <div class="wind-cell">
            <span class="wind-cell__bar" style="background:${color}"></span>
            ${speed != null ? speed.toFixed(1) : '—'} м/с
          </div>
        </td>
        <td>${degToCompass(dir)} ${dir != null ? dir + '°' : ''}</td>
        <td>${formatPressure(h.pressure)}</td>
        <td>${formatPrecip(h.precipitation ?? h.rain)} мм</td>
      </tr>
    `;
  }).join('');
}

function getModelHours(modelId) {
  if (!weatherData) return [];

  if (modelId === 'icon' && weatherData.forecast?.openMeteo?.ok) {
    return weatherData.forecast.openMeteo.data.icon || [];
  }
  if (modelId === 'ecmwf' && weatherData.forecast?.openMeteo?.ok) {
    return weatherData.forecast.openMeteo.data.ecmwf || [];
  }
  if (modelId === 'openweather' && weatherData.forecast?.openWeather?.ok) {
    return weatherData.forecast.openWeather.data.hourly || [];
  }
  if (modelId === 'stormglass' && weatherData.forecast?.stormglass?.ok) {
    return (weatherData.forecast.stormglass.data.hours || []).flatMap((h) => {
      const models = h.models || {};
      return Object.entries(models)
        .filter(([key]) => ['noaa', 'ecmwf', 'icon', 'sg'].includes(key))
        .map(([key, m]) => ({
          time: h.time,
          model: m.label,
          windSpeed: m.windSpeed,
          windDirection: m.windDirection,
          pressure: m.pressure,
          precipitation: m.precipitation,
        }));
    });
  }
  return [];
}

function renderChart(data) {
  const canvas = document.getElementById('wind-chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 160 * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = '160px';
  ctx.scale(dpr, dpr);

  const series = [];
  if (data.forecast?.openMeteo?.ok) {
    series.push({ label: 'ICON', color: MODEL_COLORS.ICON, data: data.forecast.openMeteo.data.icon });
    series.push({ label: 'ECMWF', color: MODEL_COLORS.ECMWF, data: data.forecast.openMeteo.data.ecmwf });
  }
  if (data.forecast?.openWeather?.ok) {
    series.push({ label: 'OpenWeather', color: MODEL_COLORS.OpenWeather, data: data.forecast.openWeather.data.hourly });
  }

  if (!series.length) {
    ctx.fillStyle = '#8fa3bf';
    ctx.font = '14px sans-serif';
    ctx.fillText('Нет данных для графика', 20, 80);
    return;
  }

  const hours = 48;
  const w = rect.width;
  const h = 160;
  const pad = { top: 16, right: 12, bottom: 28, left: 36 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  let maxSpeed = 5;
  series.forEach((s) => {
    s.data.slice(0, hours).forEach((p) => {
      const v = p.windSpeed ?? p.windSpeed10m;
      if (v != null && v > maxSpeed) maxSpeed = v;
    });
  });
  maxSpeed = Math.ceil(maxSpeed) + 2;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.fillStyle = '#8fa3bf';
  ctx.font = '10px sans-serif';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (i / 4) * chartH;
    const val = (i / 4) * maxSpeed;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillText(val.toFixed(0), 4, y + 3);
  }

  const zoneColors = [
    { to: 4 / maxSpeed, color: 'rgba(41,182,246,0.08)' },
    { to: 9 / maxSpeed, color: 'rgba(102,187,106,0.08)' },
    { to: 12 / maxSpeed, color: 'rgba(255,202,40,0.08)' },
    { to: 1, color: 'rgba(239,83,80,0.08)' },
  ];
  let prev = 0;
  zoneColors.forEach((z) => {
    const y1 = pad.top + chartH - prev * chartH;
    const y2 = pad.top + chartH - Math.min(z.to, 1) * chartH;
    ctx.fillStyle = z.color;
    ctx.fillRect(pad.left, y2, chartW, y1 - y2);
    prev = z.to;
  });

  series.forEach((s) => {
    const points = s.data.slice(0, hours);
    if (!points.length) return;

    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    points.forEach((p, i) => {
      const v = p.windSpeed ?? p.windSpeed10m ?? 0;
      const x = pad.left + (i / (hours - 1)) * chartW;
      const y = pad.top + chartH - (v / maxSpeed) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  const legend = document.getElementById('chart-legend');
  legend.innerHTML = series.map((s) => `
    <span class="chart-legend__item">
      <span class="chart-legend__dot" style="background:${s.color}"></span>${s.label}
    </span>
  `).join('');
}

function renderStations(data) {
  const section = document.getElementById('stations-section');
  const grid = document.getElementById('stations-grid');
  const stations = data.current?.narodmon?.data?.stations;

  if (!stations?.length) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  grid.innerHTML = stations.map((s) => {
    const color = windColor(s.windSpeed);
    return `
      <div class="card">
        <div class="card__source">${s.name}</div>
        <div class="card__value" style="color:${color}">
          ${s.windSpeed != null ? s.windSpeed.toFixed(1) : '—'} <small>м/с</small>
        </div>
        <div class="card__meta">
          ${degToCompass(s.windDirection)} · ${s.distanceKm} км<br>
          ${s.owner || ''} ${s.updated ? formatTime(s.updated) : ''}
        </div>
      </div>
    `;
  }).join('');
}

export function showError(msg) {
  const toast = document.getElementById('error-toast');
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 5000);
}
