import { useAuth } from '../../hooks/useAuth';
import { useCatches } from '../../hooks/useCatches';
import { useGeolocation } from '../../hooks/useGeolocation';
import MapComponent from '../map/MapComponent';
import QuotaTracker from './QuotaTracker';
import StatsCard from './StatsCard';
import WaterWidget from './WaterWidget';
import WeatherWidget from './WeatherWidget';
import MonitoringWidget from './MonitoringWidget';
import SeasonalFish from './SeasonalFish';

export default function Dashboard() {
  const { user } = useAuth();
  const { catches, stats, loading } = useCatches();
  const { position } = useGeolocation();

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          Servus, {user?.firstName}!
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Saison 2026 &middot; Revier Hauserwasser (Krems)
        </p>
      </div>

      {/* Statistik-Karten */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <StatsCard
            label="Fischtage"
            value={stats.fishingDays.total}
            max={stats.fishingDays.maxSeason}
            sub={`${stats.fishingDays.thisWeek}/3 diese Woche`}
          />
          <StatsCard
            label="Gesamtfaenge"
            value={stats.totals?.total || 0}
            sub={`${stats.totals?.kept || 0} entnom. / ${stats.totals?.released || 0} zurueck`}
          />
        </div>
      )}

      {/* Quoten-Warnung */}
      {stats && <QuotaTracker stats={stats} />}

      {/* Aktuell befischbare Arten */}
      <SeasonalFish />

      {/* Gewässerdaten Krems (Pegelstand, Durchfluss, Temperatur) */}
      <WaterWidget />

      {/* Sedimentmonitoring Krems (Trübe + Schwebstoff + Trend) */}
      <MonitoringWidget />

      {/* Karte mit allen Faengen */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 pb-2">
          <h2 className="font-semibold text-gray-800">Deine Fangorte</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Revier: Krems samt Fischlmayrbach (ON 30/5)
          </p>
        </div>
        <MapComponent
          catches={catches}
          currentPosition={position}
          height="h-[300px] md:h-[450px]"
        />
      </div>

      {/* Wetter Piberbach (aktuell + 3 Tage) */}
      <WeatherWidget />

      {/* Letzte Faenge */}
      {catches.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-3">Letzte Faenge</h2>
          <div className="space-y-2">
            {catches.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                {c.photo_url ? (
                  <img src={c.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                    Foto
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">
                    {c.german_name || c.fish_species}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(c.catch_date).toLocaleDateString('de-AT')}
                    {c.length_cm && ` · ${c.length_cm} cm`}
                    {c.kept ? ' · entnommen' : ' · zurueckgesetzt'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      )}
    </div>
  );
}
