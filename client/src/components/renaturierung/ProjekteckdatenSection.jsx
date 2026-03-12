const ECKDATEN = [
  {
    icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
    title: 'Offizieller Baustart',
    text: 'Die feierliche Spatenstichfeier fand am 9. Jänner 2026 statt.',
    color: 'emerald',
  },
  {
    icon: 'M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.653-4.655m4.093-4.093L17.834 3.58a2.548 2.548 0 013.586 3.586l-4.907 4.908m-4.093-4.093a9.158 9.158 0 00-4.093 4.093',
    title: 'Bauzeitraum',
    text: 'Als generelle Bauzeit wird der Zeitraum von Herbst 2025 bis 2027 angegeben.',
    color: 'blue',
  },
  {
    icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    title: 'Fertigstellung',
    text: 'Die Fertigstellung ist bis Ende Dezember 2027 geplant. Der rechtsgültige wasserrechtliche Bescheid legt als allerletzte Frist für die Fertigstellung des Vorhabens den 22. Dezember 2027 fest.',
    color: 'amber',
  },
];

const WASSERBAU_MONATE = [
  { monat: 'Jän', erlaubt: true },
  { monat: 'Feb', erlaubt: true },
  { monat: 'Mär', erlaubt: true },
  { monat: 'Apr', erlaubt: false },
  { monat: 'Mai', erlaubt: false },
  { monat: 'Jun', erlaubt: false },
  { monat: 'Jul', erlaubt: true },
  { monat: 'Aug', erlaubt: true },
  { monat: 'Sep', erlaubt: true },
  { monat: 'Okt', erlaubt: true },
  { monat: 'Nov', erlaubt: false },
  { monat: 'Dez', erlaubt: false },
];

const COLOR_MAP = {
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: 'text-emerald-600',
    title: 'text-emerald-800',
    text: 'text-emerald-700',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    title: 'text-blue-800',
    text: 'text-blue-700',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-600',
    title: 'text-amber-800',
    text: 'text-amber-700',
  },
};

export default function ProjekteckdatenSection() {
  return (
    <div className="space-y-6">
      {/* Projekteckdaten Karten */}
      <div className="space-y-4">
        {ECKDATEN.map((item, idx) => {
          const c = COLOR_MAP[item.color];
          return (
            <div key={idx} className={`${c.bg} border ${c.border} rounded-xl p-4`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <svg className={`w-5 h-5 ${c.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </div>
                <div>
                  <h3 className={`text-sm font-semibold ${c.title} mb-1`}>{item.title}</h3>
                  <p className={`text-sm ${c.text}`}>{item.text}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Arbeiten im Wasser – Zeitfenster */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Arbeiten im Wasser – Zeitfenster</h2>
        <p className="text-xs text-gray-500 mb-4">
          Bauarbeiten, die sich nicht im Trockenen durchführen lassen, müssen außerhalb der Laichzeiten der wichtigsten Fischarten stattfinden.
        </p>

        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {WASSERBAU_MONATE.map((m) => (
            <div
              key={m.monat}
              className={`rounded-lg py-2 text-center text-xs font-medium ${
                m.erlaubt
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-400 border border-red-100'
              }`}
            >
              {m.monat}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" />
            <span>Wasserbau erlaubt</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-50 border border-red-100" />
            <span>Laichzeit – kein Wasserbau</span>
          </div>
        </div>
      </div>

      {/* Rechtlicher Hinweis */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-red-800 mb-1">Wichtiger Hinweis</h3>
            <p className="text-sm text-red-700">
              Die Einhaltung des 22. Dezembers 2027 ist nicht nur ein Zieltermin, sondern eine durch den wasserrechtlichen Bescheid festgelegte Frist. Verzögerungen über diesen Punkt hinaus könnten rechtliche Konsequenzen für die Betriebsbewilligung haben.
            </p>
          </div>
        </div>
      </div>

      {/* Messtechnik */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Messtechnik</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <p className="text-xs font-semibold text-amber-800 mb-1">CH1 – Trübe</p>
            <p className="text-sm text-amber-700">NTU (Nephelometric Turbidity Units)</p>
            <p className="text-xs text-amber-600 mt-1">Optische Trübungsmessung im Wasser</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 border border-red-100">
            <p className="text-xs font-semibold text-red-800 mb-1">CH2 – Schwebstofffracht</p>
            <p className="text-sm text-red-700">mg/l</p>
            <p className="text-xs text-red-600 mt-1">Grenzwert Bau: 5 g/l · Max Tag: 10 g/l</p>
          </div>
        </div>
      </div>
    </div>
  );
}
