import { useEffect } from 'react';

// Öffentliche Seite ohne Login: bettet die eigenständige Auswertung
// "Trübungsmonitoring Krems" (client/public/truebungsmonitoring.html) ein.
export default function PublicMonitoring() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Trübungsmonitoring Krems — Stationsvergleich';
    return () => { document.title = previous; };
  }, []);

  return (
    <iframe
      src="/truebungsmonitoring.html"
      title="Trübungsmonitoring Krems — Stationsvergleich"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0, background: '#FAFAF9', zIndex: 1000 }}
    />
  );
}
