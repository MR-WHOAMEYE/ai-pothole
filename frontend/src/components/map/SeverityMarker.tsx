import React from 'react';
import { MapMarker, MarkerContent, MarkerPopup } from './Map';
import { DamageReport } from '@/src/lib/mockData';
import { Badge } from '@/src/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface SeverityMarkerProps {
  report: DamageReport;
  onClickPopup?: () => void;
}

export function SeverityMarker({ report, onClickPopup }: SeverityMarkerProps) {
  const { latitude, longitude, severity, streetAddress, detectedAt, estimatedDepthCm } = report;

  if (latitude === undefined || longitude === undefined) return null;

  // Determine size & color based on severity
  const severityConfig = {
    CRITICAL: { color: '#F44336', size: 'size-6', label: 'CRITICAL' },
    MODERATE: { color: '#FFC107', size: 'size-5', label: 'MODERATE' },
    MINOR: { color: '#4CAF50', size: 'size-4', label: 'MINOR' },
  }[severity || 'MINOR'];

  const timeAgo = detectedAt
    ? formatDistanceToNow(new Date(detectedAt), { addSuffix: true })
    : 'recently';

  return (
    <MapMarker latitude={latitude} longitude={longitude}>
      <MarkerContent>
        {/* Glow effect for critical ones */}
        {severity === 'CRITICAL' && (
          <div
            className="absolute rounded-full animate-ping duration-1000 opacity-60 size-6"
            style={{ backgroundColor: severityConfig.color }}
          />
        )}
        <div
          className={`${severityConfig.size} rounded-full border-2 border-zinc-950 shadow-lg cursor-pointer transition-transform duration-200 hover:scale-125`}
          style={{ backgroundColor: severityConfig.color }}
        />
      </MarkerContent>

      <MarkerPopup>
        <div className="flex flex-col gap-2 text-zinc-100">
          <div className="flex justify-between items-start gap-2">
            <span className="font-semibold text-sm truncate w-[140px] block" title={streetAddress}>
              {streetAddress || 'Unnamed Road'}
            </span>
            <Badge
              variant="outline"
              style={{
                borderColor: severityConfig.color,
                color: severityConfig.color,
                backgroundColor: `${severityConfig.color}15`,
              }}
              className="text-[10px] px-1.5 py-0"
            >
              {severityConfig.label}
            </Badge>
          </div>

          <div className="text-zinc-400 text-xs flex flex-col gap-1">
            <span>Detected: {timeAgo}</span>
            {estimatedDepthCm !== undefined && (
              <span>Est. Depth: <strong className="text-zinc-200">{estimatedDepthCm != null ? estimatedDepthCm.toFixed(1) : 'N/A'} cm</strong></span>
            )}
            <span>Status: <strong className="text-zinc-200 capitalize">{report.status.toLowerCase()}</strong></span>
          </div>

          <Link
            to={`/admin/report/${report.id}`}
            onClick={onClickPopup}
            className="mt-1 block text-center text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-medium py-1.5 px-3 rounded-lg transition-colors"
          >
            View Details
          </Link>
        </div>
      </MarkerPopup>
    </MapMarker>
  );
}
