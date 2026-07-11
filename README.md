# Сенеж · Ветер

Мини-приложение для виндсерфа и кайта — прогноз и фактический ветер на озере Сенеж (56.195, 36.989).

## Возможности

- **Карта Яндекс** с оверлеем направления ветра и цветовой шкалой скорости
- **Сравнение моделей**: ICON, ECMWF, GFS (OpenWeather + Stormglass)
- **Фактический ветер**: METAR аэропорт Шереметьево (UUEE)
- **Метеостанции**: Народный Мониторинг (опционально)
- Адаптивный интерфейс для мобильных и десктопа

### Цветовая шкала

| Скорость | Цвет | Условие |
|----------|------|---------|
| до 4 м/с | синий | слабый ветер |
| 5–8 м/с | зелёный | рабочий |
| 9–12 м/с | жёлтый | сильный |
| 13+ м/с | красный | дозит |

## Деплой на Vercel

```bash
cd senezh-wind
npm i -g vercel   # если ещё не установлен
vercel
```

### Переменные окружения

Задайте в Vercel Dashboard → Settings → Environment Variables:

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `YANDEX_MAPS_API_KEY` | да | [Яндекс.Карты API](https://developer.tech.yandex.ru/) |
| `STORMGLASS_API_KEY` | да | Stormglass.io (10 запросов/день) |
| `OPENWEATHER_API_KEY` | да | OpenWeather One Call 3.0 |
| `CHECKWX_API_KEY` | да | CheckWX METAR |
| `NARODMON_API_KEY` | нет | Народный Мониторинг |
| `NARODMON_UUID` | нет | UUID устройства в Narodmon |

Open-Meteo работает без ключа (до 10 000 запросов/день).

> **Лимиты:** Stormglass — 10 запросов/день. API кэшируется на 3 часа (CDN Vercel), клиент обновляется каждые 30 минут.

### Локальная разработка

```bash
cp .env.example .env.local
# заполните ключи
vercel dev
```

> **Примечание:** из РФ часть внешних API может быть недоступна локально. На Vercel (серверы за рубежом) все источники работают штатно.

## API

### `GET /api/weather?lat=56.195&lon=36.989`

Агрегирует все источники. Каждый источник возвращается отдельно с полем `ok: true/false`, чтобы частичные сбои не ломали приложение.

### `GET /api/config`

Публичная конфигурация (ключ Яндекс.Карт, координаты по умолчанию).

## Структура

```
senezh-wind/
├── api/           # Vercel serverless functions
├── lib/           # Провайдеры погодных API
├── public/        # Статика (HTML, CSS, JS)
└── vercel.json
```

## Источники данных

- [Open-Meteo](https://open-meteo.com/) — ICON + ECMWF
- [Stormglass](https://stormglass.io/) — сравнение GFS/ECMWF/ICON
- [OpenWeather](https://openweathermap.org/) — One Call 3.0
- [CheckWX](https://www.checkwxapi.com/) — METAR UUEE
- [Народный Мониторинг](https://narodmon.ru/) — частные станции
