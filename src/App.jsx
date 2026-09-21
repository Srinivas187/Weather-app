import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import './App.css';
import { geocodeCity, searchCities, fetchWeather, getWMO, windDir, uvInfo, cvt, fmtTime, formatUpdatedAt } from './weatherUtils';
import SkyBackground from './SkyBackground';


const CITIES = ['New York', 'London', 'Tokyo', 'Paris', 'Dubai', 'Mumbai', 'Sydney', 'Berlin'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* Map WMO weather code + is_day → CSS background class */
function getWeatherBg(code, isDay) {
  const night = !isDay;
  if ([95, 96, 99].includes(code)) return 'wx-thunder';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'wx-snow';
  if ([45, 48].includes(code)) return 'wx-fog';
  if ([61, 63, 65, 80, 81, 82].includes(code)) return night ? 'wx-rain-night' : 'wx-rain';
  if ([51, 53, 55, 66, 67].includes(code)) return night ? 'wx-rain-night' : 'wx-drizzle';
  if (code === 0) return night ? 'wx-clear-night' : 'wx-clear-day';
  if (code <= 2) return night ? 'wx-cloudy-night' : 'wx-partly-cloudy';
  return night ? 'wx-cloudy-night' : 'wx-overcast';
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return now;
}

/* ── Skeleton Loading ── */
function SkeletonLoader() {
  return (
    <div className="skeleton-wrap anim-fade-in">
      <div className="skeleton sk-hero" />
      <div className="sk-row">
        <div className="skeleton sk-card" />
        <div className="skeleton sk-card" />
        <div className="skeleton sk-card" />
        <div className="skeleton sk-card" />
      </div>
      <div className="skeleton sk-bar" />
      <div className="sk-row">
        <div className="skeleton sk-card" />
        <div className="skeleton sk-card" />
      </div>
    </div>
  );
}

/* ── History Tab ── */
function HistoryTab({ history, onSelect, onClear, unit }) {
  return (
    <div className="page-inner forecast-page">
      <p className="sec-title">🕒 Recent Searches</p>
      {history.length === 0 ? (
        <div className="f-card card anim-fade-up">
          <span style={{color:'var(--text-300)'}}>No history yet. Search for a city!</span>
        </div>
      ) : (
        <>
          {history.map((loc, i) => (
            <div key={i} className="f-card card anim-fade-up" style={{animationDelay:`${i*0.07}s`, cursor: 'pointer', display: 'flex', alignItems: 'center'}} onClick={() => onSelect(loc)}>
              {loc.code !== undefined && <span style={{fontSize: '1.2rem', marginRight: '10px'}}>{getWMO(loc.code, loc.is_day ?? 1).emoji}</span>}
              <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
                <span className="f-day" style={{textAlign: 'left'}}>{loc.name}</span>
                <span style={{fontSize:'0.8rem',color:'var(--text-300)', textAlign: 'left'}}>{[loc.admin1, loc.country].filter(Boolean).join(', ')}</span>
              </div>
              {loc.temp !== undefined && <span style={{fontWeight: 700, fontSize: '1.1rem'}}>{cvt(loc.temp, unit)}°</span>}
              <span style={{marginLeft: '15px', color: 'var(--text-300)'}}>➡️</span>
            </div>
          ))}
          <button className="search-btn" style={{marginTop: '20px'}} onClick={onClear}>Clear History</button>
        </>
      )}
    </div>
  );
}

/* ── Bottom Nav ── */
function BottomNav({ tab, setTab }) {
  const items = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'forecast', icon: '📅', label: 'Forecast' },
    { id: 'history', icon: '🕒', label: 'History' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ];
  return (
    <nav className="bottom-nav">
      {items.map(it => (
        <button
          key={it.id}
          className={`nav-item ${tab === it.id ? 'active' : ''}`}
          onClick={() => setTab(it.id)}
        >
          <span className="n-icon">{it.icon}</span>
          <span className="n-label">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ── Home Tab ── */
function HomeTab({ weather, location, unit, setUnit, onRefresh }) {
  const cur = weather.current;
  const daily = weather.daily;
  const hourly = weather.hourly;
  const info = getWMO(cur.weather_code, cur.is_day);
  const uv = uvInfo(cur.uv_index);
  const wd = windDir(cur.wind_direction_10m);

  // Match the full "YYYY-MM-DDTHH" prefix from the API's current.time so we land on
  // the correct day+hour in the 7-day hourly array, not just the first occurrence of that hour.
  const currentTime = weather.current?.time ?? ''; // e.g. "2026-06-22T14:00"
  const currentPrefix = currentTime.slice(0, 13);  // "2026-06-22T14"
  const curIdx = (hourly?.time || []).findIndex(t => t.slice(0, 13) === currentPrefix);
  const startIdx = curIdx >= 0 ? curIdx : 0;
  const hours = (hourly?.time || []).slice(startIdx, startIdx + 24).map((t, i) => ({
    label: i === 0 ? 'Now' : (() => {
      const h = parseInt(t.slice(11, 13));
      return `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
    })(),
    icon: getWMO(hourly.weather_code[startIdx + i], hourly.is_day?.[startIdx + i] ?? 1).emoji,
    temp: cvt(hourly.temperature_2m[startIdx + i], unit),
    rain: hourly.precipitation_probability?.[startIdx + i] ?? 0,
  }));

  const vis = cur.visibility;
  const visLabel = vis >= 1000 ? `${(vis / 1000).toFixed(1)} km` : `${vis} m`;

  return (
    <div className="page-inner">
      {/* Hero */}
      <div className="hero-card card anim-fade-up">
        <div className="hero-loc">
          <span>📍</span>
          <h2>{location.name}</h2>
        </div>
        {location.admin1 && location.admin1 !== location.name && (
          <p className="hero-region">{location.admin1}, {location.country}</p>
        )}
        <p className="hero-country" style={location.admin1 && location.admin1 !== location.name ? { display: 'none' } : {}}>{location.country}</p>
        <div className="hero-main">
          <div className="hero-temp-wrap">
            <span className="hero-temp">{cvt(cur.temperature_2m, unit)}</span>
            <div className="hero-unit-col">
              <span className="deg">°</span>
              <div className="unit-toggle">
                <button className={`u-btn ${unit === 'C' ? 'active' : ''}`} onClick={() => setUnit('C')}>C</button>
                <button className={`u-btn ${unit === 'F' ? 'active' : ''}`} onClick={() => setUnit('F')}>F</button>
              </div>
            </div>
          </div>
          <div className="hero-icon-wrap">
            <span className="wi">{info.emoji}</span>
          </div>
        </div>
        <div className="hero-desc">
          <span className="hero-desc-text">{info.desc}</span>
          <span className="hero-feels">Feels {cvt(cur.apparent_temperature, unit)}°{unit}</span>
        </div>
        <div className="hero-meta">
          <span className="hero-updated">{formatUpdatedAt(weather._fetchedAt)}</span>
          <button className="refresh-btn" onClick={onRefresh} title="Refresh weather">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row anim-fade-up d-1">
        {[
          { icon: '💧', label: 'Humidity', val: cur.relative_humidity_2m, unit: '%', pct: cur.relative_humidity_2m },
          { icon: '👁️', label: 'Visibility', val: visLabel, unit: '', pct: Math.min((cur.visibility / 10000) * 100, 100) },
          { icon: '🌡️', label: 'Pressure', val: Math.round(cur.surface_pressure), unit: ' hPa', pct: Math.min(((cur.surface_pressure - 950) / 100) * 100, 100) },
          { icon: '🌧️', label: 'Precip.', val: cur.precipitation, unit: ' mm', pct: Math.min(cur.precipitation * 10, 100) },
        ].map(s => (
          <div key={s.label} className="stat-card card">
            <span className="s-icon">{s.icon}</span>
            <span className="s-label">{s.label}</span>
            <div className="s-val">{s.val}<span>{s.unit}</span></div>
            <div className="stat-bar"><div className="stat-bar-fill" style={{ width: `${s.pct}%` }} /></div>
          </div>
        ))}
      </div>

      {/* Hourly */}
      <div className="hourly-wrap anim-fade-up d-2">
        <p className="sec-title">⏱ Hourly Forecast</p>
        <div className="hourly-scroll">
          {hours.map((h, i) => (
            <div key={i} className={`h-card ${i === 0 ? 'now' : ''}`}>
              <span className="h-time">{h.label}</span>
              <span className="h-icon">{h.icon}</span>
              <div className="h-temp">{h.temp}°</div>
              {h.rain > 0 && <span className="h-rain">💧{h.rain}%</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Details */}
      <div className="details-grid anim-fade-up d-3">
        {/* Wind */}
        <div className="detail-card wide card">
          <span className="dc-label">🌬️ Wind</span>
          <div className="wind-wrap">
            <div className="compass">
              <span className="c-label c-n">N</span>
              <span className="c-label c-s">S</span>
              <span className="c-label c-e">E</span>
              <span className="c-label c-w">W</span>
              <div className="c-arrow" style={{ transform: `translateX(-50%) rotate(${cur.wind_direction_10m}deg)` }} />
            </div>
            <div className="wind-info">
              <div className="w-speed">{Math.round(cur.wind_speed_10m)}<span className="w-unit"> km/h</span></div>
              <div className="w-dir">{wd} · {cur.wind_direction_10m}°</div>
              {cur.wind_gusts_10m && <div className="w-gust">Gusts <b>{Math.round(cur.wind_gusts_10m)} km/h</b></div>}
            </div>
          </div>
        </div>

        {/* UV */}
        <div className="detail-card card">
          <span className="dc-label">☀️ UV Index</span>
          <span className="dc-icon">🔆</span>
          <div className="dc-val" style={{ color: uv.color }}>{Math.round(cur.uv_index)}</div>
          <div className="dc-sub" style={{ color: uv.color }}>{uv.label}</div>
          <div className="uv-track">
            <div className="uv-thumb" style={{ left: `${Math.min((cur.uv_index / 13) * 100, 100)}%` }} />
          </div>
        </div>

        {/* Sun Times */}
        {daily && (() => {
          // Find today's index in the daily array (same logic as ForecastTab)
          const cityTodayStr = (weather.current?.time ?? '').slice(0, 10);
          const todayStr = new Date().toISOString().slice(0, 10);
          const todayIdx = (daily.time || []).findIndex(t => t.slice(0, 10) === (cityTodayStr || todayStr));
          const idx = todayIdx >= 0 ? todayIdx : 0;
          return (
            <div className="detail-card card">
              <span className="dc-label">🌅 Sun Times</span>
              <span className="dc-icon">🌄</span>
              <div className="sun-row">
                <div className="sun-item">
                  <span className="s-lbl">Sunrise</span>
                  <span className="s-time">{fmtTime(daily.sunrise[idx])}</span>
                </div>
                <div className="sun-item">
                  <span className="s-lbl">Sunset</span>
                  <span className="s-time">{fmtTime(daily.sunset[idx])}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ── Forecast Tab ── */
function ForecastTab({ weather, unit }) {
  const { daily } = weather;

  // Find today's date string in the daily array (defensive: handles any past_days offset)
  const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" in local UTC
  // Open-Meteo daily.time entries are like "2026-06-22" in the city's local date
  // Use the API's current.time date part as the canonical "today" for the searched city
  const cityTodayStr = (weather.current?.time ?? '').slice(0, 10);
  const todayIdx = daily.time.findIndex(t => t.slice(0, 10) === (cityTodayStr || todayStr));
  const startIdx = todayIdx >= 0 ? todayIdx : 0;
  const days = daily.time.slice(startIdx); // only today onward

  return (
    <div className="page-inner forecast-page">
      <p className="sec-title">📅 7-Day Forecast</p>
      {days.map((t, i) => {
        const absIdx = startIdx + i;
        const d = new Date(t + 'T12:00:00'); // noon to avoid DST/timezone shift on getDay()
        const info = getWMO(daily.weather_code[absIdx]);
        return (
          <div key={absIdx} className="f-card card anim-fade-up" style={{ animationDelay: `${i * 0.07}s` }}>
            <span className="f-day">{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAYS[d.getDay()]}</span>
            <span className="f-icon">{info.emoji}</span>
            <span style={{ fontSize: '0.77rem', color: 'var(--text-300)', flex: 1 }}>{info.desc}</span>
            {daily.precipitation_probability_max[absIdx] > 0 && (
              <span className="f-rain">💧{daily.precipitation_probability_max[absIdx]}%</span>
            )}
            <div className="f-temps">
              <span className="f-hi">{cvt(daily.temperature_2m_max[absIdx], unit)}°</span>
              <span className="f-lo">{cvt(daily.temperature_2m_min[absIdx], unit)}°</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Settings Tab ── */
function SettingsTab({ unit, setUnit, theme, setTheme }) {
  return (
    <div className="page-inner" style={{ paddingTop: '8px' }}>
      <div className="settings-section">
        <h3>Preferences</h3>
        <div className="setting-row card">
          <div className="sr-left">
            <span className="sr-icon">🌡️</span>
            <div>
              <div className="sr-label">Temperature Unit</div>
              <div className="sr-sub">Celsius or Fahrenheit</div>
            </div>
          </div>
          <div className="seg-control">
            <button className={`seg-btn ${unit === 'C' ? 'active' : ''}`} onClick={() => setUnit('C')}>°C</button>
            <button className={`seg-btn ${unit === 'F' ? 'active' : ''}`} onClick={() => setUnit('F')}>°F</button>
          </div>
        </div>
        <div className="setting-row card">
          <div className="sr-left">
            <span className="sr-icon">{theme === 'dark' ? '🌙' : '☀️'}</span>
            <div>
              <div className="sr-label">Theme</div>
              <div className="sr-sub">{theme === 'dark' ? 'Night mode' : 'Day mode'}</div>
            </div>
          </div>
          <div className="seg-control">
            <button className={`seg-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>🌙 Night</button>
            <button className={`seg-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>☀️ Day</button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Data Source</h3>
        <div className="setting-row card">
          <div className="sr-left">
            <span className="sr-icon">🌐</span>
            <div>
              <div className="sr-label">Weather Provider</div>
              <div className="sr-sub">Open-Meteo API (free &amp; accurate)</div>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 700 }}>✓ Active</span>
        </div>
        <div className="setting-row card">
          <div className="sr-left">
            <span className="sr-icon">🗺️</span>
            <div>
              <div className="sr-label">Geocoding</div>
              <div className="sr-sub">Open-Meteo Geocoding API</div>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 700 }}>✓ Active</span>
        </div>
      </div>

      <div className="settings-section">
        <h3>About</h3>
        <div className="about-card">
          <span className="a-icon">🌤️</span>
          <h4>WeatherPulse</h4>
          <p>Real-time global weather intelligence. Search any city for instant, accurate forecasts powered by Open-Meteo — no API key required.</p>
          <span className="badge">v1.0.0 · PWA + Capacitor Ready</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main App ── */
export default function App() {
  const [tab, setTab] = useState('home');
  const [history, setHistory] = useState([]);
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unit, setUnit] = useState('C');
  const [theme, setTheme] = useState('dark');
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const now = useClock();
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const sugRef = useRef(null);
  const debounceRef = useRef(null);

  const loadWeather = useCallback(async (lat, lon, loc) => {
    setLoading(true); setError('');
    try {
      const data = await fetchWeather(lat, lon);
      const newLoc = {
        ...loc,
        latitude: lat,
        longitude: lon,
        temp: data.current.temperature_2m,
        code: data.current.weather_code,
        is_day: data.current.is_day
      };
      setWeather(data);
      setLocation(newLoc);

      setHistory(prev => {
        const updated = [newLoc, ...prev.filter(h => h.name !== newLoc.name || h.country !== newLoc.country)].slice(0, 10);
        localStorage.setItem('wp-history', JSON.stringify(updated));
        return updated;
      });
    } catch {
      setError('Failed to load weather. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCurrentLocation = useCallback(async (latitude, longitude) => {
    let currentLocation = { name: 'My Location', country: '' };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      const result = await response.json();
      currentLocation = {
        name: result.address?.city || result.address?.town || result.address?.village || 'My Location',
        country: result.address?.country || ''
      };
    } catch {
      // Weather still works with coordinates when the name lookup is unavailable.
    }

    await loadWeather(latitude, longitude, currentLocation);
  }, [loadWeather]);

  // Compute dropdown position from the search-field-wrap bounding rect
  useLayoutEffect(() => {
    if (showSug && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, left: r.left, width: r.width });
    }
  }, [showSug, suggestions]);

  // Fetch suggestions with 300ms debounce
  const fetchSuggestions = useCallback((val) => {
    clearTimeout(debounceRef.current);
    if (!val || val.trim().length < 2) { setSuggestions([]); setShowSug(false); return; }
    debounceRef.current = setTimeout(async () => {
      const results = await searchCities(val);
      setSuggestions(results);
      setShowSug(results.length > 0);
    }, 300);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (sugRef.current && !sugRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSug(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('wp-theme');
    if (saved) setTheme(saved);

    // Auto-load history and location
    const savedHistoryStr = localStorage.getItem('wp-history');
    let hist = [];
    if (savedHistoryStr) {
      try {
        hist = JSON.parse(savedHistoryStr);
        setHistory(hist);
      } catch (e) {}
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async ({ coords: { latitude, longitude } }) => {
          await loadCurrentLocation(latitude, longitude);
        },
        () => {
          if (hist.length > 0) {
            loadWeather(hist[0].latitude, hist[0].longitude, hist[0]);
          } else {
            setError('Location access was denied. Allow location access and refresh the page to see local weather.');
          }
        }
      );
    } else if (hist.length > 0) {
      loadWeather(hist[0].latitude, hist[0].longitude, hist[0]);
    } else {
      setError('Location is not supported by this browser. Search for a city to see its weather.');
    }
  }, [loadCurrentLocation, loadWeather]);
  const handleTheme = (t) => { setTheme(t); localStorage.setItem('wp-theme', t); };

  const isLight = theme === 'light';

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setShowSug(false); setSuggestions([]);
    setLoading(true); setError('');
    try {
      const geo = await geocodeCity(query.trim());
      await loadWeather(geo.latitude, geo.longitude, geo);
    } catch (e) {
      setError(e.message || 'City not found.');
      setLoading(false);
    }
  }, [query, loadWeather]);

  const handleSuggestionClick = useCallback(async (sug) => {
    setQuery(sug.name);
    setShowSug(false); setSuggestions([]);
    await loadWeather(sug.latitude, sug.longitude, sug);
  }, [loadWeather]);

  const handleGeo = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported.'); return; }
    setLoading(true); setError('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        await loadCurrentLocation(latitude, longitude);
      },
      () => { setError('Location access denied.'); setLoading(false); }
    );
  };

  const handleChip = async (city) => {
    setQuery(city); setLoading(true); setError('');
    try {
      const geo = await geocodeCity(city);
      await loadWeather(geo.latitude, geo.longitude, geo);
    } catch (e) { setError(e.message); setLoading(false); }
  };

  // Manual refresh — re-fetch weather for the current location with fresh data
  const handleRefresh = useCallback(async () => {
    if (!location?.latitude) return;
    await loadWeather(location.latitude, location.longitude, location);
  }, [location, loadWeather]);

  // Keep an open dashboard current without requiring a manual refresh.
  useEffect(() => {
    if (!location?.latitude || !location?.longitude) return undefined;
    const refreshId = setInterval(() => {
      loadWeather(location.latitude, location.longitude, location);
    }, 10 * 60 * 1000);
    return () => clearInterval(refreshId);
  }, [location, loadWeather]);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const localHour = weather?.current?.time ? parseInt(weather.current.time.slice(11, 13), 10) : now.getHours();
  let timePhaseStr = 'Day';
  if (weather?.current?.is_day === 0) {
    timePhaseStr = 'Night';
  } else {
    if (localHour >= 5 && localHour < 9) timePhaseStr = 'Morning';
    else if (localHour >= 9 && localHour < 17) timePhaseStr = 'Day';
    else if (localHour >= 17 && localHour < 20) timePhaseStr = 'Evening';
    else timePhaseStr = 'Night';
  }

  return (
    <div className={`app${isLight ? ' light' : ''}`}>
      {/* Real Canvas Sky Animation — driven by city weather */}
      <SkyBackground
        weatherCode={weather?.current?.weather_code ?? 0}
        isDay={weather?.current?.is_day ?? 1}
        localHour={weather?.current?.time ? parseInt(weather.current.time.slice(11, 13), 10) : 12}
        windSpeed={weather?.current?.wind_speed_10m ?? 0}
      />
      {/* Top Bar */}
      <div className="topbar">
        <div className="topbar-logo">
          <div className="icon">🌤️</div>
          <h1>WeatherPulse</h1>
        </div>
        <div className="topbar-right">
          <div className="topbar-phase" style={{
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--text-100)',
            border: '1px solid rgba(255,255,255,0.15)'
          }}>
            {timePhaseStr}
          </div>
          <div className="topbar-time">
            <div className="t">{timeStr}</div>
            <div className="d">{dateStr}</div>
          </div>

        </div>
      </div>

      {/* Search */}
      <div className="search-bar">
        <div className="search-field-wrap" ref={wrapRef}>
          <div className="search-field">
            <span>🔍</span>
            <input
              ref={inputRef}
              id="city-search-input"
              type="search"
              placeholder="Search any city…"
              value={query}
              onChange={e => { setQuery(e.target.value); fetchSuggestions(e.target.value); }}
              onKeyDown={e => { if (e.key === 'Enter') { setShowSug(false); handleSearch(); } if (e.key === 'Escape') setShowSug(false); }}
              onFocus={() => suggestions.length > 0 && setShowSug(true)}
              autoComplete="off"
              enterKeyHint="search"
              aria-autocomplete="list"
              aria-controls="city-suggestions"
            />
          </div>
        </div>
        {/* Autocomplete dropdown — rendered in body via portal to escape overflow:hidden */}
        {showSug && createPortal(
          <ul
            ref={sugRef}
            className="sug-list"
            id="city-suggestions"
            role="listbox"
            style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}
          >
            {suggestions.map((s, i) => (
              <li
                key={i}
                className="sug-item"
                role="option"
                onMouseDown={() => handleSuggestionClick(s)}
              >
                <span className="sug-pin">📍</span>
                <span className="sug-name">{s.name}</span>
                <span className="sug-meta">{[s.admin1, s.country].filter(Boolean).join(', ')}</span>
              </li>
            ))}
          </ul>,
          document.body
        )}
        <button className="search-btn" onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? '…' : 'Search'}
        </button>
        <button className="loc-btn" onClick={handleGeo} title="My location">📍</button>
      </div>

      {/* Error */}
      {error && (
        <div className="error-bar">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {/* Content */}
      <main className="page">
        {loading && <SkeletonLoader />}

        {!loading && !weather && (
          <div className="welcome anim-fade-in">
            <span className="welcome-icon">🌍</span>
            <h2>Discover the Weather</h2>
            <p>Search any city worldwide for real-time conditions, hourly updates, and a 7-day forecast.</p>
            <div className="chips">
              {CITIES.map(c => <button key={c} className="chip" onClick={() => handleChip(c)}>{c}</button>)}
            </div>
          </div>
        )}

        {!loading && weather && (
          <>
            {tab === 'home' && <HomeTab weather={weather} location={location} unit={unit} setUnit={setUnit} onRefresh={handleRefresh} />}
            {tab === 'forecast' && <ForecastTab weather={weather} unit={unit} />}
            {tab === 'history' && <HistoryTab history={history} unit={unit} onSelect={loc => { setTab('home'); loadWeather(loc.latitude, loc.longitude, loc); }} onClear={() => { setHistory([]); localStorage.removeItem('wp-history'); }} />}
            {tab === 'settings' && <SettingsTab unit={unit} setUnit={setUnit} theme={theme} setTheme={handleTheme} />}
          </>
        )}

        {!loading && !weather && tab !== 'home' && (
          <div className="welcome anim-fade-in" style={{ paddingTop: '40px' }}>
            <p style={{ color: 'var(--text-300)' }}>Search a city first to see data here.</p>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}
