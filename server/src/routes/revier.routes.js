const router = require('express').Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

// Alle Revier-Routen: nur Admin
router.use(auth, requireRole('admin'));

/**
 * GET /api/revier/analyse
 * Führt eine Gemini-basierte Analyse des Reviers (Krems, OÖ) durch.
 * Ergebnis wird gecacht (1h), damit nicht jeder Aufruf einen API-Call auslöst.
 */
let cachedAnalysis = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 Stunde

/**
 * Versucht aus einem beliebigen String valides JSON zu extrahieren.
 */
function extractJSON(raw) {
  if (!raw || !raw.trim()) return null;

  let str = raw.trim();

  // 1) Code-Block entfernen: ```json ... ``` oder ``` ... ```
  const codeBlock = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    str = codeBlock[1].trim();
  }

  // 2) Erstes { bis letztes } extrahieren
  const firstBrace = str.indexOf('{');
  const lastBrace = str.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    str = str.substring(firstBrace, lastBrace + 1);
  }

  // 3) Direkt parsen
  try {
    return JSON.parse(str);
  } catch (_) {
    // weiter versuchen
  }

  // 4) Trailing-Kommas entfernen und nochmal versuchen
  try {
    const cleaned = str.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(cleaned);
  } catch (_) {
    // weiter versuchen
  }

  // 5) Steuerzeichen und unsichtbare Zeichen entfernen
  try {
    const sanitized = str
      .replace(/[\x00-\x1F\x7F]/g, ' ')  // Control chars → Space
      .replace(/\n/g, '\\n')               // Newlines escapen
      .replace(/\r/g, '')
      .replace(/\t/g, '\\t');
    return JSON.parse(sanitized);
  } catch (_) {
    // aufgeben
  }

  return null;
}

router.get('/analyse', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';

    // Cache prüfen
    if (!forceRefresh && cachedAnalysis && Date.now() - cacheTimestamp < CACHE_TTL) {
      return res.json({ ...cachedAnalysis, cached: true });
    }

    const geminiKey = process.env.GEMINI_API_KEY
      || process.env.GOOGLE_VISION_API_KEY
      || process.env.GOOGLE_MAPS_API_KEY;

    if (!geminiKey) {
      return res.status(503).json({
        error: 'Gemini API-Key nicht konfiguriert. Bitte GEMINI_API_KEY setzen.',
      });
    }

    const prompt = `Du bist ein Experte für Limnologie und Fischereimanagement in Österreich.
Analysiere den Flussabschnitt der "Krems" in Oberösterreich zwischen:
- Oberkante (Piberbach/Kematen): 48.117156, 14.210667
- Unterkante (Neuhofen an der Krems): 48.130520, 14.225703

Antworte NUR mit einem JSON-Objekt, KEIN anderer Text davor oder danach:
{
  "gewaesser_info": {
    "name": "Krems (OÖ)",
    "region": "Traun-Enns-Platte",
    "fischregion_typ": "Untere Forellenregion / Äschenregion",
    "charakteristik": "kurze Beschreibung"
  },
  "fischarten_inventar": [
    {
      "name": "Fischart",
      "wissenschaftlicher_name": "Lateinisch",
      "vorkommen": "natürlich",
      "besatz_empfehlung": "hoch",
      "management_hinweis": "Hinweis"
    }
  ],
  "strategische_empfehlungen": ["Empfehlung 1", "Empfehlung 2"],
  "oekologischer_zustand_prognose": "Prognose"
}`;

    console.log('[Revier] Starte Gemini-Analyse...');

    // Modelle in Reihenfolge versuchen
    const GEMINI_MODELS = ['gemini-2.0-flash'];
    let textContent = '';
    let lastError = null;

    for (const model of GEMINI_MODELS) {
      try {
        console.log(`[Revier] Versuche Modell: ${model}`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2048,
              },
            }),
            signal: AbortSignal.timeout(25000),
          }
        );

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          console.error(`[Revier] ${model} HTTP ${response.status}:`, errText.substring(0, 500));
          lastError = `Gemini API Fehler (${model}, HTTP ${response.status})`;
          continue;
        }

        const data = await response.json();

        // Detailliertes Logging der Response-Struktur
        const candidate = data.candidates?.[0];
        if (!candidate) {
          console.error(`[Revier] ${model}: Keine candidates in Response.`, JSON.stringify(data).substring(0, 500));
          lastError = `${model}: Keine Antwort erhalten (candidates leer)`;
          continue;
        }

        if (candidate.finishReason && candidate.finishReason !== 'STOP') {
          console.warn(`[Revier] ${model}: finishReason=${candidate.finishReason}`);
        }

        textContent = candidate.content?.parts?.[0]?.text || '';
        if (!textContent) {
          console.error(`[Revier] ${model}: Leere Textantwort. Parts:`, JSON.stringify(candidate.content?.parts || []).substring(0, 300));
          lastError = `${model}: Leere Antwort erhalten`;
          continue;
        }

        console.log(`[Revier] ${model} OK, ${textContent.length} Zeichen`);
        console.log('[Revier] Antwort (erste 300):', textContent.substring(0, 300));
        break; // Erfolg
      } catch (fetchErr) {
        console.error(`[Revier] ${model} Fehler:`, fetchErr.message);
        lastError = fetchErr.message;
        continue;
      }
    }

    if (!textContent) {
      return res.status(502).json({
        error: lastError || 'Keine Antwort von Gemini erhalten',
      });
    }

    // JSON extrahieren
    const analysis = extractJSON(textContent);

    if (!analysis) {
      console.error('[Revier] JSON-Extraktion fehlgeschlagen. Kompletter Text:', textContent.substring(0, 1000));
      return res.status(502).json({
        error: 'Gemini hat kein gültiges JSON geliefert. Bitte erneut versuchen.',
      });
    }

    // Validierung
    if (!analysis.gewaesser_info || !analysis.fischarten_inventar) {
      console.error('[Revier] Unvollständige Daten:', Object.keys(analysis));
      return res.status(502).json({
        error: 'Unvollständige Analyse von Gemini. Bitte erneut versuchen.',
      });
    }

    cachedAnalysis = {
      analysis,
      analyzedAt: new Date().toISOString(),
    };
    cacheTimestamp = Date.now();

    console.log('[Revier] Analyse erfolgreich, Arten:', analysis.fischarten_inventar.length);

    res.json({ ...cachedAnalysis, cached: false });
  } catch (err) {
    console.error('[Revier] Unerwarteter Fehler:', err.message, err.stack?.substring(0, 200));
    res.status(500).json({
      error: 'Revier-Analyse fehlgeschlagen: ' + err.message,
    });
  }
});

module.exports = router;
