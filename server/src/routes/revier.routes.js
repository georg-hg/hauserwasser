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
Analysiere den Flussabschnitt der "Krems" in Oberösterreich zwischen den folgenden Koordinaten:
- Oberkante (Piberbach/Kematen): 48.117156, 14.210667
- Unterkante (Neuhofen an der Krems): 48.130520, 14.225703
Erstelle eine detaillierte Analyse für ein nachhaltiges Besatzmanagement.
Antworte AUSSCHLIESSLICH im JSON-Format mit folgender Struktur:
{
  "gewaesser_info": {
    "name": "Krems (OÖ)",
    "region": "Traun-Enns-Platte",
    "fischregion_typ": "Untere Forellenregion / Äschenregion",
    "charakteristik": "string"
  },
  "fischarten_inventar": [
    {
      "name": "string",
      "wissenschaftlicher_name": "string",
      "vorkommen": "natürlich / Besatz / selten",
      "besatz_empfehlung": "hoch / mittel / niedrig / nein",
      "management_hinweis": "string"
    }
  ],
  "strategische_empfehlungen": [
    "string",
    "string"
  ],
  "oekologischer_zustand_prognose": "string"
}
Berücksichtige bei der Analyse die spezifische Topografie (Mäandrierung, landwirtschaftlicher Eintrag, Durchgängigkeit) dieses Abschnitts.`;

    console.log('[Revier] Starte Gemini-Analyse...');

    // gemini-2.0-flash ist schnell genug für Render Free (30s Timeout)
    // gemini-2.5-flash ist ein "Thinking"-Modell und braucht oft >30s
    const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash'];
    let data = null;
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
                temperature: 0.3,
                maxOutputTokens: 2048,
                responseMimeType: 'application/json',
              },
            }),
            signal: AbortSignal.timeout(25000), // Render Free: 30s Timeout
          }
        );

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          console.error(`[Revier] ${model} API Error:`, response.status, errText.substring(0, 300));
          lastError = `Gemini API Fehler (${model}, HTTP ${response.status})`;
          continue; // nächstes Modell versuchen
        }

        data = await response.json();
        console.log(`[Revier] Erfolgreich mit Modell: ${model}`);
        break; // Erfolg
      } catch (fetchErr) {
        console.error(`[Revier] ${model} Fetch Error:`, fetchErr.message);
        lastError = fetchErr.message;
        continue;
      }
    }

    if (!data) {
      return res.status(502).json({
        error: lastError || 'Alle Gemini-Modelle fehlgeschlagen',
      });
    }

    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('[Revier] Gemini Response (first 500 chars):', textContent.substring(0, 500));

    // JSON aus Antwort extrahieren
    let jsonStr = textContent.trim();

    // Falls in Code-Block gewrappt
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Falls noch kein reines JSON, versuche JSON-Objekt zu finden
    if (!jsonStr.startsWith('{')) {
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }

    let analysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[Revier] JSON Parse Fehler. Raw (500 chars):', jsonStr.substring(0, 500));
      // Letzter Versuch: ungültige Trailing-Kommas entfernen
      try {
        const cleaned = jsonStr.replace(/,\s*([\]}])/g, '$1');
        analysis = JSON.parse(cleaned);
        console.log('[Revier] JSON nach Cleanup erfolgreich geparst');
      } catch {
        throw new SyntaxError('Ungültiges JSON von Gemini: ' + parseErr.message);
      }
    }

    // Validierung: Erwartete Felder prüfen
    if (!analysis.gewaesser_info || !analysis.fischarten_inventar) {
      throw new Error('Unvollständige Analyse-Daten von Gemini erhalten');
    }

    cachedAnalysis = {
      analysis,
      analyzedAt: new Date().toISOString(),
    };
    cacheTimestamp = Date.now();

    console.log('[Revier] Analyse erfolgreich, Arten:', analysis.fischarten_inventar.length);

    res.json({ ...cachedAnalysis, cached: false });
  } catch (err) {
    console.error('[Revier] Fehler:', err.message);
    if (err instanceof SyntaxError) {
      return res.status(502).json({
        error: 'Ungültiges JSON von Gemini erhalten. Bitte erneut versuchen.',
      });
    }
    res.status(500).json({
      error: 'Revier-Analyse fehlgeschlagen: ' + err.message,
    });
  }
});

module.exports = router;
