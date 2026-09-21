import axios from 'axios';

const GEO_API     = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

export const WMO = {
  0:  { desc:'Clear Sky',            emoji:'☀️', nightEmoji: '🌙' },
  1:  { desc:'Mainly Clear',         emoji:'🌤️', nightEmoji: '🌙' },
  2:  { desc:'Partly Cloudy',        emoji:'⛅', nightEmoji: '☁️' },
  3:  { desc:'Overcast',             emoji:'☁️', nightEmoji: '☁️' },
  45: { desc:'Foggy',                emoji:'🌫️' },
  48: { desc:'Rime Fog',             emoji:'🌫️' },
  51: { desc:'Light Drizzle',        emoji:'🌦️' },
  53: { desc:'Drizzle',              emoji:'🌦️' },
  55: { desc:'Heavy Drizzle',        emoji:'🌧️' },
  61: { desc:'Light Rain',           emoji:'🌧️' },
  63: { desc:'Moderate Rain',        emoji:'🌧️' },
  65: { desc:'Heavy Rain',           emoji:'🌧️' },
  66: { desc:'Freezing Rain',        emoji:'🌨️' },
  67: { desc:'Heavy Freezing Rain',  emoji:'🌨️' },
  71: { desc:'Light Snow',           emoji:'❄️' },
  73: { desc:'Moderate Snow',        emoji:'❄️' },
  75: { desc:'Heavy Snow',           emoji:'❄️' },
  77: { desc:'Snow Grains',          emoji:'🌨️' },
  80: { desc:'Rain Showers',         emoji:'🌦️' },
  81: { desc:'Moderate Showers',     emoji:'🌧️' },
  82: { desc:'Violent Showers',      emoji:'⛈️' },
  85: { desc:'Snow Showers',         emoji:'🌨️' },
  86: { desc:'Heavy Snow Showers',   emoji:'🌨️' },
  95: { desc:'Thunderstorm',         emoji:'⛈️' },
  96: { desc:'Thunderstorm + Hail',  emoji:'⛈️' },
  99: { desc:'Thunderstorm + Hail',  emoji:'⛈️' },
};

export const getWMO = (code, isDay = 1) => {
  const info = WMO[code] ?? { desc:'Unknown', emoji:'🌡️' };
  return {
    desc: info.desc,
    emoji: isDay === 0 && info.nightEmoji ? info.nightEmoji : info.emoji
  };
};

export const windDir = (deg) => ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8];

export const uvInfo  = (uv) => {
  if (uv < 3)  return { label:'Low',       color:'#00d68f' };
  if (uv < 6)  return { label:'Moderate',  color:'#ffc107' };
  if (uv < 8)  return { label:'High',      color:'#ff8c42' };
  if (uv < 11) return { label:'Very High', color:'#ff4444' };
  return               { label:'Extreme',  color:'#8b5cf6' };
};

export const toF     = (c) => Math.round(c * 9/5 + 32);
export const cvt     = (c, u) => u === 'F' ? toF(c) : Math.round(c);

export const fmtTime = (iso) => {
  if (!iso) return '--';
  // Open-Meteo returns local city time strings like "2026-06-22T05:45"
  // Avoid new Date() which would shift by the user's timezone offset
  const timePart = iso.includes('T') ? iso.split('T')[1] : iso;
  const [hStr, mStr] = timePart.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const searchCities = async (query) => {
  if (!query || query.trim().length < 2) return [];
  try {
    const { data } = await axios.get(GEO_API, {
      params: { name: query.trim(), count: 6, language: 'en', format: 'json' },
    });
    return (data.results || []).map(r => ({
      latitude:  r.latitude,
      longitude: r.longitude,
      name:      r.name,
      admin1:    r.admin1 || '',
      country:   r.country || '',
      country_code: r.country_code || '',
    }));
  } catch { return []; }
};

export const geocodeCity = async (city, countryHint = '') => {
  // Request more results so we can prefer country-matched results (important for Indian villages)
  const params = { name: city, count: 5, language: 'en', format: 'json' };
  if (countryHint) params.countrycodes = countryHint; // e.g. 'IN' to bias toward India
  const { data } = await axios.get(GEO_API, { params });
  if (!data.results?.length) throw new Error(`"${city}" not found. Try a different name or add state/district.`);
  // Prefer the first result (already sorted by population/relevance by Open-Meteo)
  const { latitude, longitude, name, country, country_code, admin1 } = data.results[0];
  return { latitude, longitude, name, country, country_code, admin1 };
};

export const fetchWeather = async (lat, lon) => {
  const { data } = await axios.get(WEATHER_API, {
    params: {
      latitude: lat,
      longitude: lon,
      models: 'best_match',       // explicitly use the most accurate model for the region
      current: [
        'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
        'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
        'weather_code', 'precipitation', 'surface_pressure', 'visibility',
        'uv_index', 'cloud_cover', 'is_day',
      ].join(','),
      hourly: [
        'temperature_2m', 'weather_code', 'precipitation_probability', 'cloud_cover', 'is_day'
      ].join(','),
      daily: [
        'weather_code', 'temperature_2m_max', 'temperature_2m_min',
        'precipitation_probability_max', 'sunrise', 'sunset', 'uv_index_max',
      ].join(','),
      timezone: 'auto',
      forecast_days: 7,
      // NOTE: do NOT add past_days here — it shifts the daily/hourly arrays backward
      // and breaks the "Today" label and sun times. The current{} section is always
      // real-time regardless.
    },
  });
  // Attach a local fetch timestamp so the UI can show "Last Updated"
  data._fetchedAt = new Date().toISOString();
  return data;
};

// Format the _fetchedAt timestamp for display
export const formatUpdatedAt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `Updated ${h % 12 || 12}:${m} ${ampm}`;
};
