export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({
    yandexMapsApiKey: process.env.YANDEX_MAPS_API_KEY || '',
    defaultLocation: { name: 'Озеро Сенеж', lat: 56.195, lon: 36.989 },
  });
}
