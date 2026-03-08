import { getSpeciesColor } from '../../utils/fishSpecies';

export default function FishResult({ result }) {
  if (!result) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: getSpeciesColor(result.species) }}
      >
        {Math.round(result.confidence * 100)}%
      </div>
      <div>
        <p className="font-semibold text-sm">{result.speciesGerman}</p>
        <p className="text-xs text-gray-500">{result.speciesLatin}</p>
      </div>
    </div>
  );
}
