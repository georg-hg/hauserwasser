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
      icon: 'M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M12 8v4l3 3',
      color: 'text-blue-600',
    },
    {
      label: 'Durchfluss',
      data: station.durchfluss,
      icon: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
      color: 'text-cyan-600',
    },
    {
      label: 'Temperatur',
      data: station.temperatur,
      icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
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

    fetchWater();
    const interval = setInterval(fetchWater, 5 * 60 * 1000); // refresh every 5 min

    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (error && !data) return null; // Silently fail if water data unavailable

  return (
    <div>
      <h2 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
        Gewaesserdaten Krems
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StationTile
          station={data?.kremsmuenster}
          name="Kremsmuenster"
        />
        <StationTile
          station={data?.kremsdorf}
          name="Kremsdorf"
        />
      </div>
    </div>
  );
}
