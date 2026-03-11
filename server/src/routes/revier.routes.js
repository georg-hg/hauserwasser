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

    const prompt = `Du bist ein Experte fuer Limnologie und Fischereimanagement in Oesterreich.
Analysiere den Flussabschnitt der "Krems" in Oberoesterreich zwischen den folgenden Koordinaten:
- Oberkante (Piberbach/Kematen): 48.117156, 14.210667
- Unterkante (Neuhofen an der Krems): 48.130520, 14.225703

Erstelle eine detaillierte Analyse fuer ein nachhaltiges Besatzmanagement.

Antworte ausschliesslich mit einem JSON-Objekt in dieser Struktur:
{"gewaesser_info":{"name":"Krems (OOe)","region":"...","fischregion_typ":"...","charakteristik":"..."},"fischarten_inventar":[{"name":"...","wissenschaftlicher_name":"...","vorkommen":"natuerlich/Besatz/selten","besatz_empfehlung":"hoch/mittel/niedrig/nein","management_hinweis":"..."}],"strategische_empfehlungen":["..."],"oekologischer_zustand_prognose":"..."}`;

    console.log('[Revier] Starte Analyse...');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
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

// ── Static Map Proxy (nutzt serverseitigen GOOGLE_MAPS_API_KEY) ──
router.get('/static-map', async (req, res) => {
  try {
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!mapsKey) {
      return res.status(503).json({ error: 'GOOGLE_MAPS_API_KEY nicht konfiguriert.' });
    }

    const { size, maptype, markers } = req.query;
    const params = new URLSearchParams({
      size: size || '600x400',
      maptype: maptype || 'satellite',
      key: mapsKey,
    });

    // markers kann mehrfach vorkommen
    const markersArr = Array.isArray(markers) ? markers : (markers ? [markers] : []);
    markersArr.forEach(m => params.append('markers', m));

    const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      console.error('[Revier] Static Map Error:', response.status);
      return res.status(response.status).json({ error: 'Static Map Fehler' });
    }

    // Bild direkt durchleiten
    res.set('Content-Type', response.headers.get('content-type') || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // 24h Cache
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[Revier] Static Map Error:', err.message);
    res.status(500).json({ error: 'Kartenfehler: ' + err.message });
  }
});

module.exports = router;
