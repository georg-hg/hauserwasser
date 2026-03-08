/**
 * Client-seitige Schonzeit-Prüfung
 * Für schnelle Warnungen ohne API-Call
 */
const CLOSED_SEASONS = {
  brown_trout:   { start: '09-16', end: '03-15', min: 26, german: 'Bachforelle' },
  rainbow_trout: { start: '12-01', end: '03-15', min: 26, german: 'Regenbogenforelle' },
  char:          { start: '09-16', end: '03-15', min: 26, german: 'Saibling' },
  barbel:        { start: '04-16', end: '05-31', min: 35, german: 'Barbe' },
  chub:          { start: '03-16', end: '05-31', min: 25, german: 'Aitel' },
  grayling:      { start: '03-01', end: '04-30', min: 30, german: 'Äsche' },
  pike:          { start: '02-01', end: '04-30', min: 60, german: 'Hecht' },
  carp:          { start: '05-01', end: '05-31', min: 35, german: 'Karpfen' },
  zander:        { start: '03-01', end: '04-30', min: 50, german: 'Zander' },
  perch:         { start: '03-01', end: '04-30', min: 10, german: 'Flussbarsch' },
  huchen:        { start: '01-01', end: '12-31', min: null, german: 'Huchen', yearRound: true },
};

export function isInClosedSeason(speciesKey, date = new Date()) {
  const season = CLOSED_SEASONS[speciesKey];
  if (!season) return { closed: false };
  if (season.yearRound) return { closed: true, message: `${season.german} ist ganzjährig geschont!` };

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const current = `${month}-${day}`;

  let closed;
  if (season.start <= season.end) {
    closed = current >= season.start && current <= season.end;
  } else {
    closed = current >= season.start || current <= season.end;
  }

  return {
    closed,
    minSize: season.min,
    message: closed ? `${season.german}: Schonzeit bis ${season.end}!` : null,
  };
}

export function getMinSize(speciesKey) {
  return CLOSED_SEASONS[speciesKey]?.min || null;
}
