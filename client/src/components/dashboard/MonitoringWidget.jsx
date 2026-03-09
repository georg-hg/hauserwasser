import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL
  ? `https://${import.meta.env.VITE_API_URL}`
  : '';

// ── Mini-Sparkline (SVG) ──
function Sparkline({ data, color, id, width = 120, height = 32 }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center">
        <span className="text-[10px] text-gray-300">Keine Daten</span>
      </div>
    );
  }

  const values = data.filter(v => v !== null);
  if (values.length < 2) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center">
        <span className="text-[10px] text-gray-300">Zu wenig Daten</span>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  // Gradient fill area
  const firstX = padding;
  const lastX = padding + ((values.length - 1) / (values.length - 1)) * (width - padding * 2);
  const areaPoints = `${firstX},${height} ${points} ${lastX},${height}`;

  // Eindeutige ID ohne Sonderzeichen für SVG-Gradient
  const gradId = `spark-grad-${id || 'default'}`;

  return (
    <svg width={width} height={height} className="block">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Letzter Punkt hervorheben */}
      {(() => {
        const lastVal = values[values.length - 1];
        const lx = padding + ((values.length - 1) / (values.length - 1)) * (width - padding * 2);
        const ly = height - padding - ((lastVal - min) / range) * (height - padding * 2);
        return <circle cx={lx} cy={ly} r="2.5" fill={color} />;
      })()}
    </svg>
  );
}

// ── Trend-Pfeil ──
function TrendArrow({ trend }) {
  const config = {
    rising: {
      icon: 'M5 10l7-7m0 0l7 7m-7-7v18',
      color: 'text-red-600',
      bg: 'bg-white/80 border border-red-200',
      text: 'Steigend',
    },
    falling: {
      icon: 'M19 14l-7 7m0 0l-7-7m7 7V3',
      color: 'text-emerald-600',
      bg: 'bg-white/80 border border-emerald-200',
      text: 'Sinkend',
    },
    stable: {
      icon: 'M17 8l4 4m0 0l-4 4m4-4H3',
      color: 'text-gray-500',
      bg: 'bg-white/80 border border-gray-200',
      text: 'Stabil',
    },
  };

  const c = config[trend] || config.stable;

  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${c.bg}`}>
      <svg className={`w-3.5 h-3.5 ${c.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
      </svg>
      <span className={`text-[11px] font-semibold ${c.color}`}>{c.text}</span>
    </div>
  );
}

// ── Niederschlags-Mini ──
function PrecipForecast({ precipitation }) {
  if (!precipitation || precipitation.length === 0) return null;

  // Kombinierter Durchschnitt beider Stationen
  const days = precipitation[0]?.forecast || [];

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-[10px] text-gray-400 mb-1.5 font-medium uppercase tracking-wider">Niederschlagsprognose</p>
      <div className="grid grid-cols-2 gap-2">
        {precipitation.map((station) => (
          <div key={station.name} className="space-y-1">
            <p className="text-[10px] text-gray-500 font-medium">{station.name}</p>
            <div className="flex gap-1">
              {station.forecast.map((day) => {
                const intensity = day.precipSum > 15 ? 'bg-blue-500' : day.precipSum > 5 ? 'bg-blue-400' : day.precipSum > 1 ? 'bg-blue-300' : day.precipSum > 0 ? 'bg-blue-200' : 'bg-gray-100';
                const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('de-AT', { weekday: 'short' });
                return (
                  <div key={day.date} className="flex-1 text-center">
                    <div className={`h-2 rounded-full ${intensity}`} title={`${day.precipSum} mm`} />
                    <p className="text-[9px] text-gray-400 mt-0.5">{dayLabel}</p>
                    <p className="text-[9px] text-gray-500 font-medium">{day.precipSum}mm</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MonitoringWidget() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchDashboard() {
      try {
        const token = localStorage.getItem('hw_token');
        if (!token) return;
        const res = await fetch(`${API_URL}/api/monitoring/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (mounted) setData(json);
      } catch {
        if (mounted) setError(true);
      }
    }

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (error && !data) {
    return (
      <div>
        <h2 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Sedimentmonitoring Krems
        </h2>
        <div className="card p-4">
          <p className="text-sm text-gray-400 text-center">Messdaten derzeit nicht verfügbar</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-20 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const { latest, sparkline, trend, precipitation } = data;

  const ch1Values = sparkline.map(s => s.ch1);
  const ch2Values = sparkline.map(s => s.ch2);

  const formatAge = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `vor ${mins} Min.`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    const days = Math.floor(hours / 24);
    return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
  };

  return (
    <div>
      <h2 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Sedimentmonitoring Krems
      </h2>

      <div className="card overflow-hidden">
        <div className="p-4">
          {/* Aktuelle Werte + Sparklines */}
          <div className="grid grid-cols-2 gap-3">
            {/* CH1 – Trübe */}
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Trübe (CH1)</p>
                <TrendArrow trend={trend.ch1} />
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-xl font-bold text-amber-800">
                  {latest?.ch1Ntu != null ? latest.ch1Ntu.toFixed(1) : '–'}
                </span>
                <span className="text-xs text-amber-600">NTU</span>
              </div>
              <Sparkline data={ch1Values} color="#d97706" id="ch1" />
              <p className="text-[9px] text-amber-500 mt-1">4 Tage · stündlich</p>
            </div>

            {/* CH2 – Schwebstoff */}
            <div className="bg-red-50 rounded-xl p-3 border border-red-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">Schwebstoff (CH2)</p>
                <TrendArrow trend={trend.ch2} />
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-xl font-bold text-red-800">
                  {latest?.ch2MgL != null ? latest.ch2MgL.toFixed(1) : '–'}
                </span>
                <span className="text-xs text-red-600">mg/l</span>
              </div>
              <Sparkline data={ch2Values} color="#dc2626" id="ch2" />
              <p className="text-[9px] text-red-500 mt-1">Grenzwert: 5 g/l · Max: 10 g/l</p>
            </div>
          </div>

          {/* Niederschlagsprognose */}
          <PrecipForecast precipitation={precipitation} />
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[10px] text-gray-300">
            Sonde &laquo;{data.probe}&raquo; &middot; Renaturierung Krems
          </p>
          {latest?.measuredAt && (
            <span className="text-[10px] text-gray-400">{formatAge(latest.measuredAt)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
