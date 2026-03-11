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
const LABEL_MAPPING = [
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

// Generische Fisch-Labels
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
  const apiKey = process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn('[Fish-ID] Kein API-Key konfiguriert (GOOGLE_VISION_API_KEY oder GOOGLE_MAPS_API_KEY)');
    return fallbackResult(
      'API-Schlüssel nicht konfiguriert. Bitte GOOGLE_VISION_API_KEY als Umgebungsvariable setzen.'
    );
  }

  const keySource = process.env.GOOGLE_VISION_API_KEY ? 'GOOGLE_VISION_API_KEY' : 'GOOGLE_MAPS_API_KEY';
  console.log(`[Fish-ID] Verwende ${keySource} für Cloud Vision API`);

  try {
    // Bild vorbereiten (auf max 1024px skalieren, als Base64)
    const resizedBuffer = await sharp(imagePath)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const base64Image = resizedBuffer.toString('base64');

    // ── Schritt 1: Artenbestimmung via Google Cloud Vision ──
    console.log('[Fish-ID] Sending image to Google Cloud Vision API...');

    const visionResponse = await fetch(
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

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text().catch(() => '');
      console.error('[Fish-ID] Google Vision API Error – Status:', visionResponse.status);
      console.error('[Fish-ID] Response:', errorText.substring(0, 500));

      if (visionResponse.status === 403) {
        if (errorText.includes('Cloud Vision API has not been used') || errorText.includes('is not enabled')) {
          return fallbackResult('Die Cloud Vision API ist nicht aktiviert. Bitte in der Google Cloud Console aktivieren.');
        }
        if (errorText.includes('API key not valid') || errorText.includes('API_KEY_INVALID')) {
          return fallbackResult('Der API-Schlüssel ist ungültig oder hat keine Berechtigung für die Vision API.');
        }
        if (errorText.includes('PERMISSION_DENIED') || errorText.includes('API key is not authorized')) {
          return fallbackResult('Der API-Schlüssel hat keine Berechtigung für die Cloud Vision API.');
        }
        return fallbackResult('Zugriff auf die Bildanalyse verweigert (403).');
      }
      if (visionResponse.status === 429) return fallbackResult('Zu viele Anfragen – bitte in einer Minute erneut versuchen.');
      if (visionResponse.status === 400) return fallbackResult('Bildanalyse fehlgeschlagen – ungültiges Bild.');
      return fallbackResult(`Bildanalyse-Service nicht verfügbar (HTTP ${visionResponse.status}).`);
    }

    const data = await visionResponse.json();
    const result = data.responses?.[0];

    if (!result) {
      return fallbackResult('Keine Analyseergebnisse erhalten.');
    }

    // Labels sammeln
    const allLabels = [];

    if (result.labelAnnotations) {
      for (const label of result.labelAnnotations) {
        allLabels.push({ description: label.description.toLowerCase(), score: label.score || 0, source: 'label' });
      }
    }
    if (result.webDetection) {
      const wd = result.webDetection;
      if (wd.webEntities) {
        for (const entity of wd.webEntities) {
          if (entity.description) {
            allLabels.push({ description: entity.description.toLowerCase(), score: entity.score || 0, source: 'web' });
          }
        }
      }
      if (wd.bestGuessLabels) {
        for (const bgl of wd.bestGuessLabels) {
          if (bgl.label) {
            allLabels.push({ description: bgl.label.toLowerCase(), score: 0.9, source: 'bestGuess' });
          }
        }
      }
    }

    console.log('[Fish-ID] All labels:', allLabels.map(l => `${l.description} (${l.score.toFixed(2)}, ${l.source})`).join(', '));

    // Prüfen ob Fisch im Bild
    const isFish = allLabels.some(l => FISH_INDICATORS.some(fi => l.description.includes(fi)));

    if (!isFish) {
      return fallbackResult('Kein Fisch im Bild erkannt. Bitte ein deutliches Foto des Fisches aufnehmen.');
    }

    // Art bestimmen
    const speciesMatches = [];
    for (const mapping of LABEL_MAPPING) {
      let bestScore = 0;
      let matchedPattern = '';
      for (const pattern of mapping.patterns) {
        for (const label of allLabels) {
          if (label.description.includes(pattern)) {
            if (label.score > bestScore) {
              bestScore = label.score;
              matchedPattern = pattern;
            }
          }
        }
      }
      if (bestScore > 0) {
        speciesMatches.push({ ...mapping, score: bestScore, matchedPattern });
      }
    }
    speciesMatches.sort((a, b) => b.score - a.score);

    // ── Schritt 2: Längenschätzung via Gemini Vision ──
    let estimatedLength = null;
    try {
      estimatedLength = await estimateFishLength(base64Image, speciesMatches[0]?.german);
      console.log('[Fish-ID] Geschätzte Länge:', estimatedLength);
    } catch (err) {
      console.warn('[Fish-ID] Längenschätzung fehlgeschlagen:', err.message);
    }

    if (speciesMatches.length > 0) {
      const top = speciesMatches[0];
      console.log(`[Fish-ID] Identified: ${top.german} (${top.latin}) - confidence: ${top.score} via "${top.matchedPattern}"`);

      return {
        species: top.key,
        speciesGerman: top.german,
        speciesLatin: top.latin,
        confidence: Math.round(top.score * 100) / 100,
        estimatedLength,
        allResults: speciesMatches.slice(0, 5).map(m => ({
          name: m.latin,
          commonName: m.german,
          score: Math.round(m.score * 100) / 100,
          local: { key: m.key, german: m.german },
        })),
      };
    }

    // Fisch erkannt, aber Art unbekannt
    return {
      species: 'unknown',
      speciesGerman: 'Nicht erkannt',
      speciesLatin: '',
      confidence: 0,
      estimatedLength,
      allResults: [],
      note: 'Fisch erkannt, aber Art konnte nicht zugeordnet werden. Bitte manuell auswählen.',
    };
  } catch (err) {
    console.error('[Fish-ID] Error:', err.message);
    if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
      return fallbackResult('Zeitüberschreitung bei der Bildanalyse – bitte erneut versuchen.');
    }
    if (err.message?.includes('ENOTFOUND') || err.message?.includes('network')) {
      return fallbackResult('Netzwerkfehler – Verbindung zum Bildanalyse-Service nicht möglich.');
    }
    return fallbackResult('Fehler bei der Bildanalyse: ' + err.message);
  }
}

/**
 * Fischlänge schätzen via Google Gemini Vision API
 * Analysiert das Bild und schätzt die Länge anhand visueller Hinweise
 * (Hände, Untergrund, Proportionen, Netz, etc.)
 */
async function estimateFishLength(base64Image, speciesName) {
  const geminiKey = process.env.GEMINI_API_KEY
    || process.env.GOOGLE_VISION_API_KEY
    || process.env.GOOGLE_MAPS_API_KEY;

  if (!geminiKey) {
    console.warn('[Fish-Length] Kein API-Key für Gemini');
    return null;
  }

  const prompt = `Du bist ein Experte für Süßwasserfische in Oberösterreich. Analysiere dieses Foto eines Fisches und schätze die Gesamtlänge (Kopf bis Schwanzflosse) in Zentimetern.

${speciesName ? `Die Art wurde als "${speciesName}" identifiziert.` : ''}

Nutze folgende Hinweise im Bild zur Größenschätzung:
- Hände/Finger des Anglers (Handbreite ≈ 8-10 cm, Fingerbreite ≈ 2 cm)
- Kescher/Netz (typische Öffnung 40-50 cm)
- Untergrund-Textur (Gras, Steine, Holz)
- Proportionen des Fischkörpers relativ zur Umgebung
- Angelrute oder andere Ausrüstung im Bild

WICHTIG: Antworte NUR mit einem JSON-Objekt in diesem Format, kein anderer Text:
{"lengthCm": <Zahl>, "confidence": "<niedrig|mittel|hoch>", "hint": "<kurze Begründung auf Deutsch>"}

Beispiel: {"lengthCm": 35, "confidence": "mittel", "hint": "Geschätzt anhand der Handgröße des Anglers"}

Falls du die Länge nicht einschätzen kannst, antworte: {"lengthCm": null, "confidence": "niedrig", "hint": "Keine Referenzobjekte im Bild erkennbar"}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image,
                },
              },
            ],
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 200,
          },
        }),
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn('[Fish-Length] Gemini API Error:', response.status, errText.substring(0, 200));
      return null;
    }

    const geminiData = await response.json();
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('[Fish-Length] Gemini raw response:', textContent);

    // JSON aus Antwort extrahieren
    const jsonMatch = textContent.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.warn('[Fish-Length] Kein JSON in Gemini-Antwort gefunden');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.lengthCm === null || parsed.lengthCm === undefined) {
      return {
        lengthCm: null,
        confidence: 'niedrig',
        hint: parsed.hint || 'Länge konnte nicht geschätzt werden.',
        source: 'ai',
      };
    }

    const lengthCm = Math.round(Number(parsed.lengthCm));
    if (isNaN(lengthCm) || lengthCm < 3 || lengthCm > 200) {
      console.warn('[Fish-Length] Unplausible Länge:', parsed.lengthCm);
      return null;
    }

    return {
      lengthCm,
      confidence: parsed.confidence || 'mittel',
      hint: parsed.hint || 'KI-Schätzung',
      source: 'ai',
    };
  } catch (err) {
    console.warn('[Fish-Length] Fehler:', err.message);
    return null;
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
    estimatedLength: null,
    allResults: [],
    note: reason || 'Automatische Erkennung nicht verfügbar – bitte Fischart manuell auswählen.',
  };
}

module.exports = { identifyFish, SPECIES_MAP };
