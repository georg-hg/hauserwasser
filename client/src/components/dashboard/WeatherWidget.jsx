import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL
  ? `https://${import.meta.env.VITE_API_URL}`
  : '';

// ── Weather Icons (SVG) ──
function WeatherIcon({ icon, size = 'w-8 h-8' }) {
  const icons = {
    sunny: (
      <svg className={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="4" fill="#fbbf24" stroke="#f59e0b" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="#f59e0b" strokeLinecap="round" />
      </svg>
    ),
    'partly-cloudy': (
      <svg className={size} viewBox="0 0 24 24" fill="none">
        <circle cx="10" cy="8" r="3" fill="#fbbf24" stroke="#f59e0b" strokeWidth={1} />
        <path d="M8 14a4 4 0 014-4h1a3 3 0 013 3v0a3 3 0 01-3 3H9a2 2 0 01-1-2z" fill="#e5e7eb" stroke="#9ca3af" strokeWidth={1} />
      </svg>
    ),
    cloudy: (
      <svg className={size} viewBox="0 0 24 24" fill="none">
        <path d="M6 16a4 4 0 014-4h2a4 4 0 014 4H6z" fill="#d1d5db" stroke="#9ca3af" strokeWidth={1} />
        <path d="M8 12a3 3 0 013-3h1a3.5 3.5 0 013.5 3.5V13H8v-1z" fill="#e5e7eb" stroke="#9ca3af" strokeWidth={1} />
      </svg>
    ),
    fog: (
      <svg className={size} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeLinecap="round">
        <path d="M4 10h16M6 14h12M8 18h8" />
      </svg>
    ),
    drizzle: (
      <svg className={size} viewBox="0 0 24 24" fill="none">
        <path d="M6 12a4 4 0 014-4h4a4 4 0 010 8H8a3 3 0 01-2-1" fill="#e5e7eb" stroke="#9ca3af" strokeWidth={1} />
        <path d="M9 17l-1 3M13 17l-1 3" stroke="#60a5fa" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
    rain: (
      <svg className={size} viewBox="0 0 24 24" fill="none">
        <path d="M6 11a4 4 0 014-4h4a4 4 0 010 8H8a3 3 0 01-2-1" fill="#d1d5db" stroke="#9ca3af" strokeWidth={1} />
        <path d="M8 16l-1.5 4M12 16l-1.5 4M16 16l-1.5 4" stroke="#3b82f6" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
    'heavy-rain': (
      <svg className={size} viewBox="0 0 24 24" fill="none">
        <path d="M6 10a4 4 0 014-4h4a4 4 0 010 8H8a3 3 0 01-2-1" fill="#9ca3af" stroke="#6b7280" strokeWidth={1} />
        <path d="M7 15l-2 5M10.5 15l-2 5M14 15l-2 5M17.5 15l-2 5" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" />
      </svg>
    ),
    'freezing-rain': (
      <svg className={size} viewBox="0 0 24 24" fill="none">
        <path d="M6 11a4 4 0 014-4h4a4 4 0 010 8H8a3 3 0 01-2-1" fill="#d1d5db" stroke="#9ca3af" strokeWidth={1} />
        <path d="M9 16l-1 3M13 16l-1 3" stroke="#93c5fd" strokeWidth={1.5} strokeLinecap="round" />
        <circle cx="16" cy="18" r="1" fill="#bfdbfe" />
      </svg>
    ),
    snow: (
      <svg className={size} viewBox="0 0 24 24" fill="none">
        <path d="M6 11a4 4 0 014-4h4a4 4 0 010 8H8a3 3 0 01-2-1" fill="#e5e7eb" stroke="#9ca3af" strokeWidth={1} />
        <circle cx="9" cy="17" r="1.2" fill="#bfdbfe" stroke="#93c5fd" strokeWidth={0.5} />
        <circle cx="13" cy="18.5" r="1.2" fill="#bfdbfe" stroke="#93c5fd" strokeWidth={0.5} />
        <circle cx="16" cy="16.5" r="1.2" fill="#bfdbfe" stroke="#93c5fd" strokeWidth={0.5} />
      </svg>
    ),
    thunderstorm: (
      <svg className={size} viewBox="0 0 24 24" fill="none">
        <path d="M6 10a4 4 0 014-4h4a4 4 0 010 8H8a3 3 0 01-2-1" fill="#6b7280" stroke="#4b5563" strokeWidth={1} />
        <path d="M13 14l-2 4h3l-2 4" stroke="#fbbf24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  return icons[icon] || icons.cloudy;
}

function formatDay(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Heute';
  if (date.toDateString() === tomorrow.toDateString()) return 'Morgen';
  return date.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(timeStr) {
  return new Date(timeStr).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchWeather() {
      try {
        const res = await fetch(`${API_URL}/api/weather`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (mounted) setWeather(json);
      } catch {
        if (mounted) setError(true);
      }
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000); // 10 min refresh
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (error && !weather) return null;

  if (!weather) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-32 mb-4" />
        <div className="h-16 bg-gray-200 rounded mb-3" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-20 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const { current, forecast, hourly } = weather;

  return (
    <div>
      <h2 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        Wetter Piberbach
      </h2>

      <div className="card overflow-hidden">
        {/* ── Current Weather ── */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-sky-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-blue-600">
                <WeatherIcon icon={current.weatherIcon} size="w-12 h-12" />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-gray-900">{current.temperature}°</span>
                  <span className="text-sm text-gray-500">gefuehlt {current.feelsLike}°</span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{current.weatherText}</p>
              </div>
            </div>
            <div className="text-right text-xs text-gray-500 space-y-1">
              <div className="flex items-center justify-end gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                {current.windSpeed} km/h {current.windDirection}
              </div>
              <div>Luftfeuchtigkeit {current.humidity}%</div>
              <div>{current.pressure} hPa</div>
            </div>
          </div>
        </div>

        {/* ── 3-Day Forecast ── */}
        <div className="p-3 border-t border-gray-100">
          <div className="grid grid-cols-4 gap-1">
            {forecast.map((day) => (
              <button
                key={day.date}
                onClick={() => setExpanded(expanded === day.date ? false : day.date)}
                className={`text-center p-2 rounded-lg transition-colors ${
                  expanded === day.date ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'
                }`}
              >
                <p className="text-xs font-medium text-gray-600 mb-1">{formatDay(day.date)}</p>
                <div className="flex justify-center mb-1">
                  <WeatherIcon icon={day.weatherIcon} size="w-7 h-7" />
                </div>
                <div className="flex items-center justify-center gap-1 text-xs">
                  <span className="font-semibold text-gray-900">{day.tempMax}°</span>
                  <span className="text-gray-400">{day.tempMin}°</span>
                </div>
                {day.precipProbability > 0 && (
                  <p className="text-[10px] text-blue-500 mt-0.5">
                    {day.precipProbability}%
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Expanded Day Detail ── */}
        {expanded && (() => {
          const day = forecast.find((d) => d.date === expanded);
          if (!day) return null;
          const dayHours = hourly.filter((h) => h.time.startsWith(expanded));

          return (
            <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
              <div className="pt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{day.weatherText}</span>
                  <span className="text-gray-500 text-xs">
                    Wind bis {day.windSpeedMax} km/h {day.windDirection}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
                    <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                    </svg>
                    <span className="text-gray-500">Aufgang</span>
                    <span className="ml-auto font-medium">{formatTime(day.sunrise)}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    <span className="text-gray-500">Untergang</span>
                    <span className="ml-auto font-medium">{formatTime(day.sunset)}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span className="text-gray-500">Niederschlag</span>
                    <span className="ml-auto font-medium">{day.precipSum} mm</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                    <span className="text-gray-500">Boeen</span>
                    <span className="ml-auto font-medium">{day.windGustsMax} km/h</span>
                  </div>
                </div>

                {/* Hourly mini chart for the day */}
                {dayHours.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1.5">Stundenverlauf</p>
                    <div className="flex gap-0.5 overflow-x-auto pb-1 -mx-1 px-1">
                      {dayHours.filter((_, i) => i % 2 === 0).map((h) => (
                        <div key={h.time} className="flex flex-col items-center min-w-[40px] text-[10px]">
                          <span className="text-gray-400">
                            {new Date(h.time).getHours()}h
                          </span>
                          <WeatherIcon icon={h.weatherIcon} size="w-5 h-5" />
                          <span className="font-medium text-gray-700">{h.temperature}°</span>
                          {h.precipProbability > 0 && (
                            <span className="text-blue-400">{h.precipProbability}%</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[10px] text-gray-300">
            {weather.location} &middot; {weather.source}
          </p>
          {weather.stale && (
            <span className="text-[10px] text-amber-500">Zwischengespeichert</span>
          )}
        </div>
      </div>
    </div>
  );
}
