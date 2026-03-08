import { getSpeciesGerman, getSpeciesColor } from '../../utils/fishSpecies';

export default function CatchCard({ catchData }) {
  const c = catchData;
  return (
    <div className="card flex items-center gap-3">
      <div
        className="w-3 h-12 rounded-full flex-shrink-0"
        style={{ backgroundColor: getSpeciesColor(c.fish_species) }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{c.german_name || getSpeciesGerman(c.fish_species)}</p>
        <p className="text-xs text-gray-500">
          {new Date(c.catch_date).toLocaleDateString('de-AT')}
          {c.length_cm && ` · ${c.length_cm} cm`}
        </p>
      </div>
      {c.photo_url && (
        <img src={c.photo_url} alt="" className="w-10 h-10 rounded object-cover" />
      )}
    </div>
  );
}
