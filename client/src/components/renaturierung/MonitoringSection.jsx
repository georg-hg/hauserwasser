import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api/client';

const CHANNEL_INFO = {
  ch1: { label: 'Trübe (NTU)', color: '#f59e0b', unit: 'NTU', description: 'Trübungsmessung' },
  ch2: { label: 'Schwebstofffracht', color: '#ef4444', unit: 'mg/l', description: 'Grenzwert: 5 g/l (Bau), Max: 10 g/l (Tag)' },
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
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const svgRef = useRef(null);

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

  // Maus-Position → nächster Datenpunkt
  const handleMouseMove = useCallback((e, chartData, marginLeft, chartWidth) => {
    if (!svgRef.current || chartData.length === 0) return;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 800; // viewBox-Koordinaten
    const relX = mouseX - marginLeft;
    if (relX < 0 || relX > chartWidth) { setHoveredIdx(null); return; }
    const idx = Math.round((relX / chartWidth) * (chartData.length - 1));
    setHoveredIdx(Math.max(0, Math.min(idx, chartData.length - 1)));
  }, []);

  // SVG-Chart Komponente
  const renderChart = () => {
    if (data.length === 0) return null;

    const chartData = [...data].reverse(); // chronologisch
    const channelKey = selectedChannel === 'ch1' ? 'ch1Ntu' : 'ch2MgL';
    const info = CHANNEL_INFO[selectedChannel];
    const values = chartData.map(d => d[channelKey]).filter(v => v !== null);

    if (values.length === 0) {
      return (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          Keine Daten für {info.label} vorhanden
        </div>
      );
    }

    const dataMax = Math.max(...values);

    // Y-Achse an die tatsächlichen Daten anpassen
    const scaleMin = 0;
    const dataCeiling = dataMax || 1;
    let scaleMax;

    if (selectedChannel === 'ch2') {
      if (dataMax > 10000) {
        scaleMax = dataMax * 1.15;
      } else if (dataMax > 5000) {
        scaleMax = Math.max(dataMax * 1.15, 11000);
      } else {
        scaleMax = dataCeiling * 1.3;
      }
    } else {
      scaleMax = dataCeiling * 1.15;
    }

    const scaleRange = scaleMax - scaleMin || 1;

    const width = 800;
    const height = 310;
    const marginLeft = 60;
    const marginBottom = 55; // Mehr Platz für X-Achse
    const marginTop = 20;
    const chartWidth = width - marginLeft - 10;
    const chartHeight = height - marginBottom - marginTop;

    const toY = (val) => marginTop + chartHeight - ((val - scaleMin) / scaleRange) * chartHeight;
    const toX = (i) => marginLeft + (i / (chartData.length - 1 || 1)) * chartWidth;
    const chartRight = width - 10;
    const chartBottom = marginTop + chartHeight;

    const points = chartData
      .map((d, i) => {
        const val = d[channelKey];
        if (val === null) return null;
        return `${toX(i)},${toY(val)}`;
      })
      .filter(Boolean);

    // Y-Achsen-Labels
    const ySteps = 5;
    const yLabels = [];
    for (let i = 0; i <= ySteps; i++) {
      const val = scaleMin + scaleRange * (i / ySteps);
      let label;
      if (selectedChannel === 'ch2') {
        if (val >= 1000) label = `${(val / 1000).toFixed(1)} g/l`;
        else label = `${val.toFixed(val < 10 ? 1 : 0)} mg/l`;
      } else {
        label = val.toFixed(1);
      }
      yLabels.push({ y: toY(val), label });
    }

    // X-Achsen-Labels (Datum)
    const xLabelCount = Math.min(chartData.length, 6);
    const xLabels = [];
    for (let i = 0; i < xLabelCount; i++) {
      const dataIdx = xLabelCount <= 1 ? 0 : Math.round(i * (chartData.length - 1) / (xLabelCount - 1));
      const d = chartData[dataIdx];
      if (!d?.measuredAt) continue;
      const date = new Date(d.measuredAt);
      const label = date.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });
      const time = date.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
      xLabels.push({ x: toX(dataIdx), label, time });
    }

    // CH2 Grenzwert-Darstellung
    const renderCh2Thresholds = () => {
      if (selectedChannel !== 'ch2') return null;

      const y5g = toY(5000);
      const y10g = toY(10000);
      const is5gVisible = y5g >= marginTop && y5g <= chartBottom;
      const is10gVisible = y10g >= marginTop && y10g <= chartBottom;

      if (is5gVisible || is10gVisible) {
        const yBottom = toY(0);
        const clamp = (y) => Math.max(marginTop, Math.min(y, yBottom));

        return (
          <g>
            <rect x={marginLeft} y={clamp(y5g)} width={chartWidth} height={clamp(yBottom) - clamp(y5g)} fill="#dcfce7" opacity="0.45" />
            {is5gVisible && (
              <rect x={marginLeft} y={clamp(y10g)} width={chartWidth} height={clamp(y5g) - clamp(y10g)} fill="#fef3c7" opacity="0.45" />
            )}
            {is10gVisible && (
              <rect x={marginLeft} y={marginTop} width={chartWidth} height={clamp(y10g) - marginTop} fill="#fee2e2" opacity="0.45" />
            )}
            {is5gVisible && (
              <g>
                <line x1={marginLeft} y1={y5g} x2={chartRight} y2={y5g} stroke="#d97706" strokeWidth="2" strokeDasharray="8,4" />
                <rect x={chartRight - 108} y={y5g - 18} width={106} height={16} rx="3" fill="#d97706" />
                <text x={chartRight - 55} y={y5g - 7} textAnchor="middle" fill="white" fontSize="10" fontWeight="600">Grenzwert 5 g/l</text>
              </g>
            )}
            {is10gVisible && (
              <g>
                <line x1={marginLeft} y1={y10g} x2={chartRight} y2={y10g} stroke="#dc2626" strokeWidth="2" strokeDasharray="8,4" />
                <rect x={chartRight - 85} y={y10g - 18} width={83} height={16} rx="3" fill="#dc2626" />
                <text x={chartRight - 43} y={y10g - 7} textAnchor="middle" fill="white" fontSize="10" fontWeight="600">Max 10 g/l</text>
              </g>
            )}
          </g>
        );
      }

      return (
        <g>
          <rect x={marginLeft} y={marginTop} width={chartWidth} height={chartHeight} fill="#dcfce7" opacity="0.3" />
          <g>
            <rect x={marginLeft + 4} y={marginTop + 4} width={148} height={20} rx="4" fill="#d97706" opacity="0.9" />
            <text x={marginLeft + 12} y={marginTop + 17} fill="white" fontSize="10" fontWeight="600">
              ▲ Grenzwert Bau: 5 g/l
            </text>
          </g>
          <g>
            <rect x={marginLeft + 160} y={marginTop + 4} width={148} height={20} rx="4" fill="#dc2626" opacity="0.9" />
            <text x={marginLeft + 168} y={marginTop + 17} fill="white" fontSize="10" fontWeight="600">
              ▲ Max. Tageswert: 10 g/l
            </text>
          </g>
        </g>
      );
    };

    // Hover-Tooltip
    const renderHover = () => {
      if (hoveredIdx === null || !chartData[hoveredIdx]) return null;
      const d = chartData[hoveredIdx];
      const val = d[channelKey];
      if (val === null) return null;

      const hx = toX(hoveredIdx);
      const hy = toY(val);
      const date = new Date(d.measuredAt);
      const dateStr = date.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
      const valStr = formatValue(val, info.unit);

      // Tooltip-Position: links oder rechts vom Cursor
      const tooltipW = 150;
      const tooltipH = 44;
      const tooltipX = hx + tooltipW + 15 > width ? hx - tooltipW - 10 : hx + 10;
      const tooltipY = Math.max(marginTop, Math.min(hy - tooltipH / 2, chartBottom - tooltipH));

      return (
        <g>
          {/* Vertikale Linie */}
          <line x1={hx} y1={marginTop} x2={hx} y2={chartBottom} stroke="#6b7280" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
          {/* Punkt auf Datenlinie */}
          <circle cx={hx} cy={hy} r="5" fill={info.color} stroke="white" strokeWidth="2" />
          {/* Tooltip-Box */}
          <rect x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH} rx="6" fill="white" stroke="#e5e7eb" strokeWidth="1" filter="url(#tooltip-shadow)" />
          <text x={tooltipX + 10} y={tooltipY + 16} fill="#374151" fontSize="11" fontWeight="600">{valStr}</text>
          <text x={tooltipX + 10} y={tooltipY + 32} fill="#9ca3af" fontSize="10">{dateStr}, {timeStr}</text>
        </g>
      );
    };

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={(e) => handleMouseMove(e, chartData, marginLeft, chartWidth)}
        onMouseLeave={() => setHoveredIdx(null)}
        style={{ cursor: 'crosshair' }}
      >
        <defs>
          <clipPath id="chart-clip">
            <rect x={marginLeft} y={marginTop} width={chartWidth} height={chartHeight} />
          </clipPath>
          <filter id="tooltip-shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Hintergrund & Grenzwerte (CH2) */}
        <g clipPath="url(#chart-clip)">
          {renderCh2Thresholds()}
        </g>

        {/* Grid */}
        {yLabels.map((yl, i) => (
          <g key={i}>
            <line x1={marginLeft} y1={yl.y} x2={chartRight} y2={yl.y} stroke="#e5e7eb" strokeWidth="0.5" />
            <text x={marginLeft - 8} y={yl.y + 4} textAnchor="end" fill="#9ca3af" fontSize="11">{yl.label}</text>
          </g>
        ))}

        {/* X-Achse: Datum-Labels */}
        {xLabels.map((xl, i) => (
          <g key={`x-${i}`}>
            <line x1={xl.x} y1={chartBottom} x2={xl.x} y2={chartBottom + 5} stroke="#d1d5db" strokeWidth="1" />
            <text x={xl.x} y={chartBottom + 17} textAnchor="middle" fill="#9ca3af" fontSize="10">{xl.label}</text>
            <text x={xl.x} y={chartBottom + 29} textAnchor="middle" fill="#c4c8cf" fontSize="9">{xl.time}</text>
          </g>
        ))}

        {/* Daten-Linie */}
        <polyline
          fill="none"
          stroke={info.color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.join(' ')}
          clipPath="url(#chart-clip)"
        />

        {/* Hover-Interaktion */}
        {renderHover()}

        {/* Unsichtbare Hover-Fläche über dem Chart */}
        <rect
          x={marginLeft} y={marginTop}
          width={chartWidth} height={chartHeight}
          fill="transparent"
          onMouseMove={(e) => handleMouseMove(e, chartData, marginLeft, chartWidth)}
          onMouseLeave={() => setHoveredIdx(null)}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* Legende für CH2 Grenzwerte */}
        {selectedChannel === 'ch2' && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-green-100 border border-green-300" />
              <span className="text-gray-600">&lt; 5 g/l – OK</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-amber-100 border border-amber-300" />
              <span className="text-gray-600">5 – 10 g/l – Grenzwert Bau überschritten</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-red-100 border border-red-300" />
              <span className="text-gray-600">&gt; 10 g/l – Max. Tageshöchstwert überschritten</span>
            </div>
          </div>
        )}

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
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Schwebstoff (g/l)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.slice(0, 20).map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">{formatDate(d.measuredAt)}</td>
                    <td className="px-4 py-2 text-right font-mono">{d.ch1Ntu?.toFixed(2) ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      {d.ch2MgL !== null ? (
                        <span className={`inline-flex items-center gap-1 font-mono ${
                          d.ch2MgL > 10000 ? 'text-red-600 font-bold' :
                          d.ch2MgL > 5000 ? 'text-amber-600 font-semibold' : ''
                        }`}>
                          {d.ch2MgL > 10000 && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                          {d.ch2MgL > 5000 && d.ch2MgL <= 10000 && <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />}
                          {formatValue(d.ch2MgL, 'mg/l')}
                        </span>
                      ) : '—'}
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
            <p className="mt-1">CH1: Trübe (NTU) · CH2: Schwebstofffracht (mg/l)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
