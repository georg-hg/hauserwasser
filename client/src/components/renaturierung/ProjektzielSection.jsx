const GOALS = [
  {
    number: 1,
    title: 'Ökologische Durchgängigkeit',
    icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
    color: 'emerald',
    description: 'Wiederherstellung der Durchgängigkeit für Fische und Kleinlebewesen entlang des gesamten Projektabschnitts. Durch den Rückbau von Querbauwerken und die Errichtung natürlicher Sohlstufen werden Wanderbarrieren beseitigt.',
    targets: [
      'Rückbau bestehender Sohlschwellen',
      'Errichtung naturnaher Sohlrampen',
      'Gewährleistung der Mindestwassertiefe für Fischaufstieg',
      'Anbindung der Seitengewässer und Zubringer',
    ],
  },
  {
    number: 2,
    title: 'Verbesserung der Gewässermorphologie',
    icon: 'M20.893 13.393l-1.135-1.135a2.252 2.252 0 01-.421-.585l-1.08-2.16a.414.414 0 00-.663-.107.827.827 0 01-.812.21l-1.273-.363a.89.89 0 00-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 01-1.81 1.025 1.055 1.055 0 01-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 01-1.383-2.46l.007-.042a2.25 2.25 0 01.29-.787l.09-.15a2.25 2.25 0 012.37-1.048l1.178.236a1.125 1.125 0 001.302-.795l.208-.73a1.125 1.125 0 00-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 01-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 01-1.458-1.137l1.411-2.353a2.25 2.25 0 00.286-.76M11.25 2.25c5.385 0 9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S1.5 17.385 1.5 12 5.865 2.25 11.25 2.25z',
    color: 'blue',
    description: 'Durch die Schaffung vielfältiger Strömungsverhältnisse und Gewässerstrukturen wird der Lebensraum für aquatische Organismen deutlich verbessert. Totholzeinbauten, Kiesbänke und Buhnen schaffen natürliche Habitate.',
    targets: [
      'Einbau von Totholzstrukturen und Buhnen',
      'Kiesschüttungen für Laichhabitate',
      'Uferbepflanzung mit standortgerechten Gehölzen',
      'Schaffung von Flachwasserzonen und Kolken',
    ],
  },
  {
    number: 3,
    title: 'Reduktion des Sedimenteintrags',
    icon: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z',
    color: 'amber',
    description: 'Durch baubegleitendes Monitoring der Trübung und Schwebstofffracht wird sichergestellt, dass die festgelegten Grenzwerte während der Baumaßnahmen eingehalten werden. Die Messsonde "Ende" überwacht die Werte kontinuierlich.',
    targets: [
      'Einhaltung des Baugrenzwerts von 5 g/l Schwebstofffracht',
      'Einhaltung des Tagesmaximums von 10 g/l',
      'Kontinuierliches Trübungsmonitoring via Messsonde',
      'Sofortige Maßnahmen bei Grenzwertüberschreitung',
    ],
  },
];

const colorMap = {
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: 'bg-emerald-100 text-emerald-600',
    number: 'bg-emerald-600',
    bullet: 'text-emerald-500',
    title: 'text-emerald-900',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'bg-blue-100 text-blue-600',
    number: 'bg-blue-600',
    bullet: 'text-blue-500',
    title: 'text-blue-900',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'bg-amber-100 text-amber-600',
    number: 'bg-amber-600',
    bullet: 'text-amber-500',
    title: 'text-amber-900',
  },
};

export default function ProjektzielSection() {
  return (
    <div className="space-y-6">
      {/* Einleitung */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Projektziel</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Die Renaturierung der Krems im Bereich Kematen verfolgt drei zentrale Ziele: die Wiederherstellung
          der ökologischen Durchgängigkeit, die Verbesserung der Gewässermorphologie und die Kontrolle
          des Sedimenteintrags während der Baumaßnahmen. Diese Maßnahmen dienen der nachhaltigen
          Verbesserung des ökologischen Zustands gemäß EU-Wasserrahmenrichtlinie.
        </p>
      </div>

      {/* Ziele */}
      {GOALS.map((goal) => {
        const colors = colorMap[goal.color];
        return (
          <div key={goal.number} className={`rounded-xl border ${colors.border} overflow-hidden`}>
            {/* Header */}
            <div className={`${colors.bg} px-4 py-3 flex items-center gap-3`}>
              <div className={`w-8 h-8 rounded-lg ${colors.number} text-white flex items-center justify-center text-sm font-bold`}>
                {goal.number}
              </div>
              <div className={`w-8 h-8 rounded-lg ${colors.icon} flex items-center justify-center`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={goal.icon} />
                </svg>
              </div>
              <h3 className={`text-sm font-semibold ${colors.title}`}>{goal.title}</h3>
            </div>

            {/* Content */}
            <div className="bg-white p-4">
              <p className="text-sm text-gray-600 leading-relaxed mb-4">{goal.description}</p>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Maßnahmen</p>
              <div className="space-y-2">
                {goal.targets.map((target, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${colors.bullet}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-gray-600">{target}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* EU-WRRL Hinweis */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900 mb-1">EU-Wasserrahmenrichtlinie</p>
            <p className="text-xs text-blue-700 leading-relaxed">
              Die Renaturierungsmaßnahmen erfolgen im Rahmen des Nationalen Gewässerbewirtschaftungsplans
              (NGP) und zielen auf die Erreichung des „guten ökologischen Zustands" gemäß EU-Wasserrahmenrichtlinie
              (RL 2000/60/EG) ab.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
