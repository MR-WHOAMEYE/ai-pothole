import React from 'react';
import { Map, MapControls } from './Map';
import { useLocationStore } from '@/src/stores/locationStore';

interface MapContainerProps {
  children?: React.ReactNode;
  center?: [number, number]; // [longitude, latitude]
  zoom?: number;
  className?: string;
  onMove?: (viewState: any) => void;
  onClick?: (e: any) => void;
}

export function MapContainer({
  children,
  center,
  zoom = 15,
  className = "h-full w-full",
  onMove,
  onClick
}: MapContainerProps) {
  const { lat, lng } = useLocationStore();

  // Prefer custom center prop, fall back to current user geolocated coordinates
  const mapCenter: [number, number] = center || [lng, lat];

  return (
    <Map
      center={mapCenter}
      zoom={zoom}
      className={className}
      onMove={onMove ? (e: any) => onMove(e.viewState) : undefined}
      onClick={onClick}
    >
      {children}
      <MapControls position="bottom-right" showCompass={true} showZoom={true} />
    </Map>
  );
}
