const router = require('express').Router();

// Riverapp Station-IDs
const STATIONS = {
  kremsmuenster: '57b4c05fab79914f93656957',
  kremsdorf: '570a371b3dadf981ecd0ad1c',
};

// Simple in-memory cache (5 min TTL)
let cache = {};
const CACHE_TTL = 5 * 60 * 1000;

function parseSchemaData(html) {
  // Extract JSON-LD structured data from the page
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  const result = { pegel: null, durchfluss: null, temperatur: null, trend: null };

  if (!jsonLdMatch) return result;

  for (const block of jsonLdMatch) {
    try {
      const jsonStr = block.replace(/<\/?script[^>]*>/gi, '').trim();
      const data = JSON.parse(jsonStr);

      if (data['@type'] === 'PropertyValue' || (Array.isArray(data) && data[0]?.['@type'] === 'PropertyValue')) {
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const name = (item.name || '').toLowerCase();
          const val = parseFloat(item.value);
          if (name.includes('pegel') || name.includes('wasserstand') || name.includes('water level')) {
            result.pegel = { value: val, unit: item.unitText || 'cm', timestamp: item.dateModified || null };
          } else if (name.includes('durchfluss') || name.includes('discharge') || name.includes('abfluss')) {
            result.durchfluss = { value: val, unit: item.unitText || 'm³/s', timestamp: item.dateModified || null };
          } else if (name.includes('temperatur') || name.includes('temperature')) {
            result.temperatur = { value: val, unit: item.unitText || '°C', timestamp: item.dateModified || null };
          }
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  // Fallback: parse from embedded provider data
  if (!result.pegel || !result.temperatur) {
    try {
      // Look for stationPageProvider or similar embedded JSON
      const providerMatch = html.match(/"latestReadings"\s*:\s*(\{[\s\S]*?\})\s*[,}]/);
      if (providerMatch) {
        const readings = JSON.parse(providerMatch[1]);
        if (readings.waterLevel && !result.pegel) {
          result.pegel = { value: readings.waterLevel.value, unit: 'cm', timestamp: readings.waterLevel.timestamp };
        }
        if (readings.discharge && !result.durchfluss) {
          result.durchfluss = { value: readings.discharge.value, unit: 'm³/s', timestamp: readings.discharge.timestamp };
        }
        if (readings.temperature && !result.temperatur) {
          result.temperatur = { value: readings.temperature.value, unit: '°C', timestamp: readings.temperature.timestamp };
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Another fallback: regex for values in meta tags or visible text
  if (!result.pegel) {
    const pegelMatch = html.match(/(?:Pegel|Wasserstand)[^0-9]*?(\d+(?:\.\d+)?)\s*cm/i);
    if (pegelMatch) result.pegel = { value: parseFloat(pegelMatch[1]), unit: 'cm', timestamp: null };
  }
  if (!result.temperatur) {
    const tempMatch = html.match(/(?:Wassertemperatur|Temperatur)[^0-9]*?(\d+(?:\.\d+)?)\s*°?C/i);
    if (tempMatch) result.temperatur = { value: parseFloat(tempMatch[1]), unit: '°C', timestamp: null };
  }
  if (!result.durchfluss) {
    const flowMatch = html.match(/(?:Durchfluss|Abfluss)[^0-9]*?(\d+(?:\.\d+)?)\s*m/i);
    if (flowMatch) result.durchfluss = { value: parseFloat(flowMatch[1]), unit: 'm³/s', timestamp: null };
  }

  // Trend
  const trendMatch = html.match(/"trend"\s*:\s*"([^"]+)"/i);
  if (trendMatch) result.trend = trendMatch[1].toLowerCase();

  return result;
}

async function fetchStation(stationId) {
  const now = Date.now();
  if (cache[stationId] && (now - cache[stationId].ts) < CACHE_TTL) {
    return cache[stationId].data;
  }

  try {
    const url = `https://www.riverapp.net/de/station/${stationId}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Hauserwasser-App/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const data = parseSchemaData(html);
    cache[stationId] = { ts: now, data };
    return data;
  } catch (err) {
    console.error(`Riverapp fetch error (${stationId}):`, err.message);
    // Return stale cache if available
    if (cache[stationId]) return cache[stationId].data;
    return { pegel: null, durchfluss: null, temperatur: null, trend: null };
  }
}

// GET /api/water – both stations
router.get('/', async (req, res) => {
  try {
    const [kremsmuenster, kremsdorf] = await Promise.all([
      fetchStation(STATIONS.kremsmuenster),
      fetchStation(STATIONS.kremsdorf),
    ]);

    res.json({
      kremsmuenster: { name: 'Kremsmünster', ...kremsmuenster },
      kremsdorf: { name: 'Kremsdorf', ...kremsdorf },
      cachedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Water data error:', err);
    res.status(500).json({ error: 'Wasserdaten konnten nicht geladen werden.' });
  }
});

module.exports = router;
