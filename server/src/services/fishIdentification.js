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

    // ── Schritt 2: Detailanalyse via Gemini Vision (Länge + Herkunft) ──
    let geminiAnalysis = null;
    try {
      geminiAnalysis = await analyzeWithGemini(base64Image, speciesMatches[0]?.german);
      console.log('[Fish-ID] Gemini-Analyse:', geminiAnalysis);
    } catch (err) {
      console.warn('[Fish-ID] Gemini-Analyse fehlgeschlagen:', err.message);
    }

    if (speciesMatches.length > 0) {
      const top = speciesMatches[0];
      console.log(`[Fish-ID] Identified: ${top.german} (${top.latin}) - confidence: ${top.score} via "${top.matchedPattern}"`);

      return {
        species: top.key,
        speciesGerman: top.german,
        speciesLatin: top.latin,
        confidence: Math.round(top.score * 100) / 100,
        estimatedLength: geminiAnalysis?.estimatedLength || null,
        origin: geminiAnalysis?.origin || null,
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
      estimatedLength: geminiAnalysis?.estimatedLength || null,
      origin: geminiAnalysis?.origin || null,
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
 * Detailanalyse via Google Gemini Vision API:
 * - Geschätzte Länge (anhand Hände, Kescher, Umgebung)
 * - Herkunft: Wildfisch vs. Besatzfisch (anhand Fettflosse, Färbung, Flossen, Körperform)
 */
async function analyzeWithGemini(base64Image, speciesName) {
  const geminiKey = process.env.GEMINI_API_KEY
    || process.env.GOOGLE_VISION_API_KEY
    || process.env.GOOGLE_MAPS_API_KEY;

  if (!geminiKey) {
    console.warn('[Fish-Gemini] Kein API-Key für Gemini');
    return null;
  }

  const prompt = `Du bist ein erfahrener Fischereibiologe und Experte für Süßwasserfische in Oberösterreich (Flussgebiet Krems/Steyr). Analysiere dieses Foto eines Fisches.

${speciesName ? `Die Art wurde als "${speciesName}" identifiziert.` : ''}

Analysiere ZWEI Dinge:

**1. LÄNGENSCHÄTZUNG:**
Schätze die Gesamtlänge (Kopf bis Schwanzflosse) in Zentimetern.
Nutze folgende Hinweise:
- Hände/Finger des Anglers (Handbreite ≈ 8-10 cm, Fingerbreite ≈ 2 cm)
- Kescher/Netz (typische Öffnung 40-50 cm)
- Untergrund-Textur (Gras, Steine, Holz)
- Proportionen des Fischkörpers relativ zur Umgebung

**2. HERKUNFT (Wildfisch vs. Besatzfisch):**
Bestimme ob es sich um einen Wildfisch (natürlich aufgewachsen) oder Besatzfisch (eingesetzt/Zuchtfisch) handelt.
Prüfe dafür diese Merkmale:
- **Fettflosse** (Adipose): Vorhanden = eher Wildfisch, fehlend/kupiert = Besatzfisch (bei Salmoniden)
- **Flossenform**: Scharfe, intakte Flossen = Wildfisch; abgerundete, abgenutzte Flossen = Besatzfisch
- **Färbung**: Kräftige, kontrastreiche Färbung mit vielen Punkten = Wildfisch; blasse, gleichmäßige Färbung = Besatzfisch
- **Körperform**: Schlanker, stromlinienförmiger Körper = Wildfisch; gedrungener, schwerer Körper = Besatzfisch
- **Punktmuster**: Vielfältiges, individuelles Muster = Wildfisch; gleichmäßiges/spärliches Muster = Besatzfisch
- **Maulform**: Natürliche Proportionen = Wildfisch; Deformierungen (Unterbiss) = Besatzfisch

WICHTIG: Antworte NUR mit einem JSON-Objekt in diesem Format, kein anderer Text:
{
  "lengthCm": <Zahl oder null>,
  "lengthConfidence": "<niedrig|mittel|hoch>",
  "lengthHint": "<kurze Begründung>",
  "origin": "<wildfisch|besatzfisch|unklar>",
  "originConfidence": "<niedrig|mittel|hoch>",
  "originHint": "<kurze Begründung mit erkannten Merkmalen auf Deutsch>"
}

Beispiel Wildfisch: {"lengthCm": 38, "lengthConfidence": "mittel", "lengthHint": "Geschätzt anhand der Handgröße", "origin": "wildfisch", "originConfidence": "hoch", "originHint": "Fettflosse vorhanden, kräftige Tupfenmuster, schlanke Körperform"}
Beispiel Besatzfisch: {"lengthCm": 30, "lengthConfidence": "mittel", "lengthHint": "Geschätzt anhand des Keschers", "origin": "besatzfisch", "originConfidence": "mittel", "originHint": "Fettflosse fehlt, blasse Färbung, abgerundete Flossen"}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
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
            maxOutputTokens: 400,
          },
        }),
        signal: AbortSignal.timeout(25000),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn('[Fish-Gemini] Gemini API Error:', response.status, errText.substring(0, 200));
      return null;
    }

    const geminiData = await response.json();
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('[Fish-Gemini] Raw response:', textContent);

    // JSON aus Antwort extrahieren
    const jsonMatch = textContent.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.warn('[Fish-Gemini] Kein JSON in Gemini-Antwort gefunden');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Längenschätzung aufbereiten
    let estimatedLength = null;
    if (parsed.lengthCm !== null && parsed.lengthCm !== undefined) {
      const lengthCm = Math.round(Number(parsed.lengthCm));
      if (!isNaN(lengthCm) && lengthCm >= 3 && lengthCm <= 200) {
        estimatedLength = {
          lengthCm,
          confidence: parsed.lengthConfidence || 'mittel',
          hint: parsed.lengthHint || 'KI-Schätzung',
          source: 'ai',
        };
      }
    }
    if (!estimatedLength && parsed.lengthHint) {
      estimatedLength = {
        lengthCm: null,
        confidence: 'niedrig',
        hint: parsed.lengthHint,
        source: 'ai',
      };
    }

    // Herkunft aufbereiten
    let origin = null;
    const validOrigins = ['wildfisch', 'besatzfisch', 'unklar'];
    if (parsed.origin && validOrigins.includes(parsed.origin)) {
      origin = {
        type: parsed.origin,
        confidence: parsed.originConfidence || 'mittel',
        hint: parsed.originHint || '',
      };
    }

    return { estimatedLength, origin };
  } catch (err) {
    console.warn('[Fish-Gemini] Fehler:', err.message);
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
    origin: null,
    allResults: [],
    note: reason || 'Automatische Erkennung nicht verfügbar – bitte Fischart manuell auswählen.',
  };
}

module.exports = { identifyFish, SPECIES_MAP };
