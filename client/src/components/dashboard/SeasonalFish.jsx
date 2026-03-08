import { isInClosedSeason } from '../../utils/seasonCheck';
import { FISH_SPECIES, getSpeciesColor } from '../../utils/fishSpecies';

export default function SeasonalFish() {
  const now = new Date();

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
      <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Aktuell befischbar
      </h2>
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
