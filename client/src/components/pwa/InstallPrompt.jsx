import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    // Check if already installed as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone === true) return;

    // iOS detection
    const ua = window.navigator.userAgent.toLowerCase();
    const isiOS = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
    setIsIos(isiOS);

    // Check if dismissed recently (only 24h now, was 7 days)
    const dismissed = localStorage.getItem('hw_pwa_dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 24 * 60 * 60 * 1000) return;
    }

    if (isiOS) {
      // Show iOS install hint immediately (was 3s delay)
      setShowIosHint(true);
      return;
    }

    // Android/Desktop: listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Also show banner after short delay as fallback (some browsers fire event late)
    const timer = setTimeout(() => setShowBanner(true), 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIosHint(false);
    localStorage.setItem('hw_pwa_dismissed', Date.now().toString());
  };

  // ── Android/Desktop: grosser Install-Banner ──
  if (showBanner && deferredPrompt) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={handleDismiss} />

        <div className="relative mx-3 mb-3 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Dismiss X */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Content */}
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center gap-4 mb-4">
              <img src="/icons/icon-96x96.png" alt="Hauserwasser" className="w-16 h-16 rounded-2xl shadow-md" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">Hauserwasser</h3>
                <p className="text-sm text-gray-500">Digitales Fangbuch</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Installiere die App am Homescreen fuer schnellen Zugriff auf dein Fangbuch, Wetter- und Gewaesserdaten – auch offline verfuegbar.
            </p>

            {/* Grosser Install-Button */}
            <button
              onClick={handleInstall}
              className="w-full py-4 text-base font-bold text-white bg-primary-600 rounded-xl active:bg-primary-700 transition-colors shadow-lg shadow-primary-600/30"
            >
              App installieren
            </button>

            <button
              onClick={handleDismiss}
              className="w-full py-3 mt-2 text-sm font-medium text-gray-500 active:text-gray-700 transition-colors"
            >
              Nicht jetzt
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── iOS: Schritt-fuer-Schritt Anleitung ──
  if (showIosHint && isIos) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={handleDismiss} />

        <div className="relative mx-3 mb-3 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Dismiss X */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Content */}
          <div className="px-5 pt-5 pb-5">
            <div className="flex items-center gap-4 mb-4">
              <img src="/icons/icon-96x96.png" alt="Hauserwasser" className="w-16 h-16 rounded-2xl shadow-md" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">Hauserwasser installieren</h3>
                <p className="text-sm text-gray-500">In 2 Schritten zur App</p>
              </div>
            </div>

            {/* Step 1 */}
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  Tippe unten auf{' '}
                  <svg className="inline w-6 h-6 text-blue-600 -mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {' '}Teilen
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                2
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  Waehle{' '}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-md border border-gray-200 text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Zum Home-Bildschirm
                  </span>
                </p>
              </div>
            </div>

            {/* Arrow pointing down to Safari share button */}
            <div className="flex justify-center mb-2">
              <svg className="w-8 h-8 text-blue-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>

            <button
              onClick={handleDismiss}
              className="w-full py-3 text-sm font-medium text-gray-500 active:text-gray-700 transition-colors"
            >
              Verstanden
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
