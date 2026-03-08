const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// ── Fischart-Mapping (Revier Hauserwasser) ─────────────────
const SPECIES_MAP = {
  brown_trout:    { german: 'Bachforelle',       latin: 'Salmo trutta fario' },
  rainbow_trout:  { german: 'Regenbogenforelle', latin: 'Oncorhynchus mykiss' },
  char:           { german: 'Saibling',          latin: 'Salvelinus fontinalis' },
  grayling:       { german: 'Äsche',             latin: 'Thymallus thymallus' },
  pike:           { german: 'Hecht',             latin: 'Esox lucius' },
  carp:           { german: 'Karpfen',           latin: 'Cyprinus carpio' },
  zander:         { german: 'Zander',            latin: 'Sander lucioperca' },
  barbel:         { german: 'Barbe',             latin: 'Barbus barbus' },
  chub:           { german: 'Aitel (Döbel)',     latin: 'Squalius cephalus' },
  perch:          { german: 'Flussbarsch',       latin: 'Perca fluviatilis' },
  huchen:         { german: 'Huchen',            latin: 'Hucho hucho' },
};

// ── iNaturalist-Taxon → lokale Art ─────────────────────────
const LATIN_MAPPING = {
  'Salmo trutta':         { key: 'brown_trout',   german: 'Bachforelle' },
  'Oncorhynchus mykiss':  { key: 'rainbow_trout', german: 'Regenbogenforelle' },
  'Salvelinus':           { key: 'char',           german: 'Saibling' },
  'Salvelinus fontinalis':{ key: 'char',           german: 'Saibling' },
  'Thymallus thymallus':  { key: 'grayling',      german: 'Äsche' },
  'Esox lucius':          { key: 'pike',           german: 'Hecht' },
  'Cyprinus carpio':      { key: 'carp',           german: 'Karpfen' },
  'Sander lucioperca':    { key: 'zander',         german: 'Zander' },
  'Barbus barbus':        { key: 'barbel',         german: 'Barbe' },
  'Squalius cephalus':    { key: 'chub',           german: 'Aitel' },
  'Leuciscus cephalus':   { key: 'chub',           german: 'Aitel' },
  'Perca fluviatilis':    { key: 'perch',          german: 'Flussbarsch' },
  'Hucho hucho':          { key: 'huchen',         german: 'Huchen' },
};

/**
 * Fisch erkennen – nutzt iNaturalist Computer Vision API als Fallback
 * In Produktion: TensorFlow.js-Modell oder Azure Custom Vision einbinden
 */
async function identifyFish(imagePath) {
  try {
    // Bild für API vorbereiten (auf max 1024px skalieren)
    const resizedBuffer = await sharp(imagePath)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // iNaturalist Score Image API
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('image', resizedBuffer, {
      filename: 'fish.jpg',
      contentType: 'image/jpeg',
    });

    const response = await fetch(
      'https://api.inaturalist.org/v1/computervisions/score_image',
      {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
      }
    );

    if (!response.ok) {
      console.warn('iNaturalist API Status:', response.status);
      return fallbackResult();
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      // Nur Fische (Actinopterygii = Strahlenflosser) filtern
      const fishResults = data.results.filter(
        (r) => r.taxon?.iconic_taxon_name === 'Actinopterygii'
      );

      if (fishResults.length > 0) {
        const top = fishResults[0];
        const mapped = mapToLocal(top.taxon?.name);

        return {
          species: mapped.key,
          speciesGerman: mapped.german,
          speciesLatin: top.taxon?.name || '',
          confidence: Math.round((top.combined_score || 0) * 100) / 100,
          allResults: fishResults.slice(0, 5).map((r) => ({
            name: r.taxon?.name,
            commonName: r.taxon?.preferred_common_name,
            score: Math.round((r.combined_score || 0) * 100) / 100,
            local: mapToLocal(r.taxon?.name),
          })),
        };
      }
    }

    return fallbackResult();
  } catch (err) {
    console.error('Fish identification error:', err.message);
    return fallbackResult();
  }
}

/**
 * iNaturalist Latin-Name auf lokale Hauerwasser-Art mappen
 */
function mapToLocal(latinName) {
  if (!latinName) return { key: 'unknown', german: 'Unbekannt' };

  for (const [latin, data] of Object.entries(LATIN_MAPPING)) {
    if (latinName.includes(latin)) return data;
  }

  return { key: 'unknown', german: latinName };
}

/**
 * Fallback wenn API nicht verfügbar
 */
function fallbackResult() {
  return {
    species: 'unknown',
    speciesGerman: 'Nicht erkannt',
    speciesLatin: '',
    confidence: 0,
    allResults: [],
    note: 'Automatische Erkennung nicht verfügbar – bitte Fischart manuell auswählen.',
  };
}

module.exports = { identifyFish, SPECIES_MAP };
