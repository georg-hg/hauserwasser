const router = require('express').Router();

// Riverapp Station-IDs
const STATIONS = {
  kremsmuenster: '57b4c05fab79914f93656957',
  kremsdorf: '570a371b3dadf981ecd0ad1c',
};

// Simple in-memory cache (5 min TTL)
let cache = {};
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Parse water data from Riverapp HTML.
 * Riverapp is a Next.js app — data is embedded in __NEXT_DATA__ or as
 * schema.org JSON-LD. We try multiple extraction strategies.
 */
function parseWaterData(html) {
  const result = { pegel: null, durchfluss: null, temperatur: null, trend: null };

  // Strategy 1: __NEXT_DATA__ (most reliable for Next.js apps)
  try {
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      const nextData = JSON.parse(nextDataMatch[1]);
      // Walk through the props tree to find measurement data
      const props = nextData?.props?.pageProps;
      if (props) {
        extractFromNextData(props, result);
      }
    }
  } catch (e) {
    // continue to other strategies
  }

  // Strategy 2: JSON-LD structured data
  if (!result.pegel && !result.temperatur) {
    try {
      const jsonLdBlocks = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
      for (const block of jsonLdBlocks) {
        const jsonStr = block.replace(/<\/?script[^>]*>/gi, '').trim();
        try {
          const data = JSON.parse(jsonStr);
          extractFromJsonLd(data, result);
        } catch {}
      }
    } catch {}
  }

  // Strategy 3: Regex extraction from rendered HTML/embedded data
  if (!result.pegel) {
    // Look for measurement values in data attributes or JSON-like structures
    const patterns = [
      // Value patterns like "value":79,"unit":"cm" near "Pegel"
      /"(?:water_?level|pegel|wasserstand)"[^}]*?"value"\s*:\s*([\d.]+)/gi,
      /"value"\s*:\s*([\d.]+)[^}]*?"(?:water_?level|pegel|wasserstand)"/gi,
      // Simple visible text like "79 cm"
      /Pegel[^<]*?(\d+(?:\.\d+)?)\s*cm/i,
      /Wasserstand[^<]*?(\d+(?:\.\d+)?)\s*cm/i,
    ];
    for (const pat of patterns) {
      const m = pat.exec(html);
      if (m) {
        result.pegel = { value: parseFloat(m[1]), unit: 'cm', timestamp: null };
        break;
      }
    }
  }

  if (!result.temperatur) {
    const patterns = [
      /"(?:water_?temp|temperatur)"[^}]*?"value"\s*:\s*([\d.]+)/gi,
      /"value"\s*:\s*([\d.]+)[^}]*?"(?:water_?temp|temperatur)"/gi,
      /Wassertemperatur[^<]*?(\d+(?:\.\d+)?)\s*°?C/i,
      /Temperatur[^<]*?(\d+(?:\.\d+)?)\s*°?C/i,
    ];
    for (const pat of patterns) {
      const m = pat.exec(html);
      if (m) {
        result.temperatur = { value: parseFloat(m[1]), unit: '°C', timestamp: null };
        break;
      }
    }
  }

  if (!result.durchfluss) {
    const patterns = [
      /"(?:discharge|durchfluss|abfluss)"[^}]*?"value"\s*:\s*([\d.]+)/gi,
      /"value"\s*:\s*([\d.]+)[^}]*?"(?:discharge|durchfluss|abfluss)"/gi,
      /Durchfluss[^<]*?(\d+(?:\.\d+)?)\s*m/i,
      /Abfluss[^<]*?(\d+(?:\.\d+)?)\s*m/i,
    ];
    for (const pat of patterns) {
      const m = pat.exec(html);
      if (m) {
        result.durchfluss = { value: parseFloat(m[1]), unit: 'm³/s', timestamp: null };
        break;
      }
    }
  }

  // Strategy 4: Comprehensive JSON value extraction
  // Look for measurement series data embedded anywhere in the HTML
  if (!result.pegel || !result.temperatur || !result.durchfluss) {
    try {
      // Find all measurement-like JSON blocks
      const measureRegex = /"measurements?"?\s*:\s*\[([^\]]{10,})\]/g;
      let mMatch;
      while ((mMatch = measureRegex.exec(html)) !== null) {
        try {
          const arr = JSON.parse(`[${mMatch[1]}]`);
          // measurements are typically arrays of [timestamp, value]
          if (arr.length > 0 && Array.isArray(arr[0])) {
            const lastValue = arr[arr.length - 1];
            if (lastValue && lastValue.length >= 2) {
              // Determine what this measurement is based on context
              const context = html.substring(Math.max(0, mMatch.index - 200), mMatch.index);
              if (!result.pegel && /pegel|wasserstand|water.?level/i.test(context)) {
                result.pegel = { value: lastValue[1], unit: 'cm', timestamp: null };
              } else if (!result.temperatur && /temperatur|temperature/i.test(context)) {
                result.temperatur = { value: lastValue[1], unit: '°C', timestamp: null };
              } else if (!result.durchfluss && /durchfluss|discharge|abfluss/i.test(context)) {
                result.durchfluss = { value: lastValue[1], unit: 'm³/s', timestamp: null };
              }
            }
          }
        } catch {}
      }
    } catch {}
  }

  // Trend extraction
  if (!result.trend) {
    const trendMatch = html.match(/"trend"\s*:\s*"([^"]+)"/i);
    if (trendMatch) result.trend = trendMatch[1].toLowerCase();
  }

  return result;
}

/**
 * Extract data from Next.js __NEXT_DATA__ props
 */
function extractFromNextData(obj, result) {
  if (!obj || typeof obj !== 'object') return;

  // Recursively search for measurement-like structures
  const keys = Object.keys(obj);
  for (const key of keys) {
    const val = obj[key];
    const keyLower = key.toLowerCase();

    // Direct value match
    if (typeof val === 'number') {
      if (!result.pegel && (keyLower.includes('waterlevel') || keyLower.includes('pegel') || keyLower.includes('wasserstand'))) {
        result.pegel = { value: val, unit: 'cm', timestamp: null };
      } else if (!result.temperatur && (keyLower.includes('temperature') || keyLower.includes('temperatur'))) {
        result.temperatur = { value: val, unit: '°C', timestamp: null };
      } else if (!result.durchfluss && (keyLower.includes('discharge') || keyLower.includes('durchfluss'))) {
        result.durchfluss = { value: val, unit: 'm³/s', timestamp: null };
      }
    }

    // Object with value property
    if (val && typeof val === 'object' && 'value' in val) {
      const v = parseFloat(val.value);
      if (!isNaN(v)) {
        if (!result.pegel && (keyLower.includes('waterlevel') || keyLower.includes('pegel') || keyLower === 'level')) {
          result.pegel = { value: v, unit: val.unit || 'cm', timestamp: val.timestamp || val.time || null };
        } else if (!result.temperatur && (keyLower.includes('temperature') || keyLower.includes('temp'))) {
          result.temperatur = { value: v, unit: val.unit || '°C', timestamp: val.timestamp || val.time || null };
        } else if (!result.durchfluss && (keyLower.includes('discharge') || keyLower.includes('flow'))) {
          result.durchfluss = { value: v, unit: val.unit || 'm³/s', timestamp: val.timestamp || val.time || null };
        }
      }
    }

    // Recurse into sub-objects (max depth ~5)
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      extractFromNextData(val, result);
    }

    // Check arrays (e.g., series of measurements)
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
      // Try to get the last element if it looks like time-series data
      const last = val[val.length - 1];
      if (last && 'value' in last) {
        extractFromNextData({ [key + '_last']: last }, result);
      }
    }
  }
}

/**
 * Extract from JSON-LD schema.org data
 */
function extractFromJsonLd(data, result) {
  const items = Array.isArray(data) ? data : [data];
  for (const item of items) {
    if (!item || !item.name) continue;
    const name = item.name.toLowerCase();
    const val = parseFloat(item.value);
    if (isNaN(val)) continue;

    if (!result.pegel && (name.includes('pegel') || name.includes('wasserstand') || name.includes('water level'))) {
      result.pegel = { value: val, unit: item.unitText || 'cm', timestamp: item.dateModified || null };
    } else if (!result.durchfluss && (name.includes('durchfluss') || name.includes('discharge') || name.includes('abfluss'))) {
      result.durchfluss = { value: val, unit: item.unitText || 'm³/s', timestamp: item.dateModified || null };
    } else if (!result.temperatur && (name.includes('temperatur') || name.includes('temperature'))) {
      result.temperatur = { value: val, unit: item.unitText || '°C', timestamp: item.dateModified || null };
    }

    // Handle nested graph items
    if (item['@graph']) extractFromJsonLd(item['@graph'], result);
  }
}

async function fetchStation(stationId) {
  const now = Date.now();
  if (cache[stationId] && (now - cache[stationId].ts) < CACHE_TTL) {
    return cache[stationId].data;
  }

  try {
    const url = `https://www.riverapp.net/de/station/${stationId}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Hauserwasser/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();

    console.log(`[Water] Fetched ${url} (${html.length} bytes)`);

    const data = parseWaterData(html);

    console.log(`[Water] Parsed ${stationId}:`, JSON.stringify(data));

    // Only cache if we got at least some data
    if (data.pegel || data.temperatur || data.durchfluss) {
      cache[stationId] = { ts: now, data };
    }

    return data;
  } catch (err) {
    console.error(`[Water] Fetch error (${stationId}):`, err.message);
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
    console.error('[Water] Error:', err);
    res.status(500).json({ error: 'Wasserdaten konnten nicht geladen werden.' });
  }
});

// GET /api/water/debug – diagnostic endpoint (dev only)
router.get('/debug', async (req, res) => {
  try {
    const stationId = STATIONS.kremsmuenster;
    const url = `https://www.riverapp.net/de/station/${stationId}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Hauserwasser/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-AT,de;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await resp.text();

    // Check what we got
    const hasNextData = html.includes('__NEXT_DATA__');
    const hasJsonLd = html.includes('application/ld+json');
    const hasPegel = /pegel/i.test(html);
    const hasTemperatur = /temperatur/i.test(html);

    // Extract a snippet around key words
    const pegelSnippet = extractSnippet(html, /pegel/i, 200);
    const tempSnippet = extractSnippet(html, /temperatur/i, 200);

    const parsed = parseWaterData(html);

    res.json({
      htmlLength: html.length,
      hasNextData,
      hasJsonLd,
      hasPegel,
      hasTemperatur,
      pegelSnippet,
      tempSnippet,
      parsed,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function extractSnippet(html, pattern, around) {
  const m = pattern.exec(html);
  if (!m) return null;
  const start = Math.max(0, m.index - around);
  const end = Math.min(html.length, m.index + m[0].length + around);
  return html.substring(start, end);
}

module.exports = router;
