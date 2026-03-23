import { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { api } from '../../api/client';

// Revier-Center für initiale Kartenansicht
const REVIER_CENTER = { lat: 48.124, lng: 14.218 };
const MAP_CONTAINER = { width: '100%', height: '100%' };
const MAP_OPTIONS = {
  mapTypeId: 'satellite',
  mapTypeControl: false,
  zoomControl: true,
  streetViewControl: false,
  fullscreenControl: true,
  gestureHandling: 'greedy',
};

function FisherMap({ fishers }) {
  const [activeMarker, setActiveMarker] = useState(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  });

  // Nur Fischer mit Position
  const withPosition = fishers.filter(
    (f) => f.fishingDay?.lastPosition?.latitude && f.fishingDay?.lastPosition?.longitude
  );

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-[300px] bg-gray-100 rounded-lg">
        <p className="text-red-500 text-sm">Karte konnte nicht geladen werden.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[300px] bg-gray-100 rounded-lg animate-pulse">
        <p className="text-gray-400 text-sm">Karte wird geladen...</p>
      </div>
    );
  }

  if (withPosition.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <div className="text-center">
          <svg className="w-8 h-8 text-gray-300 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <p className="text-xs text-gray-400">Keine GPS-Positionen verfügbar</p>
          <p className="text-[10px] text-gray-300 mt-0.5">Position wird beim Erfassen eines Fangs gespeichert</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[300px] md:h-[400px] rounded-lg overflow-hidden shadow-lg">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER}
        center={withPosition.length === 1
          ? { lat: parseFloat(withPosition[0].fishingDay.lastPosition.latitude), lng: parseFloat(withPosition[0].fishingDay.lastPosition.longitude) }
          : REVIER_CENTER
        }
        zoom={15}
        options={MAP_OPTIONS}
      >
        {withPosition.map((f) => {
          const pos = {
            lat: parseFloat(f.fishingDay.lastPosition.latitude),
            lng: parseFloat(f.fishingDay.lastPosition.longitude),
          };
          return (
            <Marker
              key={f.id}
              position={pos}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: f.online ? '#10B981' : '#F59E0B',
                fillOpacity: 1,
                strokeWeight: 3,
                strokeColor: '#fff',
                scale: 10,
              }}
              title={`${f.firstName} ${f.lastName}`}
              onClick={() => setActiveMarker(f.id)}
            >
              {activeMarker === f.id && (
                <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                  <div className="p-1 min-w-[140px]">
                    <p className="font-bold text-sm text-gray-900">
                      {f.lastName} {f.firstName}
                    </p>
                    <div className="mt-1 space-y-0.5">
                      {f.fishingDay.technique && (
                        <p className="text-xs text-gray-600">
                          Technik: {f.fishingDay.technique}
                        </p>
                      )}
                      <p className="text-xs text-gray-600">
                        {f.fishingDay.catchCount} {f.fishingDay.catchCount === 1 ? 'Fang' : 'Fänge'}
                      </p>
                      {f.fishingDay.lastPosition.locationName && (
                        <p className="text-xs text-gray-400">
                          {f.fishingDay.lastPosition.locationName}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {f.online
                          ? '🟢 Online'
                          : '🟡 Zuletzt aktiv ' + timeAgoShort(f.lastSeen)
                        }
                      </p>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Marker>
          );
        })}
      </GoogleMap>
    </div>
  );
}

function timeAgoShort(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  return `vor ${hours} Std.`;
}

export default function AmWasser() {
  const [fishers, setFishers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(true);

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

      {/* Karte mit aktiven Fischern */}
      {activeFishers.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 pb-2 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              Fischer am Wasser
            </h3>
            <button
              onClick={() => setShowMap(!showMap)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showMap ? 'Karte ausblenden' : 'Karte einblenden'}
            </button>
          </div>
          {showMap && (
            <div className="px-4 pb-4">
              <FisherMap fishers={activeFishers} />
            </div>
          )}
        </div>
      )}

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
