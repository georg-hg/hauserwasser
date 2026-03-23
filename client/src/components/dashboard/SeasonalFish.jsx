import { isInClosedSeason } from '../../utils/seasonCheck';
import { FISH_SPECIES, getSpeciesColor } from '../../utils/fishSpecies';

const BESATZ_DATUM = new Date('2026-04-10');

export default function SeasonalFish() {
  const now = new Date();
  const daysUntilBesatz = Math.ceil((BESATZ_DATUM - now) / (1000 * 60 * 60 * 24));
  const besatzStr = BESATZ_DATUM.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const available = FISH_SPECIES
    .filter((sp) => {
      const { closed } = isInClosedSeason(sp.key, now);
      return !closed;
    })
    .map((sp) => ({
      ...sp,
      minSize: isInClosedSeason(sp.key, now).minSize,
    }));

  const inSchonzeit = FISH_SPECIES
    .filter((sp) => {
      const { closed } = isInClosedSeason(sp.key, now);
      return closed;
    });

  if (available.length === 0) return null;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Aktuell befischbar
        </h2>
        {daysUntilBesatz > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="text-[11px] font-medium text-blue-700">
              Besatz {besatzStr}
            </span>
            <span className="text-[10px] text-blue-500">
              in {daysUntilBesatz} Tagen
            </span>
          </div>
        )}
        {daysUntilBesatz === 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 border border-green-200">
            <span className="text-[11px] font-semibold text-green-700">Besatz heute!</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {available.map((sp) => (
          <span
            key={sp.key}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-green-50 text-green-800 border border-green-200"
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getSpeciesColor(sp.key) }}
            />
            {sp.german}
            {sp.minSize && <span className="text-green-500 font-normal">({sp.minSize}cm)</span>}
          </span>
        ))}
      </div>

      {inSchonzeit.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-1.5">In Schonzeit:</p>
          <div className="flex flex-wrap gap-1.5">
            {inSchonzeit.map((sp) => (
              <span
                key={sp.key}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-400 border border-red-100"
              >
                {sp.german}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
