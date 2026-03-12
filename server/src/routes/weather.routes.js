const express = require('express');
const router = express.Router();

// ── Piberbach / Weifersdorf Koordinaten ──
const PIBERBACH_LAT = 48.1833;
const PIBERBACH_LON = 14.2167;

// ── Cache (5 Minuten) ──
let weatherCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

// ── WMO Wetter-Codes → deutsch + Icon ──
const WMO_CODES = {
  0: { text: 'Klar', icon: 'sunny' },
  1: { text: 'Ueberwiegend klar', icon: 'partly-cloudy' },
  2: { text: 'Teilweise bewoelkt', icon: 'partly-cloudy' },
  3: { text: 'Bewoelkt', icon: 'cloudy' },
  45: { text: 'Nebel', icon: 'fog' },
  48: { text: 'Reifnebel', icon: 'fog' },
  51: { text: 'Leichter Nieselregen', icon: 'drizzle' },
  53: { text: 'Nieselregen', icon: 'drizzle' },
  55: { text: 'Starker Nieselregen', icon: 'drizzle' },
  56: { text: 'Gefrierender Nieselregen', icon: 'freezing-rain' },
  57: { text: 'Starker gefr. Nieselregen', icon: 'freezing-rain' },
  61: { text: 'Leichter Regen', icon: 'rain' },
  63: { text: 'Regen', icon: 'rain' },
  65: { text: 'Starker Regen', icon: 'heavy-rain' },
  66: { text: 'Gefrierender Regen', icon: 'freezing-rain' },
  67: { text: 'Starker gefr. Regen', icon: 'freezing-rain' },
  71: { text: 'Leichter Schneefall', icon: 'snow' },
  73: { text: 'Schneefall', icon: 'snow' },
  75: { text: 'Starker Schneefall', icon: 'snow' },
  77: { text: 'Graupel', icon: 'snow' },
  80: { text: 'Leichte Regenschauer', icon: 'rain' },
  81: { text: 'Regenschauer', icon: 'rain' },
  82: { text: 'Heftige Regenschauer', icon: 'heavy-rain' },
  85: { text: 'Leichte Schneeschauer', icon: 'snow' },
  86: { text: 'Schneeschauer', icon: 'snow' },
  95: { text: 'Gewitter', icon: 'thunderstorm' },
  96: { text: 'Gewitter mit Hagel', icon: 'thunderstorm' },
  99: { text: 'Schweres Gewitter mit Hagel', icon: 'thunderstorm' },
};

function decodeWeather(code) {
  return WMO_CODES[code] || { text: 'Unbekannt', icon: 'cloudy' };
}

function getWindDirection(degrees) {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(degrees / 45) % 8];
}

// ── GET /api/weather ──
router.get('/', async (req, res) => {
  try {
    // Check cache
    if (weatherCache && Date.now() - cacheTimestamp < CACHE_TTL) {
      return res.json(weatherCache);
    }

    // Fetch current weather + 3-day forecast from Open-Meteo
    const params = new URLSearchParams({
      latitude: PIBERBACH_LAT,
      longitude: PIBERBACH_LON,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation',
        'rain',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'pressure_msl',
      ].join(','),
      hourly: [
        'temperature_2m',
        'precipitation_probability',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'apparent_temperature_max',
        'apparent_temperature_min',
        'sunrise',
        'sunset',
        'precipitation_sum',
        'precipitation_probability_max',
        'wind_speed_10m_max',
        'wind_gusts_10m_max',
        'wind_direction_10m_dominant',
      ].join(','),
      timezone: 'Europe/Vienna',
      forecast_days: 4, // today + 3 days
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const data = await response.json();

    // ── Build current weather ──
    const current = data.current;
    const weatherInfo = decodeWeather(current.weather_code);

    const result = {
      location: 'Piberbach / Weifersdorf',
      station: 'Sencrop RC0039022',
      current: {
        temperature: Math.round(current.temperature_2m * 10) / 10,
        feelsLike: Math.round(current.apparent_temperature * 10) / 10,
        humidity: current.relative_humidity_2m,
        precipitation: current.precipitation,
        rain: current.rain,
        windSpeed: Math.round(current.wind_speed_10m),
        windGusts: Math.round(current.wind_gusts_10m),
        windDirection: getWindDirection(current.wind_direction_10m),
        pressure: Math.round(current.pressure_msl),
        weatherCode: current.weather_code,
        weatherText: weatherInfo.text,
        weatherIcon: weatherInfo.icon,
        timestamp: data.current.time,
      },
      // ── Hourly forecast (next 24h) ──
      hourly: [],
      // ── Daily forecast (today + 3 days) ──
      forecast: [],
      source: 'Open-Meteo (DWD ICON)',
      updatedAt: new Date().toISOString(),
    };

    // Build hourly (next 24 hours)
    const now = new Date();
    const currentHourIdx = data.hourly.time.findIndex((t) => new Date(t) >= now);
    if (currentHourIdx >= 0) {
      for (let i = currentHourIdx; i < Math.min(currentHourIdx + 24, data.hourly.time.length); i++) {
        result.hourly.push({
          time: data.hourly.time[i],
          temperature: Math.round(data.hourly.temperature_2m[i] * 10) / 10,
          precipProbability: data.hourly.precipitation_probability[i],
          precipitation: data.hourly.precipitation[i],
          weatherCode: data.hourly.weather_code[i],
          weatherText: decodeWeather(data.hourly.weather_code[i]).text,
          weatherIcon: decodeWeather(data.hourly.weather_code[i]).icon,
          windSpeed: Math.round(data.hourly.wind_speed_10m[i]),
        });
      }
    }

    // Build daily forecast
    for (let i = 0; i < data.daily.time.length; i++) {
      const dayWeather = decodeWeather(data.daily.weather_code[i]);
      result.forecast.push({
        date: data.daily.time[i],
        tempMax: Math.round(data.daily.temperature_2m_max[i] * 10) / 10,
        tempMin: Math.round(data.daily.temperature_2m_min[i] * 10) / 10,
        feelsLikeMax: Math.round(data.daily.apparent_temperature_max[i] * 10) / 10,
        feelsLikeMin: Math.round(data.daily.apparent_temperature_min[i] * 10) / 10,
        sunrise: data.daily.sunrise[i],
        sunset: data.daily.sunset[i],
        precipSum: Math.round(data.daily.precipitation_sum[i] * 10) / 10,
        precipProbability: data.daily.precipitation_probability_max[i],
        windSpeedMax: Math.round(data.daily.wind_speed_10m_max[i]),
        windGustsMax: Math.round(data.daily.wind_gusts_10m_max[i]),
        windDirection: getWindDirection(data.daily.wind_direction_10m_dominant[i]),
        weatherCode: data.daily.weather_code[i],
        weatherText: dayWeather.text,
        weatherIcon: dayWeather.icon,
      });
    }

    // Cache result
    weatherCache = result;
    cacheTimestamp = Date.now();

    res.json(result);
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    // Return cached data if available
    if (weatherCache) {
      return res.json({ ...weatherCache, stale: true });
    }
    res.status(503).json({ error: 'Wetterdaten nicht verfuegbar.' });
  }
});

module.exports = router;
