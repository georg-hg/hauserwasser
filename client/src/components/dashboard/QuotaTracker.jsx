export default function QuotaTracker({ stats }) {
  const warnings = [];

  if (stats.fishingDays.thisWeek >= 3) {
    warnings.push({ type: 'danger', text: 'Wochenlimit erreicht: 3/3 Fischtage diese Woche!' });
  } else if (stats.fishingDays.thisWeek >= 2) {
    warnings.push({ type: 'warning', text: `Noch ${3 - stats.fishingDays.thisWeek} Fischtag(e) diese Woche.` });
  }

  if (stats.fishingDays.total >= 36) {
    warnings.push({ type: 'danger', text: 'Saisonlimit erreicht: 36/36 Fischtage!' });
  } else if (stats.fishingDays.total >= 30) {
    warnings.push({ type: 'warning', text: `Noch ${36 - stats.fishingDays.total} Fischtage diese Saison.` });
  }

  if (stats.quotas.salmonidsKept >= 60) {
    warnings.push({ type: 'danger', text: 'Salmoniden-Saisonlimit erreicht: 60/60!' });
  } else if (stats.quotas.salmonidsKept >= 50) {
    warnings.push({ type: 'warning', text: `Noch ${60 - stats.quotas.salmonidsKept} Salmoniden bis zum Saisonlimit.` });
  }

  if (stats.quotas.pikeKept >= 1) {
    warnings.push({ type: 'info', text: 'Hecht: Jahresquote erreicht (1/1).' });
  }
  if (stats.quotas.zanderKept >= 1) {
    warnings.push({ type: 'info', text: 'Zander: Jahresquote erreicht (1/1).' });
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            w.type === 'danger'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : w.type === 'warning'
              ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}
        >
          <span className="font-medium">{w.type === 'danger' ? '!' : w.type === 'warning' ? '!' : 'i'}</span>
          <span>{w.text}</span>
        </div>
      ))}
    </div>
  );
}
