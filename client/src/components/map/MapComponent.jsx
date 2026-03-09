import { useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { getSpeciesGerman, getSpeciesColor } from '../../utils/fishSpecies';

// ============================================================
// Exakte Revierkoordinaten aus Fischereibuchauszug ON 30/5
// BH Linz-Land, umgerechnet von BMN M31 (EPSG:31255) -> WGS84
// ============================================================
const REVIER = {
  obergrenze: {
    punkt3: { lat: 48.117336, lng: 14.210773 },
    punkt4: { lat: 48.117132, lng: 14.211036 },
    label: 'Obergrenze (ehem. Lindlmair-Infang)',
  },
  untergrenze: {
    // Zwei Punkte an den gegenueberliegenden Ufern fuer Linie ueber den Fluss
    uferLinks:  { lat: 48.13042, lng: 14.22545 },
    uferRechts: { lat: 48.13072, lng: 14.22630 },
    center:     { lat: 48.13057, lng: 14.22588 },
    label: 'Untergrenze (50m ob. Obermuehlwehr)',
    flussKm: 17.070,
    regKm: 13.472,
  },
  center: { lat: 48.124, lng: 14.218 },
  bounds: { north: 48.134, south: 48.114, east: 14.230, west: 14.200 },
};

const containerStyle = { width: '100%', height: '100%' };

const mapOptions = {
  mapTypeId: 'satellite',
  mapTypeControl: false,
  zoomControl: true,
  streetViewControl: false,
  fullscreenControl: true,
  gestureHandling: 'greedy',
};

export default function MapComponent({
  catches = [],
  onLocationSelect,
  selectedPosition,
  currentPosition,
  height = 'h-[350px] md:h-[500px] lg:h-[600px]',
}) {
  const [activeMarker, setActiveMarker] = useState(null);
  const mapRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  });

  const onLoad = useCallback((mapInstance) => {
    mapRef.current = mapInstance;

    // Revier-Begrenzungsrechteck
    new google.maps.Rectangle({
      bounds: REVIER.bounds,
      strokeColor: '#2563EB',
      strokeOpacity: 0.6,
      strokeWeight: 2,
      fillColor: '#2563EB',
      fillOpacity: 0.05,
      clickable: false,
      map: mapInstance,
    });

    // Obergrenze (exakte BMN-Koordinaten)
    new google.maps.Polyline({
      path: [REVIER.obergrenze.punkt3, REVIER.obergrenze.punkt4],
      strokeColor: '#EF4444',
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map: mapInstance,
    });

    const ogCenter = {
      lat: (REVIER.obergrenze.punkt3.lat + REVIER.obergrenze.punkt4.lat) / 2,
      lng: (REVIER.obergrenze.punkt3.lng + REVIER.obergrenze.punkt4.lng) / 2,
    };
    new google.maps.Marker({
      position: ogCenter, map: mapInstance,
      label: { text: 'OG', color: '#fff', fontWeight: 'bold', fontSize: '11px' },
      title: REVIER.obergrenze.label,
      icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#EF4444', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 14 },
    });

    // Untergrenze – rote Linie von Ufer zu Ufer
    new google.maps.Polyline({
      path: [REVIER.untergrenze.uferLinks, REVIER.untergrenze.uferRechts],
      strokeColor: '#EF4444',
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map: mapInstance,
    });

    new google.maps.Marker({
      position: REVIER.untergrenze.center, map: mapInstance,
      label: { text: 'UG', color: '#fff', fontWeight: 'bold', fontSize: '11px' },
      title: REVIER.untergrenze.label,
      icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#EF4444', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 14 },
    });
  }, []);

  const handleMapClick = useCallback((event) => {
    onLocationSelect?.({
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    });
  }, [onLocationSelect]);

  const handleGPS = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onLocationSelect?.(loc);
        mapRef.current?.panTo(loc);
        mapRef.current?.setZoom(17);
      },
      (err) => console.error('GPS-Fehler:', err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleZoomToRevier = () => {
    if (!mapRef.current) return;
    const bounds = new google.maps.LatLngBounds(
      { lat: REVIER.bounds.south, lng: REVIER.bounds.west },
      { lat: REVIER.bounds.north, lng: REVIER.bounds.east }
    );
    mapRef.current.fitBounds(bounds);
  };

  if (loadError) {
    return (
      <div className={`flex items-center justify-center ${height} bg-gray-100 rounded-lg`}>
        <p className="text-red-500 text-sm">Karte konnte nicht geladen werden.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center ${height} bg-gray-100 rounded-lg animate-pulse`}>
        <p className="text-gray-400 text-sm">Karte wird geladen...</p>
      </div>
    );
  }

  return (
    <div className={`relative ${height} rounded-lg overflow-hidden shadow-lg`}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={currentPosition || REVIER.center}
        zoom={15}
        options={mapOptions}
        onLoad={onLoad}
        onClick={handleMapClick}
      >
        {/* Aktuelle Position */}
        {currentPosition && (
          <Marker
            position={currentPosition}
            icon={{ path: google.maps.SymbolPath.CIRCLE, fillColor: '#3B82F6', fillOpacity: 1, strokeWeight: 3, strokeColor: '#fff', scale: 8 }}
            title="Dein Standort"
          />
        )}

        {/* Gewaehlte Position */}
        {selectedPosition && (
          <Marker
            position={selectedPosition}
            animation={google.maps.Animation.DROP}
            icon={{ path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, fillColor: '#EF4444', fillOpacity: 1, strokeWeight: 2, strokeColor: '#fff', scale: 6 }}
          />
        )}

        {/* Bisherige Faenge */}
        {catches.map((c) => (
          <Marker
            key={c.id}
            position={{ lat: parseFloat(c.latitude), lng: parseFloat(c.longitude) }}
            icon={{ path: google.maps.SymbolPath.CIRCLE, fillColor: getSpeciesColor(c.fish_species), fillOpacity: 0.9, strokeWeight: 2, strokeColor: '#fff', scale: 10 }}
            onClick={() => setActiveMarker(c.id)}
          >
            {activeMarker === c.id && (
              <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                <div className="p-1 max-w-[200px]">
                  <p className="font-bold text-sm">{c.german_name || getSpeciesGerman(c.fish_species)}</p>
                  <p className="text-xs text-gray-600">
                    {c.length_cm && `${c.length_cm} cm`}
                    {c.weight_kg && ` / ${c.weight_kg} kg`}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(c.catch_date).toLocaleDateString('de-AT')}
                  </p>
                  {c.photo_url && (
                    <img src={c.photo_url} alt="" className="mt-1 rounded w-full h-16 object-cover" />
                  )}
                </div>
              </InfoWindow>
            )}
          </Marker>
        ))}
      </GoogleMap>

      {/* Hauserwasser – prominent rechts oben */}
      <button
        onClick={handleZoomToRevier}
        className="absolute top-3 right-3 z-10 bg-primary-700 hover:bg-primary-800 active:bg-primary-900 text-white px-4 py-2.5 rounded-lg shadow-xl transition-colors flex items-center gap-2"
        title="Zum Hauserwasser zoomen"
      >
        <img src="/icons/icon-96x96.png" alt="" className="w-6 h-6 rounded-full" />
        <span className="text-sm font-bold tracking-wide">Hauserwasser</span>
      </button>

      {/* GPS-Button rechts unten */}
      <button
        onClick={handleGPS}
        className="absolute bottom-4 right-4 z-10 bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
        title="Meinen Standort verwenden"
      >
        <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  );
}
