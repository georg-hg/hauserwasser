import { useState, useEffect } from 'react';
import { api } from '../../api/client';

const CHANNEL_INFO = {
  ch1: { label: 'Trübe (NTU)', color: '#f59e0b', unit: 'NTU', description: 'Trübungsmessung' },
  ch2: { label: 'Schwebstofffracht', color: '#ef4444', unit: 'mg/l', description: 'Grenzwert: 5 g/l (Bau), Max: 10 g/l (Tag)' },
  ch32: { label: 'Batteriespannung', color: '#3b82f6', unit: 'V', description: 'Versorgungsspannung der Messsonde' },
};

const TIME_RANGES = [
  { label: '24h', days: 1 },
  { label: '7 Tage', days: 7 },
  { label: '30 Tage', days: 30 },
  { label: '90 Tage', days: 90 },
  { label: 'Alles', days: 0 },
];

export default function MonitoringSection() {
  const [data, setData] = useState([]);
  const [latest, setLatest] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [selectedChannel, setSelectedChannel] = useState('ch2');

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ probe: 'Ende', limit: '5000' });
      if (timeRange > 0) {
        const from = new Date();
        from.setDate(from.getDate() - timeRange);
        params.set('from', from.toISOString());
      }

      const [dataRes, latestRes, statsRes] = await Promise.all([
        api.get(`/api/monitoring/data?${params}`),
        api.get('/api/monitoring/latest?probe=Ende'),
        api.get(`/api/monitoring/stats?probe=Ende&days=${timeRange || 365}`),
      ]);

      setData(dataRes.data || []);
      setLatest(latestRes.latest);
      setStats(statsRes);
    } catch (err) {
      console.error('Monitoring load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('de-AT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatValue = (val, unit) => {
    if (val === null || val === undefined) return '—';
    if (unit === 'mg/l' && val >= 1000) {
      return `${(val / 1000).toFixed(2)} g/l`;
    }
    return `${val.toFixed(2)} ${unit}`;
  };

  // Einfache SVG-Chart Komponente
  const renderChart = () => {
    if (data.length === 0) return null;

    const chartData = [...data].reverse(); // chronologisch
    const channelKey = selectedChannel === 'ch1' ? 'ch1Ntu' : selectedChannel === 'ch2' ? 'ch2MgL' : 'ch32Voltage';
    const info = CHANNEL_INFO[selectedChannel];
    const values = chartData.map(d => d[channelKey]).filter(v => v !== null);

    if (values.length === 0) {
      return (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          Keine Daten für {info.label} vorhanden
        </div>
      );
    }

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;
    const padding = range * 0.1;

    const width = 800;
    const height = 250;
    const marginLeft = 60;
    const marginBottom = 30;
    const marginTop = 20;
    const chartWidth = width - marginLeft - 10;
    const chartHeight = height - marginBottom - marginTop;

    const points = chartData
      .map((d, i) => {
        const val = d[channelKey];
        if (val === null) return null;
        const x = marginLeft + (i / (chartData.length - 1 || 1)) * chartWidth;
        const y = marginTop + chartHeight - ((val - minVal + padding) / (range + 2 * padding)) * chartHeight;
        return `${x},${y}`;
      })
      .filter(Boolean);

    // Grenzwert-Linien für CH2
    const thresholdLines = [];
    if (selectedChannel === 'ch2') {
      const y5g = marginTop + chartHeight - ((5000 - minVal + padding) / (range + 2 * padding)) * chartHeight;
      const y10g = marginTop + chartHeight - ((10000 - minVal + padding) / (range + 2 * padding)) * chartHeight;
      if (y5g > marginTop && y5g < height - marginBottom) {
        thresholdLines.push({ y: y5g, label: '5 g/l', color: '#f59e0b' });
      }
      if (y10g > marginTop && y10g < height - marginBottom) {
        thresholdLines.push({ y: y10g, label: '10 g/l', color: '#ef4444' });
      }
    }

    // Y-Achsen-Labels
    const ySteps = 5;
    const yLabels = [];
    for (let i = 0; i <= ySteps; i++) {
      const val = minVal - padding + (range + 2 * padding) * (i / ySteps);
      const y = marginTop + chartHeight - (i / ySteps) * chartHeight;
      let label = val.toFixed(1);
      if (selectedChannel === 'ch2' && val >= 1000) label = `${(val / 1000).toFixed(1)}g`;
      yLabels.push({ y, label });
    }

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Grid */}
        {yLabels.map((yl, i) => (
          <g key={i}>
            <line x1={marginLeft} y1={yl.y} x2={width - 10} y2={yl.y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={marginLeft - 8} y={yl.y + 4} textAnchor="end" fill="#9ca3af" fontSize="11">{yl.label}</text>
          </g>
        ))}

        {/* Grenzwert-Linien */}
        {thresholdLines.map((tl, i) => (
          <g key={`th-${i}`}>
            <line x1={marginLeft} y1={tl.y} x2={width - 10} y2={tl.y} stroke={tl.color} strokeWidth="2" strokeDasharray="6,4" />
            <text x={width - 12} y={tl.y - 5} textAnchor="end" fill={tl.color} fontSize="11" fontWeight="600">{tl.label}</text>
          </g>
        ))}

        {/* Daten-Linie */}
        <polyline
          fill="none"
          stroke={info.color}
          strokeWidth="2"
          strokeLinejoin="round"
          points={points.join(' ')}
        />

        {/* Achsenbeschriftung */}
        <text x={marginLeft - 8} y={12} textAnchor="end" fill="#6b7280" fontSize="10">{info.unit}</text>
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aktuelle Werte */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* CH1 - Trübe */}
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-400">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">CH1 – Trübe</p>
            <span className="text-xs text-gray-400">NTU</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {latest?.ch1Ntu !== null ? latest?.ch1Ntu?.toFixed(2) : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {latest ? formatDate(latest.measuredAt) : 'Keine Daten'}
          </p>
        </div>

        {/* CH2 - Schwebstofffracht */}
        <div className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${
          latest?.ch2MgL > 10000 ? 'border-red-500' :
          latest?.ch2MgL > 5000 ? 'border-amber-500' : 'border-green-400'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">CH2 – Schwebstoff</p>
            <span className="text-xs text-gray-400">mg/l</span>
          </div>
          <p className={`text-2xl font-bold ${
            latest?.ch2MgL > 10000 ? 'text-red-600' :
            latest?.ch2MgL > 5000 ? 'text-amber-600' : 'text-gray-900'
          }`}>
            {latest?.ch2MgL !== null ? formatValue(latest?.ch2MgL, 'mg/l') : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Grenzwert: 5 g/l (Bau) · Max: 10 g/l
          </p>
        </div>

        {/* CH32 - Batterie */}
        <div className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${
          latest?.ch32Voltage < 11 ? 'border-red-400' : 'border-blue-400'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">CH32 – Batterie</p>
            <span className="text-xs text-gray-400">Volt</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {latest?.ch32Voltage !== null ? `${latest?.ch32Voltage?.toFixed(2)} V` : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Messsonde &quot;Ende&quot;
          </p>
        </div>
      </div>

      {/* Statistik-Zeile */}
      {stats && stats.totalMeasurements > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Statistik ({stats.period})</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-gray-900">{stats.totalMeasurements}</p>
              <p className="text-xs text-gray-500">Messungen</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{stats.ch1?.avgNtu?.toFixed(1) || '—'}</p>
              <p className="text-xs text-gray-500">Ø Trübe (NTU)</p>
            </div>
            <div>
              <p className={`text-lg font-bold ${stats.ch2?.thresholdExceeded5g > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {stats.ch2?.thresholdExceeded5g || 0}
              </p>
              <p className="text-xs text-gray-500">&gt; 5 g/l Überschreitungen</p>
            </div>
            <div>
              <p className={`text-lg font-bold ${stats.ch2?.thresholdExceeded10g > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {stats.ch2?.thresholdExceeded10g || 0}
              </p>
              <p className="text-xs text-gray-500">&gt; 10 g/l Überschreitungen</p>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          {/* Kanal-Auswahl */}
          <div className="flex gap-1">
            {Object.entries(CHANNEL_INFO).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setSelectedChannel(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedChannel === key
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={selectedChannel === key ? { backgroundColor: info.color } : {}}
              >
                {info.label}
              </button>
            ))}
          </div>

          {/* Zeitraum */}
          <div className="flex gap-1">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.days}
                onClick={() => setTimeRange(tr.days)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  timeRange === tr.days
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Chart */}
        <div className="border rounded-lg bg-gray-50 p-2 overflow-hidden">
          {data.length > 0 ? renderChart() : (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <p className="text-sm">Noch keine Messdaten vorhanden</p>
              <p className="text-xs mt-1">Importiere Daten über den Datenserver-Tab</p>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-2">
          {CHANNEL_INFO[selectedChannel].description} · Messsonde &quot;Ende&quot;
        </p>
      </div>

      {/* Datentabelle (letzte 20 Einträge) */}
      {data.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Letzte Messwerte</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Zeitpunkt</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Trübe (NTU)</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Schwebstoff</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Batterie (V)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.slice(0, 20).map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">{formatDate(d.measuredAt)}</td>
                    <td className="px-4 py-2 text-right font-mono">{d.ch1Ntu?.toFixed(2) ?? '—'}</td>
                    <td className={`px-4 py-2 text-right font-mono ${
                      d.ch2MgL > 10000 ? 'text-red-600 font-bold' :
                      d.ch2MgL > 5000 ? 'text-amber-600 font-semibold' : ''
                    }`}>
                      {d.ch2MgL !== null ? formatValue(d.ch2MgL, 'mg/l') : '—'}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${d.ch32Voltage < 11 ? 'text-red-500' : ''}`}>
                      {d.ch32Voltage?.toFixed(2) ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Datenquelle-Info */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <div className="text-xs text-gray-500">
            <p className="font-medium text-gray-600 mb-1">Datenquelle</p>
            <p>Messsonde &quot;Ende&quot; – Aktualisierung täglich um 08:00 Uhr</p>
            <p className="mt-1">CH1: Trübe (NTU) · CH2: Schwebstofffracht (mg/l) · CH32: Batteriespannung (V)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
