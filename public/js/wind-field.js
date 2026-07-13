import { DEFAULT_LOCATION } from './wind-utils.js';

/** Индекс выбранного часа: 0 = сейчас (факт), 1+ = прогноз */
let selectedHourIndex = 0;
let timelineHours = [];
let onChangeCallback = null;

export function initTimeline(weatherData, onChange, preserveIndex = false) {
  onChangeCallback = onChange;
  const prevIndex = preserveIndex ? selectedHourIndex : 0;
  timelineHours = buildTimelineHours(weatherData);
  selectedHourIndex = Math.min(prevIndex, Math.max(0, timelineHours.length - 1));
  renderTimelineUI();
  notifyChange();
}

export function getSelectedHourIndex() {
  return selectedHourIndex;
}

export function getTimelineHours() {
  return timelineHours;
}

export function isFactualMode() {
  return selectedHourIndex === 0;
}

export function getSelectedTime() {
  return timelineHours[selectedHourIndex] ?? null;
}

function buildTimelineHours(data) {
  const grid = data?.windField?.grid;
  const times = grid?.ok ? grid.data.times : null;

  if (times?.length) {
    return times.slice(0, 49).map((time, i) => ({
      index: i,
      time,
      label: formatHourLabel(time, i),
      mode: i === 0 ? 'fact' : 'forecast',
    }));
  }

  const icon = data?.forecast?.openMeteo?.data?.icon;
  if (icon?.length) {
    return icon.slice(0, 49).map((h, i) => ({
      index: i,
      time: h.time,
      label: formatHourLabel(h.time, i),
      mode: i === 0 ? 'fact' : 'forecast',
    }));
  }

  const now = new Date();
  return Array.from({ length: 49 }, (_, i) => {
    const t = new Date(now.getTime() + i * 3600000);
    return {
      index: i,
      time: t.toISOString(),
      label: i === 0 ? 'Сейчас' : formatHourOnly(t),
      mode: i === 0 ? 'fact' : 'forecast',
    };
  });
}

function formatHourLabel(iso, index) {
  if (index === 0) return 'Сейчас';
  return formatHourOnly(new Date(iso));
}

function formatHourOnly(date) {
  return date.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderTimelineUI() {
  const slider = document.getElementById('timeline-slider');
  const label = document.getElementById('timeline-label');
  const modeBadge = document.getElementById('timeline-mode');
  const ticks = document.getElementById('timeline-ticks');

  if (!slider) return;

  const max = Math.max(0, timelineHours.length - 1);
  slider.max = String(max);
  slider.value = String(selectedHourIndex);

  const current = timelineHours[selectedHourIndex];
  if (label && current) {
    label.textContent = current.label;
  }
  if (modeBadge && current) {
    modeBadge.textContent = current.mode === 'fact' ? 'факт' : 'прогноз ICON';
    modeBadge.className = `timeline__mode timeline__mode--${current.mode}`;
  }

  if (ticks) {
    ticks.innerHTML = timelineHours
      .filter((_, i) => i % 6 === 0 || i === max)
      .map((h) => `<span class="timeline__tick">${h.index === 0 ? '0' : `+${h.index}ч`}</span>`)
      .join('');
  }
}

function notifyChange() {
  onChangeCallback?.(selectedHourIndex, timelineHours[selectedHourIndex]);
}

export function setupTimelineEvents() {
  const slider = document.getElementById('timeline-slider');
  const nowBtn = document.getElementById('timeline-now');

  slider?.addEventListener('input', () => {
    selectedHourIndex = parseInt(slider.value, 10);
    renderTimelineUI();
    notifyChange();
  });

  nowBtn?.addEventListener('click', () => {
    selectedHourIndex = 0;
    renderTimelineUI();
    notifyChange();
  });
}

/** Собрать поле ветра для выбранного часа */
export function buildWindField(weatherData, hourIndex) {
  const grid = weatherData?.windField?.grid?.data;
  const observations = weatherData?.windField?.observations ?? [];
  const center = weatherData?.location ?? DEFAULT_LOCATION;

  if (hourIndex === 0) {
    return buildFactualField(grid, observations, center, weatherData);
  }
  return buildForecastField(grid, hourIndex, center, weatherData);
}

function buildFactualField(grid, observations, center, weatherData) {
  const metar = observations.find((o) => o.type === 'metar');
  const stations = observations.filter((o) => o.type === 'narodmon');

  const baseSpeed = metar?.windSpeed ?? null;
  const baseDir = metar?.windDir ?? null;
  const source = metar ? metar.source : stations.length ? 'Narodmon' : '—';

  const points = [];

  if (grid?.points) {
    for (const gp of grid.points) {
      const nearStation = findNearestStation(gp.lat, gp.lon, stations, 0.008);
      if (nearStation) {
        points.push({
          lat: nearStation.lat,
          lon: nearStation.lon,
          speed: nearStation.windSpeed,
          dir: nearStation.windDir,
          source: nearStation.source,
          factual: true,
          isStation: true,
        });
      } else {
        points.push({
          lat: gp.lat,
          lon: gp.lon,
          speed: baseSpeed,
          dir: baseDir,
          source,
          factual: true,
        });
      }
    }
  } else {
    const step = 0.012;
    for (let r = -4; r <= 4; r++) {
      for (let c = -4; c <= 4; c++) {
        points.push({
          lat: +(center.lat + r * step).toFixed(4),
          lon: +(center.lon + c * step).toFixed(4),
          speed: baseSpeed,
          dir: baseDir,
          source,
          factual: true,
        });
      }
    }
  }

  for (const obs of observations) {
    if (!points.some((p) => haversineDeg(p.lat, p.lon, obs.lat, obs.lon) < 0.003)) {
      points.push({
        lat: obs.lat,
        lon: obs.lon,
        speed: obs.windSpeed,
        dir: obs.windDir,
        source: obs.source,
        factual: true,
        isStation: true,
      });
    }
  }

  const centerPoint = findCenterWind(points, center.lat, center.lon);
  if (!points.length) {
    return buildUniformFallback(center, hourIndex, weatherData, 'fact', source);
  }
  return { points, centerPoint, mode: 'fact', source };
}

function buildForecastField(grid, hourIndex, center, weatherData) {
  const points = [];
  const time = grid?.times?.[hourIndex];

  if (grid?.points) {
    for (const gp of grid.points) {
      const hour = gp.hourly?.[hourIndex];
      points.push({
        lat: gp.lat,
        lon: gp.lon,
        speed: hour?.windSpeed ?? null,
        dir: hour?.windDir ?? null,
        source: 'ICON',
        factual: false,
      });
    }
  }

  const centerPoint = findCenterWind(points, center.lat, center.lon);
  if (!points.length) {
    return buildUniformFallback(center, hourIndex, weatherData, 'forecast', 'ICON');
  }

  return {
    points,
    centerPoint,
    mode: 'forecast',
    source: `ICON · ${time ? formatHourOnly(new Date(time)) : ''}`,
  };
}

function buildUniformFallback(center, hourIndex, weatherData, mode, source) {
  let speed = null;
  let dir = null;
  let src = source;

  if (mode === 'fact') {
    const metar = weatherData?.windField?.observations?.find((o) => o.type === 'metar');
    if (metar) {
      speed = metar.windSpeed;
      dir = metar.windDir;
      src = metar.source;
    }
  }

  if (speed == null) {
    const icon = weatherData?.forecast?.openMeteo?.data?.icon?.[hourIndex];
    speed = icon?.windSpeed10m ?? null;
    dir = icon?.windDir10m ?? null;
    src = mode === 'forecast' ? 'ICON' : src;
  }
  const step = 0.015;
  const points = [];

  for (let r = -3; r <= 3; r++) {
    for (let c = -3; c <= 3; c++) {
      points.push({
        lat: +(center.lat + r * step).toFixed(4),
        lon: +(center.lon + c * step).toFixed(4),
        speed,
        dir,
        source,
        factual: mode === 'fact',
      });
    }
  }

  return {
    points,
    centerPoint: { speed, dir },
    mode,
    source: src,
  };
}

function findNearestStation(lat, lon, stations, maxDist) {
  let best = null;
  let bestD = Infinity;
  for (const s of stations) {
    const d = haversineDeg(lat, lon, s.lat, s.lon);
    if (d < maxDist && d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function findCenterWind(points, lat, lon) {
  let best = points[0];
  let bestD = Infinity;
  for (const p of points) {
    const d = haversineDeg(lat, lon, p.lat, p.lon);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best ?? { speed: null, dir: null };
}

function haversineDeg(lat1, lon1, lat2, lon2) {
  return Math.sqrt((lat2 - lat1) ** 2 + (lon2 - lon1) ** 2);
}

export function getCenterWindFromField(field) {
  return {
    speed: field?.centerPoint?.speed ?? null,
    dir: field?.centerPoint?.dir ?? null,
    source: field?.source ?? '—',
    mode: field?.mode ?? 'fact',
  };
}
