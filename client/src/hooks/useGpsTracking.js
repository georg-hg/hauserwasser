import { useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';

/**
 * Sendet die GPS-Position des Benutzers alle `intervalMs` Millisekunden
 * an den Server, solange ein aktiver (nicht abgeschlossener) Fischtag läuft.
 *
 * @param {string|null} fishingDayId - ID des aktiven Fischtags (null = kein Tracking)
 * @param {boolean} completed - Ob der Fischtag abgeschlossen ist
 * @param {number} intervalMs - Intervall in ms (Standard: 5 Minuten)
 */
export function useGpsTracking(fishingDayId, completed = false, intervalMs = 5 * 60 * 1000) {
  const intervalRef = useRef(null);
  const watchRef = useRef(null);
  const lastSentRef = useRef(null);

  const sendPosition = useCallback(async (lat, lng) => {
    if (!fishingDayId) return;

    // Nicht senden wenn Position sich kaum geändert hat (< ~10m)
    if (lastSentRef.current) {
      const dLat = Math.abs(lat - lastSentRef.current.lat);
      const dLng = Math.abs(lng - lastSentRef.current.lng);
      if (dLat < 0.0001 && dLng < 0.0001) return;
    }

    try {
      await api.put(`/api/fishing-days/${fishingDayId}/position`, {
        latitude: lat,
        longitude: lng,
      });
      lastSentRef.current = { lat, lng };
    } catch (err) {
      console.error('GPS-Tracking Fehler:', err);
    }
  }, [fishingDayId]);

  const getAndSendPosition = useCallback(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendPosition(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.warn('GPS-Tracking: Position nicht verfügbar', err.code);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  }, [sendPosition]);

  useEffect(() => {
    // Nur tracken wenn aktiver Fischtag existiert und nicht abgeschlossen
    if (!fishingDayId || completed) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Sofort erste Position senden
    getAndSendPosition();

    // Dann alle intervalMs wiederholen
    intervalRef.current = setInterval(getAndSendPosition, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fishingDayId, completed, intervalMs, getAndSendPosition]);
}
