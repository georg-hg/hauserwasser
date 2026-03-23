import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL
  ? `https://${import.meta.env.VITE_API_URL}`
  : '';

function TrendIcon({ trend }) {
  if (!trend) return null;
  if (trend === 'rising') return <span className="text-red-500 text-xs ml-1">▲</span>;
  if (trend === 'falling') return <span className="text-blue-500 text-xs ml-1">▼</span>;
  return <span className="text-gray-400 text-xs ml-1">→</span>;
}

function TrendBadge({ direction, label }) {
  if (!direction) return null;
  const config = {
    rising: { text: 'steigend', bg: 'bg-red-50', border: 'border-red-200', color: 'text-red-600', icon: '▲' },
    falling: { text: 'fallend', bg: 'bg-blue-50', border: 'border-blue-200', color: 'text-blue-600', icon: '▼' },
    stable: { text: 'stabil', bg: 'bg-gray-50', border: 'border-gray-200', color: 'text-gray-500', icon: '→' },
  };
  const c = config[direction] || config.stable;
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${c.bg} ${c.border}`}>
      <span className="text-xs text-gray-600">{label}</span>
      <span className={`text-xs font-semibold ${c.color}`}>
        {c.icon} {c.text}
      </span>
    </div>
  );
}

function MiniSparkline({ data, field, color }) {
  if (!data || data.length < 2) return null;
  const values = data.map(d => d[field]).filter(v => v != null);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 24;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-6" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StationTile({ station, name }) {
  if (!station) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 rounded w-16" />
          <div className="h-6 bg-gray-200 rounded w-16" />
          <div className="h-6 bg-gray-200 rounded w-16" />
        </div>
      </div>
    );
  }

  const items = [
    {
      label: 'Pegel',
      data: station.pegel,
      color: 'text-blue-600',
    },
    {
      label: 'Durchfluss',
      data: station.durchfluss,
      color: 'text-cyan-600',
    },
    {
      label: 'Temperatur',
      data: station.temperatur,
      color: 'text-orange-500',
    },
  ];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 text-sm">{name}</h3>
        <TrendIcon trend={station.trend} />
      </div>
      <div className="space-y-2.5">
        {items.map(({ label, data, color }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{label}</span>
            <span className={`text-sm font-semibold ${color}`}>
              {data ? `${data.value} ${data.unit}` : '–'}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-300 mt-2 text-right">
        riverapp.net
      </p>
    </div>
  );
}

export default function WaterWidget() {
  const [data, setData] = useState(null);
  const [trends, setTrends] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchWater() {
      try {
        const res = await fetch(`${API_URL}/api/water`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (mounted) setData(json);
      } catch {
        if (mounted) setError(true);
      }
    }

    async function fetchTrends() {
      try {
        const res = await fetch(`${API_URL}/api/water/trends`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (mounted) setTrends(json);
      } catch { /* silent */ }
    }

    fetchWater();
    fetchTrends();
    const interval = setInterval(fetchWater, 5 * 60 * 1000);
    const trendInterval = setInterval(fetchTrends, 30 * 60 * 1000); // alle 30 min

    return () => { mounted = false; clearInterval(interval); clearInterval(trendInterval); };
  }, []);

  if (error && !data) return null;

  const hasTrends = trends?.trends && trends.dataPoints > 0;

  return (
    <div>
      <h2 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
        Gewässerdaten Krems
      </h2>

      {/* Aktuelle Stationsdaten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StationTile
          station={data?.kremsmuenster}
          name="Kremsmünster"
        />
        <StationTile
          station={data?.kremsdorf}
          name="Kremsdorf"
        />
      </div>

      {/* 30-Tage-Trend (unterhalb der Stationen) */}
      {hasTrends && (
        <div className="card p-4 mt-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm">30-Tage-Trend</h3>
            <span className="text-[10px] text-gray-400">{trends.dataPoints} Tage Daten</span>
          </div>
          <div className="space-y-2">
            <TrendBadge direction={trends.trends.pegel.direction} label="Pegel" />
            <TrendBadge direction={trends.trends.durchfluss.direction} label="Durchfluss" />
            <TrendBadge direction={trends.trends.temperatur.direction} label="Temperatur" />
          </div>
          {trends.history?.length > 2 && (
            <div className="mt-3 space-y-1.5">
              <div>
                <span className="text-[10px] text-gray-400">Pegel</span>
                <MiniSparkline data={trends.history} field="pegel" color="#2563eb" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400">Durchfluss</span>
                <MiniSparkline data={trends.history} field="durchfluss" color="#0891b2" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400">Temperatur</span>
                <MiniSparkline data={trends.history} field="temperatur" color="#f97316" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
