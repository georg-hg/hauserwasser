import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';

export default function AmWasser() {
  const [fishers, setFishers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/api/admin/am-wasser');
      setFishers(data);
    } catch (err) {
      console.error('Am-Wasser error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Alle 30 Sekunden aktualisieren
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  const activeFishers = fishers.filter(f => f.fishingDay);
  const onlineFishers = fishers.filter(f => f.online && !f.fishingDay);
  const offlineFishers = fishers.filter(f => !f.online && !f.fishingDay);

  return (
    <div className="space-y-6">
      {/* Zusammenfassung */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{activeFishers.length}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Am Wasser</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{fishers.filter(f => f.online).length}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Online</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-gray-400">{offlineFishers.length}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Offline</p>
        </div>
      </div>

      {/* Am Wasser — aktiver Fischtag */}
      {activeFishers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Am Wasser ({activeFishers.length})
          </h3>
          <div className="space-y-2">
            {activeFishers.map(f => (
              <FisherCard key={f.id} fisher={f} variant="active" />
            ))}
          </div>
        </div>
      )}

      {/* Online aber kein Fischtag */}
      {onlineFishers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            Online ({onlineFishers.length})
          </h3>
          <div className="space-y-2">
            {onlineFishers.map(f => (
              <FisherCard key={f.id} fisher={f} variant="online" />
            ))}
          </div>
        </div>
      )}

      {/* Offline */}
      {offlineFishers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            Offline ({offlineFishers.length})
          </h3>
          <div className="space-y-2">
            {offlineFishers.map(f => (
              <FisherCard key={f.id} fisher={f} variant="offline" />
            ))}
          </div>
        </div>
      )}

      {fishers.length === 0 && (
        <p className="text-center text-gray-400 py-8">Keine Fischer registriert.</p>
      )}

      <p className="text-[11px] text-gray-400 text-center">
        Automatische Aktualisierung alle 30 Sekunden
      </p>
    </div>
  );
}

function FisherCard({ fisher, variant }) {
  const { fishingDay } = fisher;
  const borderColor = variant === 'active' ? 'border-l-emerald-500' : variant === 'online' ? 'border-l-blue-500' : 'border-l-gray-200';

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'gerade eben';
    if (mins < 60) return `vor ${mins} Min.`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    return `vor ${Math.floor(hours / 24)} Tagen`;
  };

  return (
    <div className={`card border-l-4 ${borderColor} !py-3 !px-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Name + Status */}
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 text-sm truncate">
              {fisher.lastName} {fisher.firstName}
            </p>
            {fisher.online && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                online
              </span>
            )}
          </div>

          {/* Fischtag-Info */}
          {fishingDay && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Fischtag gestartet {timeAgo(fishingDay.startedAt)}
                </span>
                {fishingDay.technique && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">
                    {fishingDay.technique}
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium">
                  {fishingDay.catchCount} {fishingDay.catchCount === 1 ? 'Fang' : 'Fänge'}
                </span>
              </div>

              {/* Position */}
              {fishingDay.lastPosition && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  {fishingDay.lastPosition.locationName || (
                    <span>{fishingDay.lastPosition.latitude.toFixed(4)}, {fishingDay.lastPosition.longitude.toFixed(4)}</span>
                  )}
                  <a
                    href={`https://maps.google.com/?q=${fishingDay.lastPosition.latitude},${fishingDay.lastPosition.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-800 font-medium ml-1"
                    onClick={e => e.stopPropagation()}
                  >
                    Karte
                  </a>
                </div>
              )}

              {fishingDay.notes && (
                <p className="text-[11px] text-gray-400 italic truncate">{fishingDay.notes}</p>
              )}
            </div>
          )}

          {/* Letzte Aktivität (kein Fischtag) */}
          {!fishingDay && fisher.lastSeen && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              Zuletzt aktiv: {timeAgo(fisher.lastSeen)}
            </p>
          )}
          {!fishingDay && !fisher.lastSeen && (
            <p className="text-[11px] text-gray-400 mt-0.5">Noch nie angemeldet</p>
          )}
        </div>

        {/* Fischerkarten-Nr. */}
        {fisher.fisherCardNr && (
          <span className="flex-shrink-0 text-[10px] text-gray-400 font-mono">
            Nr. {fisher.fisherCardNr}
          </span>
        )}
      </div>
    </div>
  );
}
