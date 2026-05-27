import React from 'react';
import { DamageReport } from '@/src/lib/mockData';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';
import { StatusBadge } from './StatusBadge';
import { Badge } from '@/src/components/ui/badge';
import { Calendar, Compass, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface ReportCardProps {
  report: DamageReport;
  isAdmin?: boolean;
}

export function ReportCard({ report, isAdmin = false }: ReportCardProps) {
  const {
    id,
    imageUrl,
    streetAddress,
    severity,
    status,
    detectedAt,
    estimatedDepthCm,
    priorityScore,
  } = report;

  const severityColor = {
    CRITICAL: 'text-red-500 border-red-500 bg-red-950/10',
    MODERATE: 'text-yellow-500 border-yellow-500 bg-yellow-950/10',
    MINOR: 'text-green-500 border-green-500 bg-green-950/10',
  }[severity || 'MINOR'];

  const timeAgo = detectedAt
    ? formatDistanceToNow(new Date(detectedAt), { addSuffix: true })
    : 'recently';

  return (
    <Card className="overflow-hidden bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all duration-200 flex flex-col h-full group">
      {/* Image Preview */}
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
        <img
          src={imageUrl}
          alt={streetAddress || 'Pothole'}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {severity && (
          <Badge
            variant="outline"
            className={`absolute top-2 right-2 backdrop-blur-md uppercase text-[10px] font-bold px-2 py-0.5 ${severityColor}`}
          >
            {severity}
          </Badge>
        )}
      </div>

      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start gap-2 mb-1">
          <StatusBadge status={status} />
          {priorityScore !== undefined && (
            <span className="text-[11px] text-zinc-400 font-mono">
              Priority: <strong className="text-zinc-200">{priorityScore != null ? priorityScore.toFixed(0) : 'N/A'}</strong>
            </span>
          )}
        </div>
        <CardTitle className="text-sm font-semibold text-zinc-100 line-clamp-1">
          {streetAddress || 'Unnamed Road'}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 pt-0 pb-2 flex-grow text-xs text-zinc-400 space-y-2">
        {estimatedDepthCm !== undefined && (
          <div className="flex items-center gap-1.5 text-zinc-300">
            <ShieldAlert className="size-3.5 text-zinc-500" />
            <span>Estimated Depth: <strong className="text-zinc-100">{estimatedDepthCm != null ? estimatedDepthCm.toFixed(1) : 'N/A'} cm</strong></span>
          </div>
        )}
        
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Calendar className="size-3.5" />
          <span>Detected {timeAgo}</span>
        </div>

        {report.latitude && report.longitude && (
          <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-[10px]">
            <Compass className="size-3.5" />
            <span>{report.latitude != null ? report.latitude.toFixed(5) : 'N/A'}, {report.longitude != null ? report.longitude.toFixed(5) : 'N/A'}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0 border-t border-zinc-800/50 mt-auto bg-zinc-900/50 flex gap-2">
        <Link
          to={isAdmin ? `/admin/report/${id}` : `#`}
          className={`w-full mt-3 block text-center text-xs py-2 px-3 rounded-lg font-medium transition-colors ${
            isAdmin
              ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-950'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 pointer-events-none'
          }`}
        >
          {isAdmin ? 'Manage / Assign' : 'Logged'}
        </Link>
      </CardFooter>
    </Card>
  );
}
