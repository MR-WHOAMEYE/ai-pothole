import React from 'react';
import { Card, CardContent } from '@/src/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    positive?: boolean; // if positive is true, it represents improvement (e.g. reduction or completion)
  };
}

export function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-400">{title}</span>
          {icon && <div className="text-zinc-500">{icon}</div>}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-zinc-100">{value}</span>
          {trend && (
            <span className={`text-xs font-semibold ${trend.positive ? 'text-green-500' : 'text-zinc-500'}`}>
              {trend.value}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-xs text-zinc-500">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
