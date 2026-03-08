/**
 * Fischart-Definitionen für das Revier Hauserwasser (Krems)
 */
export const FISH_SPECIES = [
  { key: 'brown_trout',   german: 'Bachforelle',       latin: 'Salmo trutta fario',       group: 'salmonid' },
  { key: 'rainbow_trout', german: 'Regenbogenforelle', latin: 'Oncorhynchus mykiss',      group: 'salmonid' },
  { key: 'char',          german: 'Saibling',          latin: 'Salvelinus fontinalis',     group: 'salmonid' },
  { key: 'grayling',      german: 'Äsche',             latin: 'Thymallus thymallus',       group: 'salmonid' },
  { key: 'pike',          german: 'Hecht',             latin: 'Esox lucius',               group: 'predator' },
  { key: 'zander',        german: 'Zander',            latin: 'Sander lucioperca',         group: 'predator' },
  { key: 'carp',          german: 'Karpfen',           latin: 'Cyprinus carpio',           group: 'cyprinid' },
  { key: 'barbel',        german: 'Barbe',             latin: 'Barbus barbus',             group: 'cyprinid' },
  { key: 'chub',          german: 'Aitel (Döbel)',     latin: 'Squalius cephalus',         group: 'cyprinid' },
  { key: 'perch',         german: 'Flussbarsch',       latin: 'Perca fluviatilis',         group: 'predator' },
  { key: 'huchen',        german: 'Huchen',            latin: 'Hucho hucho',               group: 'salmonid' },
];

export const TECHNIQUES = [
  { key: 'spinnfischen',   label: 'Spinnfischen' },
  { key: 'fliegenfischen', label: 'Fliegenfischen' },
  { key: 'ansitzangeln',   label: 'Ansitzangeln' },
  { key: 'blinkern',       label: 'Blinkern' },
];

export function getSpeciesGerman(key) {
  return FISH_SPECIES.find((s) => s.key === key)?.german || key;
}

export function getSpeciesColor(key) {
  const colors = {
    brown_trout: '#8B4513',
    rainbow_trout: '#FF6B9D',
    char: '#FF4500',
    grayling: '#6A5ACD',
    pike: '#228B22',
    zander: '#2E8B57',
    carp: '#DAA520',
    barbel: '#CD853F',
    chub: '#808080',
    perch: '#32CD32',
    huchen: '#DC143C',
  };
  return colors[key] || '#2563EB';
}
