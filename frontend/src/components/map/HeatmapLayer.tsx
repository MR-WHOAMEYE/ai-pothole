import React from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';

interface HeatmapLayerProps {
  data: { lat: number; lng: number; count: number }[];
}

export function HeatmapLayer({ data }: HeatmapLayerProps) {
  const geojson = {
    type: 'FeatureCollection' as const,
    features: data.map((d, index) => ({
      type: 'Feature' as const,
      id: index,
      properties: {
        count: d.count,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [d.lng, d.lat],
      },
    })),
  };

  return (
    <Source type="geojson" data={geojson}>
      <Layer
        id="heatmap-layer"
        type="heatmap"
        paint={{
          // Increase the heatmap weight based on frequency and property magnitude
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'count'],
            0, 0,
            10, 1
          ],
          // Increase the heatmap color weight by zoom-level
          // heatmap-intensity is a multiplier on top of heatmap-weight
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 1,
            15, 3
          ],
          // Color ramp for heatmap.  Red gradient as requested.
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(244, 67, 54, 0)',
            0.2, 'rgba(244, 67, 54, 0.2)',
            0.4, 'rgba(244, 67, 54, 0.5)',
            0.6, 'rgba(244, 67, 54, 0.7)',
            0.8, 'rgba(244, 67, 54, 0.9)',
            1, 'rgba(244, 67, 54, 1)'
          ],
          // Adjust the heatmap radius by zoom level
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 5,
            15, 25
          ],
          // Transition from heatmap to circles of individual points at high zoom
          'heatmap-opacity': 0.8
        }}
      />
    </Source>
  );
}
