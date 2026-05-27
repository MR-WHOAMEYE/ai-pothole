import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDashboardStats } from '@/src/hooks/useReports';
import { StatCard } from '@/src/components/admin/StatCard';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { ArrowLeft, Sparkles, AlertTriangle, Layers, Calendar, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

export default function AdminAnalyticsPage() {
  const navigate = useNavigate();
  const { data: stats } = useDashboardStats();

  const monthlyData = [
    { name: 'Jan', Detections: 45, Patches: 38 },
    { name: 'Feb', Detections: 62, Patches: 50 },
    { name: 'Mar', Detections: 84, Patches: 72 },
    { name: 'Apr', Detections: 70, Patches: 68 },
    { name: 'May', Detections: 98, Patches: 81 },
  ];

  const severityData = [
    { name: 'Critical', value: 12, color: '#F44336' },
    { name: 'Moderate', value: 24, color: '#FFC107' },
    { name: 'Minor', value: 44, color: '#4CAF50' },
  ];

  const wardData = [
    { name: 'Ward 1', Reports: 32 },
    { name: 'Ward 2', Reports: 18 },
    { name: 'Ward 3', Reports: 41 },
    { name: 'Ward 4', Reports: 23 },
    { name: 'Ward 5', Reports: 29 },
  ];

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 p-4 md:p-8 flex flex-col font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-6 flex-grow flex flex-col justify-center">
        {/* Navigation header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="text-zinc-400 hover:text-white hover:bg-zinc-900"
          >
            <ArrowLeft className="size-4 mr-2" /> Back to Console
          </Button>
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-1">
            <Sparkles className="size-3 text-red-500 animate-pulse" /> Municipal Analytics
          </span>
        </div>

        {/* Dashboard Title */}
        <div className="border-b border-zinc-900 pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <BarChart3 className="size-6 text-red-500" />
            Infrastructure Quality Dashboard
          </h1>
          <p className="text-xs text-zinc-400">
            Real-time analytics mapping response speeds, severity frequencies, and ward logistics.
          </p>
        </div>

        {/* KPI stat highlights */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Detections" value={stats?.total || 248} description="Aggregate reports logged" />
          <StatCard title="Pending Resolution" value={stats?.pending || 64} description="Crews awaiting dispatch" />
          <StatCard title="Resolved repairs" value={stats?.completed || 184} description="Successful road patches" />
          <StatCard title="Average SLA Response" value={`${(stats?.avgResponseTimeH ?? 0).toFixed(1)} hrs`} description="Turnaround speed rate" />
        </div>

        {/* Chart Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Monthly area chart */}
          <Card className="bg-zinc-900 border-zinc-800 lg:col-span-8">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">Incident and Repair Trends</CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Monthly progression comparing detected potholes versus successfully patched locations.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-64 pl-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F44336" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#F44336" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPatch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4CAF50" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                    labelStyle={{ color: '#a1a1aa', fontSize: '11px', fontWeight: 'bold' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="Detections" stroke="#F44336" fillOpacity={1} fill="url(#colorDet)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Patches" stroke="#4CAF50" fillOpacity={1} fill="url(#colorPatch)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Severity breakout pie chart */}
          <Card className="bg-zinc-900 border-zinc-800 lg:col-span-4">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">Severity Breakdown</CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Current ratio of potholes categorized by risk category.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-56 flex flex-col justify-center items-center relative">
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Legends */}
              <div className="flex gap-4 mt-2 text-[10px] font-mono text-zinc-400 justify-center">
                {severityData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1">
                    <div className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name} ({item.value})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ward comparisons bar chart */}
          <Card className="bg-zinc-900 border-zinc-800 lg:col-span-12">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">Detections by Municipal Ward</CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Comparison of logged incidents across different municipal ward sectors.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-64 pl-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wardData}>
                  <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                    labelStyle={{ color: '#a1a1aa', fontSize: '11px', fontWeight: 'bold' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                  <Bar dataKey="Reports" fill="#FFC107" radius={[4, 4, 0, 0]}>
                    {wardData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#FFC107" fillOpacity={0.8} className="hover:fill-opacity-100 transition-colors" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
