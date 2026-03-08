import { useState } from 'react';

const SECTIONS = [
  {
    title: 'Revier & Grenzen',
    content: 'Das Revier beginnt 50m oberhalb der Neuhofner Wehr (Obermuehlwehr, durch Grenzsteine markiert) und erstreckt sich ca. 3.000m flussaufwaerts bis zum ehemaligen Lindlmair-Infang. Dazu gehoert der Fischlmayrbach (ca. 1,5 km) vom Ursprung bis zur Muendung in die Krems. Gemeinden: Neuhofen an der Krems und Piberbach.',
  },
  {
    title: 'Saison & Zeiten',
    content: 'Fischfang von 16. Maerz bis 30. November 2026. Der Fischfang beginnt mit Sonnenaufgang und endet nach Sonnenuntergang.',
  },
  {
    title: 'Fangquoten',
    items: [
      'Max. 3 Fischtage pro Woche',
      'Max. 36 Fischtage pro Saison',
      'Max. 3 Salmoniden pro Tag (Bachforelle, Regenbogenforelle, Saibling, Aesche)',
      'Max. 60 Salmoniden pro Saison',
      'Max. 1 karpfenartiger Fisch pro Tag (Karpfen, Barbe, Naesling)',
      'Hecht: 1 Stueck pro Jahr',
      'Zander: 1 Stueck pro Jahr',
      'Aitel, Hasel, Barsch: ohne Beschraenkung',
      'Nach Erreichen der Fangquote: Fischen sofort einstellen!',
    ],
  },
  {
    title: 'Erlaubte Techniken',
    items: [
      'Spinnfischen',
      'Blinkern (nur mit Einzelhaken!)',
      'Fliegenfischen',
      'Ansitzangeln (Stoppel, Grundblei, Futterkorb)',
      'Nur EINE Angelrute pro Fischtag',
      'Alle Haken: widerhakenlos / Widerhaken angedrueckt',
    ],
  },
  {
    title: 'Verbotene Techniken',
    items: [
      'Anfuettern',
      'Legangeln',
      'Tiroler-Hoelzl',
      'Drillinge / Mehrfachhaken',
      'Lebende Koederfische',
    ],
  },
  {
    title: 'Wichtige Regeln',
    items: [
      'Entnommene Fische sofort in die Fangstatistik eintragen',
      'Fische vor dem Abhaken waidgerecht toeten',
      'Haeltern von Fischen ist NICHT erlaubt',
      'Untermassige / geschonte Fische schonend zuruecksetzen',
      'Unterfangkescher, Hakenloeser und Massband immer mitfuehren',
      'Huchen ist ganzjaehrig geschont!',
      'Laichende Fische nicht befischen, Laichplaetze nicht bewaten',
      'Fahrverbote entlang der Krems einhalten',
      'Alle Abfaelle restlos mitnehmen',
    ],
  },
  {
    title: 'Gaestekarten',
    content: 'Lizenznehmer koennen 3x im Jahr eine Gaestekarte ausgeben. Das Fischen fuer den Gast ist nur gemeinsam mit dem Lizenznehmer gestattet. Preis pro Gaestekarte: EUR 40,-',
  },
];

export default function Regulations() {
  const [openSection, setOpenSection] = useState(0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 md:py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Fischereiordnung Hauserwasser</h1>
      <p className="text-sm text-gray-500 mb-4">
        Revier: Krems samt Fischlmayrbach (ON 30/5, BH Linz-Land)
      </p>

      <div className="space-y-2">
        {SECTIONS.map((section, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setOpenSection(openSection === idx ? -1 : idx)}
              className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <span className="font-semibold text-gray-800 text-sm">{section.title}</span>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${openSection === idx ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {openSection === idx && (
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                {section.content && (
                  <p className="text-sm text-gray-700 leading-relaxed">{section.content}</p>
                )}
                {section.items && (
                  <ul className="space-y-1.5">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-primary-500 mt-0.5 flex-shrink-0">&bull;</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Kontakt */}
      <div className="mt-6 card bg-primary-50 border-primary-200">
        <h3 className="font-semibold text-primary-900 text-sm">Bewirtschafter</h3>
        <p className="text-sm text-primary-800 mt-1">
          Mag. Georg Hauser &middot; Piberbach 8, 4533 Piberbach
        </p>
        <p className="text-sm text-primary-800">Tel: 06704001287</p>
        <h3 className="font-semibold text-primary-900 text-sm mt-3">Fischereischutzorgan</h3>
        <p className="text-sm text-primary-800">Lehner Alexander &middot; Tel: 06604747614</p>
      </div>
    </div>
  );
}
