import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d', '#4f46e5'];
const MONTH_COLORS = { kept: '#059669', released: '#60a5fa' };

export default function AdminStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    api.get(`/api/admin/stats?season=${currentYear}`)
      .then(data => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentYear]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-center text-gray-500 py-8">Keine Statistiken verfügbar.</p>;
  }

  const { totals, catchesPerMonth, topSpecies, fisherActivity, dayStats } = stats;

  // Pie-Chart Daten: Tage mit/ohne Fang
  const dayPieData = [
    { name: 'Mit Fang', value: dayStats.days_with_catch },
    { name: 'Ohne Fang', value: dayStats.days_without_catch },
  ];
  const DAY_PIE_COLORS = ['#059669', '#e5e7eb'];

  return (
    <div className="space-y-6">
      {/* KPI-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Fischer" value={totals.fisherCount} icon="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2 2 0 013 17.16V16.5c0-2.697 1.616-5.017 3.927-6.04A6.03 6.03 0 0112 9c2.31 0 4.308 1.304 5.313 3.216M15 19.128" color="blue" />
        <KpiCard label="Fischtage" value={totals.totalDays} icon="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" color="emerald" />
        <KpiCard label="Gesamtfänge" value={totals.totalCatches} icon="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" color="amber" />
        <KpiCard label="Entnommen" value={totals.totalKept} icon="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" color="red" />
      </div>

      {/* Fänge pro Monat — Balkendiagramm */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Fänge pro Monat</h3>
        <div className="h-64 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={catchesPerMonth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                formatter={(value, name) => [value, name === 'kept' ? 'Entnommen' : 'Zurückgesetzt']}
              />
              <Legend formatter={(value) => value === 'kept' ? 'Entnommen' : 'Zurückgesetzt'} />
              <Bar dataKey="kept" stackId="a" fill={MONTH_COLORS.kept} radius={[0, 0, 0, 0]} />
              <Bar dataKey="released" stackId="a" fill={MONTH_COLORS.released} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zwei Spalten: Fischarten + Fischtage-Verteilung */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Fischarten — Pie Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Fischarten</h3>
          {topSpecies.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Noch keine Fänge</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topSpecies}
                    dataKey="count"
                    nameKey="species"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ species, count }) => `${species} (${count})`}
                    labelLine={false}
                  >
                    {topSpecies.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Fänge']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Fischtage: Mit/Ohne Fang — Donut */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Fischtage-Erfolgsquote</h3>
          {dayStats.total_days === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Noch keine Fischtage</p>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dayPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                    >
                      {dayPieData.map((_, i) => (
                        <Cell key={i} fill={DAY_PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Tage']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 text-sm mt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
                  Mit Fang: {dayStats.days_with_catch}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />
                  Ohne Fang: {dayStats.days_without_catch}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Aktivität pro Fischer — Balkendiagramm */}
      {fisherActivity.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Aktivität pro Fischer</h3>
          <div className="h-64 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fisherActivity} layout="vertical" margin={{ top: 5, right: 10, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis dataKey="fisher" type="category" tick={{ fontSize: 12 }} width={55} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                  formatter={(value, name) => [value, name === 'fishing_days' ? 'Fischtage' : 'Fänge']}
                />
                <Legend formatter={(value) => value === 'fishing_days' ? 'Fischtage' : 'Fänge'} />
                <Bar dataKey="fishing_days" fill="#2563eb" radius={[0, 4, 4, 0]} />
                <Bar dataKey="catches" fill="#d97706" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, color }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="card flex items-center gap-3 py-3">
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${colorMap[color]} flex items-center justify-center`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
