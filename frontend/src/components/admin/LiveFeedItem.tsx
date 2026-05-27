import React from 'react';
import { DamageReport } from '@/src/lib/mockData';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/src/components/ui/badge';

interface LiveFeedItemProps {
  report: DamageReport;
  isActive?: boolean;
  onClick?: () => void;
}

export function LiveFeedItem({ report, isActive = false, onClick }: LiveFeedItemProps) {
  const { streetAddress, severity, status, detectedAt, estimatedDepthCm } = report;

  const timeAgo = detectedAt
    ? formatDistanceToNow(new Date(detectedAt), { addSuffix: true })
    : 'recently';

  const severityColor = {
    CRITICAL: '#F44336',
    MODERATE: '#FFC107',
    MINOR: '#4CAF50',
  }[severity || 'MINOR'];

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex gap-3 ${
        isActive
          ? 'bg-zinc-800/80 border-zinc-700 shadow-md'
          : 'bg-zinc-900 border-zinc-800/60 hover:border-zinc-800 hover:bg-zinc-900/80'
      }`}
    >
      {/* Thumbnail */}
      <div className="relative size-12 rounded-lg overflow-hidden bg-zinc-950 flex-shrink-0">
        <img
          src={report.imageUrl}
          alt="thumbnail"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute bottom-1 right-1 size-2.5 rounded-full border border-zinc-950"
          style={{ backgroundColor: severityColor }}
        />
      </div>

      {/* Details */}
      <div className="flex-grow min-w-0 flex flex-col justify-between">
        <div className="flex justify-between items-start gap-1">
          <span className="text-xs font-semibold text-zinc-200 truncate block">
            {streetAddress || 'Unnamed Road'}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono flex-shrink-0">
            {timeAgo}
          </span>
        </div>
        <div className="flex justify-between items-center gap-2 mt-1">
          <span className="text-[10px] text-zinc-400 capitalize">
            Status: <span className="text-zinc-300 font-medium">{status.toLowerCase()}</span>
          </span>
          {estimatedDepthCm !== undefined && (
            <Badge
              variant="outline"
              className="text-[9px] font-mono px-1 py-0 border-zinc-800 text-zinc-400"
            >
              {estimatedDepthCm != null ? estimatedDepthCm.toFixed(1) : 'N/A'} cm
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
