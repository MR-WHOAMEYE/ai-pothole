// @ts-nocheck
import * as React from 'react';
import ReactMapGL, { Marker, NavigationControl, Source, Layer, useMap } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/src/lib/utils';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';

export const MapContext = React.createContext<any>(null);

export interface BaseMapProps {
  className?: string;
  children?: React.ReactNode;
  initialViewState?: any;
  center?: [number, number];
  zoom?: number;
  style?: React.CSSProperties;
  [key: string]: any;
}

const CARTO_DARK_MATTER = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const CARTO_POSITRON = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

function MapUpdater({ center }: { center?: [number, number] }) {
  const { current: map } = useMap();

  React.useEffect(() => {
    if (map && center) {
      map.flyTo({
        center: center,
        essential: true,
        duration: 800,
      });
    }
  }, [center, map]);

  return null;
}

export function Map({ className, children, initialViewState, center, zoom, style, ...props }: BaseMapProps) {
  const { resolvedTheme } = useTheme();
  const isLight = document.documentElement.classList.contains('light') || resolvedTheme === 'light';

  const viewState = initialViewState || (center ? { longitude: center[0], latitude: center[1], zoom: zoom || 4 } : undefined);

  return (
    <div className={cn('relative w-full h-full', className)} style={style}>
      <ReactMapGL
        {...(viewState ? { initialViewState: viewState } : {})}
        mapStyle={isLight ? CARTO_POSITRON : CARTO_DARK_MATTER}
        attributionControl={false}
        {...props}
      >
        <MapUpdater center={center} />
        <MapContext.Provider value={{}}>
          {children}
        </MapContext.Provider>
      </ReactMapGL>
    </div>
  );
}

const MarkerContext = React.createContext<any>(null);

export function MapMarker({
  latitude,
  longitude,
  children,
}: {
  latitude: number;
  longitude: number;
  children?: React.ReactNode;
  key?: React.Key;
}) {
  const [showPopup, setShowPopup] = React.useState(false);
  const markerRef = React.useRef<HTMLDivElement>(null);

  // We toggle popup on click
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPopup((s) => !s);
  };

  return (
    <Marker latitude={latitude} longitude={longitude} anchor="bottom">
      <MarkerContext.Provider value={{ showPopup, setShowPopup, markerRef }}>
        <div ref={markerRef} onClick={onClick} className="relative cursor-pointer flex flex-col items-center">
          {children}
        </div>
      </MarkerContext.Provider>
    </Marker>
  );
}

export function MarkerContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function MarkerLabel({ position = 'bottom', children }: { position?: 'bottom' | 'top'; children: React.ReactNode }) {
  return (
    <div className={cn("absolute whitespace-nowrap z-10", position === 'bottom' ? "top-full mt-1" : "bottom-full mb-1")}>
      {children}
    </div>
  );
}

export function MarkerPopup({ children, className }: { children: React.ReactNode; className?: string }) {
  const { showPopup, setShowPopup, markerRef } = React.useContext(MarkerContext);

  // Basic portal popup attaching to body but using fixed positioning based on markerRef
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    if (showPopup && markerRef.current) {
      setRect(markerRef.current.getBoundingClientRect());
      
      const updatePos = () => {
        if(markerRef.current) setRect(markerRef.current.getBoundingClientRect());
      }
      window.addEventListener('scroll', updatePos, true);
      window.addEventListener('resize', updatePos);
      return () => {
         window.removeEventListener('scroll', updatePos, true);
         window.removeEventListener('resize', updatePos);
      }
    }
  }, [showPopup, markerRef]);

  // Click outside to close
  React.useEffect(() => {
    if (!showPopup) return;
    const clickOutside = (e: MouseEvent) => {
      // Small timeout to prevent immediate close if clicking the marker
      setTimeout(() => setShowPopup(false), 10); 
    };
    document.addEventListener('click', clickOutside);
    return () => document.removeEventListener('click', clickOutside);
  }, [showPopup, setShowPopup]);

  if (!showPopup || !rect) return null;

  return createPortal(
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "fixed z-[1000] bg-zinc-900 w-64 rounded-xl shadow-xl border border-zinc-800 p-3 overflow-hidden pointer-events-auto",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        className
      )}
      style={{
        top: rect.top - 12,
        left: rect.left + rect.width / 2,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {children}
    </div>,
    document.body
  );
}

export function MapRoute({
  coordinates,
  color = 'var(--color-map-route)',
  lineWidth = 3,
  width,
  opacity = 0.5,
}: {
  coordinates: [number, number][]; // [longitude, latitude]
  color?: string;
  lineWidth?: number;
  width?: number; // fallback for prompt
  opacity?: number;
}) {
  if (coordinates.length < 2) return null;

  const geojson = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates,
    },
  };

  const actualWidth = width ?? lineWidth;

  return (
    <Source type="geojson" data={geojson}>
      <Layer
        id={`route-${Math.random().toString(36).substr(2, 9)}`}
        type="line"
        paint={{
          'line-color': color,
          'line-width': actualWidth,
          'line-opacity': opacity,
        }}
        layout={{
          'line-join': 'round',
          'line-cap': 'round',
        }}
      />
    </Source>
  );
}

export function MapControls({
  position = 'bottom-right',
  showZoom = true,
  showCompass = true,
  showLocate = false,
  showFullscreen = false,
}: any) {
  return (
    <div className={cn("absolute m-4", {
      'bottom-0 right-0': position === 'bottom-right',
      'top-0 right-0': position === 'top-right',
      'top-0 left-0': position === 'top-left',
      'bottom-0 left-0': position === 'bottom-left'
    })}>
       <NavigationControl showCompass={showCompass} showZoom={showZoom} />
    </div>
  );
}
