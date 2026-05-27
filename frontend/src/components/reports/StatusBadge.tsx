import React from 'react';
import { Badge } from '@/src/components/ui/badge';

export type ReportStatus = 'CREATED' | 'REPORTED' | 'VERIFIED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

interface StatusBadgeProps {
  status: ReportStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = {
    CREATED: { label: 'Created', color: 'border-zinc-700 text-zinc-400 bg-zinc-800/20' },
    REPORTED: { label: 'Reported', color: 'border-zinc-600 text-zinc-400 bg-zinc-800/10' },
    VERIFIED: { label: 'Verified', color: 'border-orange-500 text-orange-500 bg-orange-950/10' },
    ASSIGNED: { label: 'Assigned', color: 'border-yellow-500 text-yellow-500 bg-yellow-950/10' },
    IN_PROGRESS: { label: 'In Progress', color: 'border-amber-500 text-amber-500 bg-amber-950/10' },
    COMPLETED: { label: 'Completed', color: 'border-green-500 text-green-500 bg-green-950/10' },
    REJECTED: { label: 'Rejected', color: 'border-red-500 text-red-500 bg-red-950/10' },
  }[status] || { label: status, color: 'border-zinc-800 text-zinc-500' };

  return (
    <Badge
      variant="outline"
      className={`${config.color} ${className || ''} capitalize font-medium text-xs`}
    >
      {config.label}
    </Badge>
  );
}
