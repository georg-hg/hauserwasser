const router = require('express').Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

router.use(auth, requireRole('admin'));

let cachedAnalysis = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000;

function extractJSON(raw) {
  if (!raw || !raw.trim()) return null;
  let str = raw.trim();

  // Code-Block entfernen
  const m = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) str = m[1].trim();

  // Erstes { bis letztes }
  const a = str.indexOf('{');
  const b = str.lastIndexOf('}');
  if (a !== -1 && b > a) str = str.substring(a, b + 1);

  try { return JSON.parse(str); } catch (_) {}
  try { return JSON.parse(str.replace(/,\s*([\]}])/g, '$1')); } catch (_) {}
  return null;
}

router.get('/analyse', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';

    if (!forceRefresh && cachedAnalysis && Date.now() - cacheTimestamp < CACHE_TTL) {
      return res.json({ ...cachedAnalysis, cached: true });
    }

    const geminiKey = process.env.GEMINI_API_KEY
      || process.env.GOOGLE_VISION_API_KEY
      || process.env.GOOGLE_MAPS_API_KEY;

    if (!geminiKey) {
      return res.status(503).json({ error: 'GEMINI_API_KEY nicht konfiguriert.' });
    }

    const prompt = `Gib ein JSON-Objekt zurueck ueber den Fluss Krems in Oberoesterreich (Forellenregion, Abschnitt Piberbach bis Neuhofen). Keine Erklaerung, nur JSON:
{"gewaesser_info":{"name":"Krems","region":"...","fischregion_typ":"...","charakteristik":"..."},"fischarten_inventar":[{"name":"...","wissenschaftlicher_name":"...","vorkommen":"natuerlich/Besatz/selten","besatz_empfehlung":"hoch/mittel/niedrig/nein","management_hinweis":"..."}],"strategische_empfehlungen":["..."],"oekologischer_zustand_prognose":"..."}`;

    console.log('[Revier] Starte Analyse...');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(25000),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[Revier] API Error:', response.status, errText.substring(0, 300));
      return res.status(502).json({ error: `Gemini Fehler (HTTP ${response.status})` });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('[Revier] Response length:', text.length);
    console.log('[Revier] First 400 chars:', text.substring(0, 400));

    if (!text) {
      console.error('[Revier] Empty response. Full data:', JSON.stringify(data).substring(0, 500));
      return res.status(502).json({ error: 'Leere Antwort von Gemini.' });
    }

    const analysis = extractJSON(text);

    if (!analysis || !analysis.gewaesser_info || !analysis.fischarten_inventar) {
      console.error('[Revier] Parse failed. Raw:', text.substring(0, 800));
      return res.status(502).json({ error: 'Analyse konnte nicht verarbeitet werden. Bitte erneut versuchen.' });
    }

    cachedAnalysis = { analysis, analyzedAt: new Date().toISOString() };
    cacheTimestamp = Date.now();

    console.log('[Revier] OK, Arten:', analysis.fischarten_inventar.length);
    res.json({ ...cachedAnalysis, cached: false });
  } catch (err) {
    console.error('[Revier] Error:', err.message);
    res.status(500).json({ error: 'Analyse fehlgeschlagen: ' + err.message });
  }
});

module.exports = router;
