export default function StatsCard({ label, value, max, sub }) {
  const percentage = max ? Math.min((parseInt(value) / max) * 100, 100) : null;
  const isWarning = percentage && percentage >= 80;
  const isDanger = percentage && percentage >= 95;

  return (
    <div className="card p-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">
        {value}
        {max && <span className="text-sm font-normal text-gray-400">/{max}</span>}
      </p>
      {percentage !== null && (
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isDanger ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-primary-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
