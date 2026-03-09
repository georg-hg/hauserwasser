const TIMELINE = [
  {
    phase: 'Bauphase 1',
    period: 'Oktober 2025 – März 2026',
    status: 'active',
    description: 'Errichtung der Sohlstufen und Uferbefestigung im Abschnitt A (km 0,0 – km 1,2). Einbau der Messsonden für das Sedimentmonitoring.',
    items: [
      'Sohlstufenerrichtung Abschnitt A',
      'Ufersicherung mit Wasserbausteinen',
      'Installation Messsonden (Sonde "Ende")',
      'Einbau Buhnen und Leitwerke',
    ],
  },
  {
    phase: 'Bauphase 2',
    period: 'April 2026 – September 2026',
    status: 'upcoming',
    description: 'Fortsetzung der Strukturierungsmaßnahmen im Abschnitt B (km 1,2 – km 2,5). Bepflanzung der Uferbereiche.',
    items: [
      'Strukturierung Abschnitt B',
      'Bepflanzung Uferzone',
      'Totholzeinbau',
      'Kiesschüttungen für Laichhabitate',
    ],
  },
  {
    phase: 'Monitoring & Nachsorge',
    period: 'Ab Oktober 2026',
    status: 'upcoming',
    description: 'Laufende Überwachung der Sedimentfracht und Trübung. Dokumentation der ökologischen Entwicklung.',
    items: [
      'Kontinuierliches Sedimentmonitoring',
      'Ökologische Zustandsbewertung',
      'Nachpflanzungen bei Bedarf',
      'Evaluierung der Maßnahmenwirksamkeit',
    ],
  },
];

const PROJECT_FACTS = [
  { label: 'Gewässer', value: 'Krems (Kematen an der Krems)' },
  { label: 'Gewässertyp', value: 'Fließgewässer, Einzugsgebiet Traun' },
  { label: 'Projektlänge', value: 'ca. 2,5 km' },
  { label: 'Projektträger', value: 'Marktgemeinde Kematen/Krems' },
  { label: 'Fachplanung', value: 'TB Zauner' },
  { label: 'Bauüberwachung', value: 'TB Zauner / Gewässerbezirk' },
  { label: 'Projektstart', value: 'Oktober 2025' },
  { label: 'Geplantes Ende', value: 'September 2026' },
];

export default function ProjekteckdatenSection() {
  return (
    <div className="space-y-6">
      {/* Projektsteckbrief */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Projektsteckbrief</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {PROJECT_FACTS.map((fact) => (
            <div key={fact.label} className="flex items-start px-4 py-3">
              <span className="text-sm text-gray-500 w-40 flex-shrink-0">{fact.label}</span>
              <span className="text-sm font-medium text-gray-900">{fact.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bauzeitplan / Timeline */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Bauzeitplan</h2>

        <div className="relative">
          {/* Vertikale Linie */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-6">
            {TIMELINE.map((item, idx) => (
              <div key={idx} className="relative pl-10">
                {/* Punkt */}
                <div className={`absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 ${
                  item.status === 'active'
                    ? 'bg-emerald-500 border-emerald-500 ring-4 ring-emerald-100'
                    : item.status === 'completed'
                    ? 'bg-gray-400 border-gray-400'
                    : 'bg-white border-gray-300'
                }`} />

                <div className={`rounded-lg p-4 ${
                  item.status === 'active' ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`text-sm font-semibold ${
                      item.status === 'active' ? 'text-emerald-800' : 'text-gray-700'
                    }`}>
                      {item.phase}
                    </h3>
                    {item.status === 'active' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                        Laufend
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{item.period}</p>
                  <p className="text-sm text-gray-600 mb-3">{item.description}</p>

                  <div className="space-y-1.5">
                    {item.items.map((task, tIdx) => (
                      <div key={tIdx} className="flex items-center gap-2 text-xs text-gray-600">
                        <svg className={`w-3.5 h-3.5 flex-shrink-0 ${
                          item.status === 'active' ? 'text-emerald-500' : 'text-gray-400'
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {task}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Messtechnik */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Messtechnik</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <p className="text-xs font-semibold text-blue-800 mb-1">CH32 – Batterie</p>
            <p className="text-sm text-blue-700">Volt</p>
            <p className="text-xs text-blue-600 mt-1">Versorgungsspannung der Messsonde</p>
          </div>
        </div>
      </div>
    </div>
  );
}
