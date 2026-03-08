import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone === true) return;

    // iOS detection
    const ua = window.navigator.userAgent.toLowerCase();
    const isiOS = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
    setIsIos(isiOS);

    // Check if dismissed recently
    const dismissed = localStorage.getItem('hw_pwa_dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return; // 7 days
    }

    if (isiOS) {
      // Show iOS install hint after 3 seconds
      const timer = setTimeout(() => setShowIosHint(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop: listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIosHint(false);
    localStorage.setItem('hw_pwa_dismissed', Date.now().toString());
  };

  // Android/Desktop install banner
  if (showBanner) {
    return (
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <img src="/icons/icon-96x96.png" alt="" className="w-12 h-12 rounded-xl" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Hauserwasser installieren</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Fangbuch direkt am Homescreen – schneller Zugriff, auch offline.
              </p>
            </div>
            <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 p-1 -mt-1 -mr-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleDismiss}
              className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Spaeter
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 px-3 py-2 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Installieren
            </button>
          </div>
        </div>
      </div>
    );
  }

  // iOS install hint
  if (showIosHint && isIos) {
    return (
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <img src="/icons/icon-96x96.png" alt="" className="w-12 h-12 rounded-xl" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Zum Homescreen hinzufuegen</p>
              <p className="text-xs text-gray-500 mt-1">
                Tippe auf{' '}
                <svg className="inline w-4 h-4 text-blue-500 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {' '}und dann <strong>&quot;Zum Home-Bildschirm&quot;</strong>.
              </p>
            </div>
            <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 p-1 -mt-1 -mr-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
