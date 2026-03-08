const sharp = require('sharp');

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

// ── Google Vision Label → lokale Art ────────────────────────
// Labels von Google Vision API (LABEL_DETECTION + WEB_DETECTION)
const LABEL_MAPPING = [
  // English + German labels
  { patterns: ['brown trout', 'bachforelle', 'salmo trutta', 'fario'],                  key: 'brown_trout',   german: 'Bachforelle',       latin: 'Salmo trutta fario' },
  { patterns: ['rainbow trout', 'regenbogenforelle', 'oncorhynchus mykiss', 'steelhead'], key: 'rainbow_trout', german: 'Regenbogenforelle', latin: 'Oncorhynchus mykiss' },
  { patterns: ['arctic char', 'brook char', 'brook trout', 'saibling', 'salvelinus', 'char'], key: 'char', german: 'Saibling', latin: 'Salvelinus fontinalis' },
  { patterns: ['grayling', 'äsche', 'aesche', 'thymallus'],                              key: 'grayling',      german: 'Äsche',             latin: 'Thymallus thymallus' },
  { patterns: ['northern pike', 'pike', 'hecht', 'esox'],                                key: 'pike',          german: 'Hecht',             latin: 'Esox lucius' },
  { patterns: ['common carp', 'carp', 'karpfen', 'cyprinus', 'mirror carp'],             key: 'carp',          german: 'Karpfen',           latin: 'Cyprinus carpio' },
  { patterns: ['zander', 'pike-perch', 'pikeperch', 'sander lucioperca'],                key: 'zander',        german: 'Zander',            latin: 'Sander lucioperca' },
  { patterns: ['barbel', 'barbe', 'barbus'],                                             key: 'barbel',        german: 'Barbe',             latin: 'Barbus barbus' },
  { patterns: ['european chub', 'chub', 'aitel', 'döbel', 'squalius', 'leuciscus'],      key: 'chub',          german: 'Aitel (Döbel)',     latin: 'Squalius cephalus' },
  { patterns: ['european perch', 'perch', 'flussbarsch', 'perca fluviatilis', 'barsch'], key: 'perch',         german: 'Flussbarsch',       latin: 'Perca fluviatilis' },
  { patterns: ['huchen', 'danube salmon', 'hucho'],                                      key: 'huchen',        german: 'Huchen',            latin: 'Hucho hucho' },
];

// Generische Fisch-Labels (zur Erkennung ob überhaupt ein Fisch im Bild ist)
const FISH_INDICATORS = [
  'fish', 'trout', 'salmon', 'carp', 'pike', 'perch', 'bass',
  'fisch', 'forelle', 'lachs', 'hecht', 'barsch', 'karpfen',
  'ray-finned fish', 'actinopterygii', 'freshwater fish',
  'bony fish', 'cyprinidae', 'salmonidae',
];

/**
 * Fisch erkennen – nutzt Google Cloud Vision API (LABEL_DETECTION + WEB_DETECTION)
 */
async function identifyFish(imagePath) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn('[Fish-ID] No GOOGLE_MAPS_API_KEY configured');
    return fallbackResult('API-Schlüssel nicht konfiguriert.');
  }

  try {
    // Bild vorbereiten (auf max 1024px skalieren, als Base64)
    const resizedBuffer = await sharp(imagePath)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const base64Image = resizedBuffer.toString('base64');

    console.log('[Fish-ID] Sending image to Google Cloud Vision API...');

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Image },
            features: [
              { type: 'LABEL_DETECTION', maxResults: 20 },
              { type: 'WEB_DETECTION', maxResults: 10 },
            ],
          }],
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn('[Fish-ID] Google Vision API Status:', response.status, errorText.substring(0, 300));

      // Check for specific error: API not enabled
      if (response.status === 403 && errorText.includes('Cloud Vision API has not been used')) {
        return fallbackResult('Google Vision API muss in der Cloud Console aktiviert werden.');
      }

      return fallbackResult('Bildanalyse-Service nicht verfügbar.');
    }

    const data = await response.json();
    const result = data.responses?.[0];

    if (!result) {
      return fallbackResult('Keine Analyseergebnisse erhalten.');
    }

    // Alle Labels sammeln (LABEL_DETECTION + WEB_DETECTION)
    const allLabels = [];

    // Standard-Labels
    if (result.labelAnnotations) {
      for (const label of result.labelAnnotations) {
        allLabels.push({
          description: label.description.toLowerCase(),
          score: label.score || 0,
          source: 'label',
        });
      }
    }

    // Web-Detection Labels (oft spezifischer für Tierarten)
    if (result.webDetection) {
      const wd = result.webDetection;
      if (wd.webEntities) {
        for (const entity of wd.webEntities) {
          if (entity.description) {
            allLabels.push({
              description: entity.description.toLowerCase(),
              score: entity.score || 0,
              source: 'web',
            });
          }
        }
      }
      // Best guess labels
      if (wd.bestGuessLabels) {
        for (const bgl of wd.bestGuessLabels) {
          if (bgl.label) {
            allLabels.push({
              description: bgl.label.toLowerCase(),
              score: 0.9,
              source: 'bestGuess',
            });
          }
        }
      }
    }

    console.log('[Fish-ID] All labels:', allLabels.map(l => `${l.description} (${l.score.toFixed(2)}, ${l.source})`).join(', '));

    // Prüfen ob überhaupt ein Fisch erkannt wurde
    const isFish = allLabels.some(l =>
      FISH_INDICATORS.some(fi => l.description.includes(fi))
    );

    if (!isFish) {
      console.log('[Fish-ID] No fish detected in image');
      return fallbackResult('Kein Fisch im Bild erkannt. Bitte ein deutliches Foto des Fisches aufnehmen.');
    }

    // Spezifische Art bestimmen
    const speciesMatches = [];
    for (const mapping of LABEL_MAPPING) {
      let bestScore = 0;
      let matchedPattern = '';
      for (const pattern of mapping.patterns) {
        for (const label of allLabels) {
          if (label.description.includes(pattern)) {
            const score = label.score > bestScore ? label.score : bestScore;
            if (score > bestScore) {
              bestScore = score;
              matchedPattern = pattern;
            }
          }
        }
      }
      if (bestScore > 0) {
        speciesMatches.push({
          ...mapping,
          score: bestScore,
          matchedPattern,
        });
      }
    }

    // Sortieren nach Score
    speciesMatches.sort((a, b) => b.score - a.score);

    if (speciesMatches.length > 0) {
      const top = speciesMatches[0];
      console.log(`[Fish-ID] Identified: ${top.german} (${top.latin}) - confidence: ${top.score} via "${top.matchedPattern}"`);

      return {
        species: top.key,
        speciesGerman: top.german,
        speciesLatin: top.latin,
        confidence: Math.round(top.score * 100) / 100,
        allResults: speciesMatches.slice(0, 5).map(m => ({
          name: m.latin,
          commonName: m.german,
          score: Math.round(m.score * 100) / 100,
          local: { key: m.key, german: m.german },
        })),
      };
    }

    // Fisch erkannt, aber nicht in unserer Artenliste
    console.log('[Fish-ID] Fish detected but species not in local mapping');
    return {
      species: 'unknown',
      speciesGerman: 'Nicht erkannt',
      speciesLatin: '',
      confidence: 0,
      allResults: [],
      note: 'Fisch erkannt, aber Art konnte nicht zugeordnet werden. Bitte manuell auswählen.',
    };
  } catch (err) {
    console.error('[Fish-ID] Error:', err.message);
    return fallbackResult('Fehler bei der Bildanalyse: ' + err.message);
  }
}

/**
 * Fallback wenn API nicht verfügbar
 */
function fallbackResult(reason) {
  return {
    species: 'unknown',
    speciesGerman: 'Nicht erkannt',
    speciesLatin: '',
    confidence: 0,
    allResults: [],
    note: reason || 'Automatische Erkennung nicht verfügbar – bitte Fischart manuell auswählen.',
  };
}

module.exports = { identifyFish, SPECIES_MAP };
