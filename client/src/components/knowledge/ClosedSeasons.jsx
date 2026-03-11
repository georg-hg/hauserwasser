import { useState, useEffect } from 'react';
import { api } from '../../api/client';

/**
 * Vorkommen-Wahrscheinlichkeiten & Habitat-Voraussetzungen
 * für den Kremsabschnitt Piberbach–Neuhofen (Untere Forellenregion / Äschenregion)
 *
 * Basierend auf: Fischregion, Gewässercharakteristik (Mäandrierung, Temperatur,
 * Substrat, Strömung), landwirtschaftlichem Eintrag und Durchgängigkeit.
 */
const FISH_HABITAT = {
  brown_trout: {
    probability: 85,
    label: 'Leitart',
    habitat: 'Kühles, sauerstoffreiches Wasser (< 18°C), kiesiges Substrat für Laichgruben, beschattete Uferbereiche, Verstecke unter Wurzeln und Steinen.',
    kremsNote: 'Die Krems bietet als typisches Forellengewässer ideale Bedingungen. Der naturnahe Abschnitt mit Mäandern und kiesigem Grund ist optimaler Lebensraum.',
  },
  rainbow_trout: {
    probability: 70,
    label: 'Häufig (Besatz)',
    habitat: 'Toleranter als Bachforelle bei Temperatur (bis 22°C), bevorzugt stärkere Strömung und mittlere Tiefen mit kiesig-steinigem Grund.',
    kremsNote: 'Kommt überwiegend aus Besatz vor. Die Krems bietet geeignete Strömungsverhältnisse, natürliche Reproduktion ist eingeschränkt.',
  },
  char: {
    probability: 50,
    label: 'Mäßig (Besatz)',
    habitat: 'Sehr kaltes, sauerstoffreiches Wasser (< 16°C), bevorzugt tiefere Gumpen und Kolke, sauberer kiesiger bis steiniger Untergrund.',
    kremsNote: 'In der Krems primär durch Besatz. Sommerhitze kann kritisch werden. Am ehesten in tieferen, beschatteten Abschnitten.',
  },
  grayling: {
    probability: 40,
    label: 'Selten',
    habitat: 'Klares, sauerstoffreiches Wasser (12–18°C), sandige bis feinschotterige Laichplätze, moderate Strömung, geringe Trübung.',
    kremsNote: 'Die Äsche ist Indikator für gute Wasserqualität. Der Kremsabschnitt liegt im Übergangsbereich zur Äschenregion. Bestand empfindlich gegenüber Sedimenteintrag aus Landwirtschaft.',
  },
  pike: {
    probability: 15,
    label: 'Sehr selten',
    habitat: 'Ruhige Fließstrecken oder Altarme, Unterwasserpflanzen als Laichsubstrat, Versteckmöglichkeiten (Krautbetten, Totholz).',
    kremsNote: 'Die Krems ist kein typisches Hechtgewässer. Einzelne Exemplare in ruhigeren Abschnitten möglich, aber kein reproduktiver Bestand.',
  },
  carp: {
    probability: 10,
    label: 'Sehr selten',
    habitat: 'Langsam fließende bis stehende Gewässer, weicher Bodengrund, Wassertemperatur > 18°C zum Laichen, Wasserpflanzen.',
    kremsNote: 'Die Krems ist zu schnell fließend und kühl für einen stabilen Karpfenbestand. Vereinzelt verdriftete Exemplare aus Teichen möglich.',
  },
  zander: {
    probability: 5,
    label: 'Extrem selten',
    habitat: 'Trübes, tiefes Wasser, Sand- oder Kiesgrund zum Laichen, Wassertemperatur > 12°C, bevorzugt größere Flüsse und Seen.',
    kremsNote: 'Die Krems ist zu klein und klar für den Zander. Einzelfänge wären absolute Ausnahmen und deuten auf Verdriftung hin.',
  },
  barbel: {
    probability: 30,
    label: 'Gelegentlich',
    habitat: 'Kiesig-steiniges Substrat, moderate bis starke Strömung, tiefere Rinnen, Wassertemperatur 10–22°C.',
    kremsNote: 'In der Übergangszone zur Barbenregion einzelne Bestände möglich. Benötigt durchgängige Wanderstrecken und saubere Kiesbänke.',
  },
  chub: {
    probability: 75,
    label: 'Häufig',
    habitat: 'Anpassungsfähig: von kühlen Bächen bis warme Flüsse, bevorzugt strukturreiche Ufer, Totholz, überhängende Vegetation.',
    kremsNote: 'Der Aitel ist einer der häufigsten Fische der Krems. Profitiert von Nährstoffeintrag und ist sehr anpassungsfähig.',
  },
  perch: {
    probability: 35,
    label: 'Gelegentlich',
    habitat: 'Strukturreiche Ufer, Stillwasserzonen, Wasserpflanzen, tolerant bei Temperatur (5–25°C), opportunistischer Jäger.',
    kremsNote: 'In ruhigeren Abschnitten und Kolken der Krems anzutreffen. Kein dominanter Bestand, aber regelmäßige Vorkommen.',
  },
  huchen: {
    probability: 3,
    label: 'Extrem selten',
    habitat: 'Große, unverbaute Flussabschnitte (> 15m Breite), tiefe Gumpen, kiesige Laichplätze, ganzjährig kühles Wasser, ungestörte Wanderkorridore.',
    kremsNote: 'Die Krems ist für den Huchen zu klein. Extrem seltene Zuwanderung aus dem Traunsystem theoretisch möglich. Ganzjährig geschont.',
  },
};

const PROBABILITY_COLORS = {
  high: { bar: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  medium: { bar: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  low: { bar: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700' },
  rare: { bar: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-600' },
};

function getProbabilityColor(pct) {
  if (pct >= 60) return PROBABILITY_COLORS.high;
  if (pct >= 30) return PROBABILITY_COLORS.medium;
  if (pct >= 15) return PROBABILITY_COLORS.low;
  return PROBABILITY_COLORS.rare;
}

export default function ClosedSeasons() {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedFish, setExpandedFish] = useState(null);

  useEffect(() => {
    api.get('/api/seasons')
      .then(setSeasons)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function toggleExpand(species) {
    setExpandedFish(expandedFish === species ? null : species);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 md:py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Schonzeiten & Mindestmasse</h1>
      <p className="text-sm text-gray-500 mb-4">
        Gem. Fischereierlaubnis Hauserwasser 2026 (mit Sondermassen)
      </p>

      {/* Tabelle Desktop */}
      <div className="hidden md:block card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3 font-semibold text-gray-700">Fischart</th>
              <th className="text-center p-3 font-semibold text-gray-700">Vorkommen</th>
              <th className="text-center p-3 font-semibold text-gray-700">Mindestmass</th>
              <th className="text-center p-3 font-semibold text-gray-700">Schonzeit</th>
              <th className="text-center p-3 font-semibold text-gray-700">Status</th>
              <th className="text-center p-3 font-semibold text-gray-700">Limit</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => {
              const habitat = FISH_HABITAT[s.fish_species];
              const isExpanded = expandedFish === s.fish_species;
              const color = habitat ? getProbabilityColor(habitat.probability) : null;

              return (
                <tr key={s.id} className="border-b border-gray-100 last:border-0 group">
                  <td className="p-3">
                    <button
                      onClick={() => habitat && toggleExpand(s.fish_species)}
                      className="text-left w-full"
                    >
                      <span className="font-medium">{s.german_name}</span>
                      {habitat && (
                        <svg className={`inline-block w-3.5 h-3.5 ml-1 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                    {isExpanded && habitat && (
                      <div className="mt-2 p-2.5 bg-blue-50 rounded-lg text-xs space-y-1.5 border border-blue-100">
                        <p className="text-gray-700"><span className="font-semibold text-gray-800">Habitat:</span> {habitat.habitat}</p>
                        <p className="text-blue-700"><span className="font-semibold text-blue-800">Krems:</span> {habitat.kremsNote}</p>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {habitat ? (
                      <button
                        onClick={() => toggleExpand(s.fish_species)}
                        className="inline-flex flex-col items-center gap-0.5 cursor-pointer"
                        title={`${habitat.probability}% – ${habitat.label}`}
                      >
                        <span className={`text-xs font-bold ${color.text}`}>{habitat.probability}%</span>
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full ${color.bar} rounded-full`} style={{ width: `${habitat.probability}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400">{habitat.label}</span>
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">–</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {s.min_size_cm ? `${s.min_size_cm} cm` : '-'}
                  </td>
                  <td className="p-3 text-center text-gray-600">
                    {s.year_round
                      ? 'Ganzjaehrig'
                      : `${formatDate(s.season_start)} - ${formatDate(s.season_end)}`}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.isCurrentlyClosed
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {s.statusText}
                    </span>
                  </td>
                  <td className="p-3 text-center text-xs text-gray-500">
                    {formatLimit(s)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Karten Mobile */}
      <div className="md:hidden space-y-2">
        {seasons.map((s) => {
          const habitat = FISH_HABITAT[s.fish_species];
          const isExpanded = expandedFish === s.fish_species;
          const color = habitat ? getProbabilityColor(habitat.probability) : null;

          return (
            <div key={s.id} className={`card p-3 border-l-4 ${
              s.isCurrentlyClosed ? 'border-l-red-400' : 'border-l-green-400'
            }`}>
              <button
                onClick={() => habitat && toggleExpand(s.fish_species)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{s.german_name}</span>
                    {habitat && (
                      <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.isCurrentlyClosed
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {s.statusText}
                  </span>
                </div>

                {/* Vorkommen-Balken */}
                {habitat && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-xs font-bold ${color.text} min-w-[32px]`}>{habitat.probability}%</span>
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full ${color.bar} rounded-full`} style={{ width: `${habitat.probability}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400 min-w-[60px] text-right">{habitat.label}</span>
                  </div>
                )}
              </button>

              <div className="mt-1.5 grid grid-cols-2 gap-x-4 text-xs text-gray-600">
                <span>Mindestmass: {s.min_size_cm ? `${s.min_size_cm} cm` : '-'}</span>
                <span>
                  {s.year_round
                    ? 'Ganzjaehrig geschont'
                    : `${formatDate(s.season_start)} - ${formatDate(s.season_end)}`}
                </span>
              </div>
              {s.notes && <p className="mt-1 text-xs text-gray-400">{s.notes}</p>}

              {/* Expandierte Habitat-Info */}
              {isExpanded && habitat && (
                <div className="mt-2.5 p-2.5 bg-blue-50 rounded-lg text-xs space-y-1.5 border border-blue-100">
                  <p className="text-gray-700"><span className="font-semibold text-gray-800">Habitat:</span> {habitat.habitat}</p>
                  <p className="text-blue-700"><span className="font-semibold text-blue-800">Krems:</span> {habitat.kremsNote}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
        <p className="text-sm text-red-700 font-medium">
          Huchen ist ganzjaehrig geschont und darf nicht entnommen werden!
        </p>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Quelle: Fischereierlaubnis Hauserwasser 2026. Es gelten die Schonzeiten gem.
        OOe Lizenzbuch mit Ausnahme Forelle & Saibling (Sondermass 26 cm).
        Weitere Infos: lfvooe.at
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Vorkommen-Wahrscheinlichkeiten: Schätzung basierend auf Fischregion (Untere Forellenregion / Äschenregion),
        Gewässercharakteristik und limnologischen Referenzwerten für die Krems im Abschnitt Piberbach–Neuhofen.
      </p>
    </div>
  );
}

function formatDate(mmdd) {
  if (!mmdd) return '';
  const [m, d] = mmdd.split('-');
  return `${d}.${m}.`;
}

function formatLimit(s) {
  const parts = [];
  if (s.max_per_day) parts.push(`${s.max_per_day}/Tag`);
  if (s.max_per_year) parts.push(`${s.max_per_year}/Jahr`);
  return parts.join(', ') || 'unbegr.';
}
