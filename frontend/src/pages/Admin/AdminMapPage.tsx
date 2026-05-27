import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  useAdminReportsList,
  useDashboardStats,
  useAdminMapData,
} from '@/src/hooks/useReports';
import { StatCard } from '@/src/components/admin/StatCard';
import { LiveFeedItem } from '@/src/components/admin/LiveFeedItem';
import { AssignWorkerSheet } from '@/src/components/admin/AssignWorkerSheet';
import { MapContainer } from '@/src/components/map/MapContainer';
import { SeverityMarker } from '@/src/components/map/SeverityMarker';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { Card, CardContent } from '@/src/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import {
  AlertTriangle,
  BarChart3,
  Home,
  RefreshCw,
  Search,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLiveFeedStore } from '@/src/stores/liveFeedStore';
import { useWebSocket } from '@/src/hooks/useWebSocket';

export default function AdminMapPage() {

  // Search & Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected report state for assigning
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);

  // Live feed Zustand store
  const reports = useLiveFeedStore((s) => s.reports);
  const setReports = useLiveFeedStore((s) => s.setReports);
  const addReport = useLiveFeedStore((s) => s.addReport);

  // Queries (fetch initial 100 reports of all statuses to populate feed)
  const { data: stats } = useDashboardStats();
  const { data: reportsList, isLoading: listLoading, refetch: refetchList } = useAdminReportsList(
    undefined,
    0,
    100
  );

  // Map Data
  useAdminMapData(
    severityFilter === 'all' ? undefined : severityFilter,
    statusFilter === 'all' ? undefined : statusFilter
  );

  // Connect WebSocket live feed
  useWebSocket(addReport);

  // Populate Zustand store with queried reports on load or query update
  useEffect(() => {
    if (reportsList?.content) {
      setReports(reportsList.content);
    }
  }, [reportsList, setReports]);

  const handleAssignClick = (report: any) => {
    setSelectedReport(report);
    setIsAssignOpen(true);
  };

  const handleRefresh = () => {
    refetchList();
    toast.success('Admin feed updated.');
  };

  // Safe stats check
  const total = stats?.total ?? 0;
  const pending = stats?.pending ?? 0;
  const completed = stats?.completed ?? 0;
  const critical = stats?.critical ?? 0;
  const avgResponseTimeH = stats?.avgResponseTimeH ?? 0;

  // Filter content locally from Zustand live feed
  const filteredReports = reports.filter((report: any) => {
    const matchesSearch = report.streetAddress
      ? report.streetAddress.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesStatus = statusFilter === 'all' ? true : report.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' ? true : report.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* ── HEADER ── */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900 px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-red-950/20 border border-red-900/50 flex items-center justify-center">
            <AlertTriangle className="size-4 text-red-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-zinc-100">
              Pothole<span className="text-red-500">IQ</span> Municipal Console
            </h1>
            <p className="text-[10px] text-zinc-500">Operations Command Center</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/">
            <Button size="sm" variant="outline" className="border-zinc-800 hover:bg-zinc-800 gap-1.5 text-xs text-zinc-300">
              <Home className="size-3.5" /> Citizen Map
            </Button>
          </Link>
          <Link to="/admin/analytics">
            <Button size="sm" variant="outline" className="border-zinc-800 hover:bg-zinc-800 gap-1.5 text-xs text-zinc-300">
              <BarChart3 className="size-3.5" /> Analytics Dashboard
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 size-9 p-0 rounded-lg border border-zinc-800"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </header>

      {/* ── TOP KPI STAT BAR ── */}
      <section className="grid grid-cols-2 md:grid-cols-5 border-b border-zinc-800 bg-zinc-900/40 p-4 gap-4 flex-shrink-0 z-10">
        <StatCard title="Total Detections" value={total} description="Accumulated logs" />
        <StatCard title="Pending Repairs" value={pending} description="Awaiting crew dispatch" trend={{ value: 'Active', positive: false }} />
        <StatCard title="Resolved cases" value={completed} description="Completed patches" trend={{ value: 'Patched', positive: true }} />
        <StatCard title="Critical Potholes" value={critical} description="Requires urgent attention" />
        <StatCard title="Avg Patch Speed" value={`${(avgResponseTimeH ?? 0).toFixed(1)}h`} description="SLA response rate" />
      </section>

      {/* ── MAIN WORKSPACE split ── */}
      <div className="flex-grow flex min-h-0 relative z-0">
        {/* Left Side Pane: Incident Logs List */}
        <aside className="w-80 border-r border-zinc-800 bg-zinc-900/20 backdrop-blur-md flex flex-col flex-shrink-0 min-h-0 z-10">
          <div className="p-4 border-b border-zinc-800 space-y-3">
            {/* Search Address Bar */}
            <div className="relative">
              <Input
                placeholder="Search street..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-xs pl-8 h-9 focus-visible:ring-zinc-700"
              />
              <Search className="absolute left-2.5 top-3 size-3.5 text-zinc-500" />
            </div>

            {/* Filter Detections */}
            <div className="grid grid-cols-2 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs h-8">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="REPORTED">Reported</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs h-8">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="MODERATE">Moderate</SelectItem>
                  <SelectItem value="MINOR">Minor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Incident scrolling feed */}
          <ScrollArea className="flex-grow">
            <div className="p-4 space-y-2.5">
              {listLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
                ))
              ) : filteredReports.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs font-mono">
                  No matches found.
                </div>
              ) : (
                filteredReports.map((report: any) => (
                  <div key={report.id} className="relative group">
                    <LiveFeedItem
                      report={report}
                      isActive={selectedReport?.id === report.id}
                      onClick={() => setSelectedReport(report)}
                    />
                    
                    {/* Floating quick assign worker triggers */}
                    {report.status === 'REPORTED' && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssignClick(report);
                        }}
                        className="absolute right-2 bottom-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-[9px] h-5 py-0 px-2 rounded font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <UserCheck className="size-2.5 mr-1" /> Assign
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Right Side Pane: Interactive Map */}
        <main className="flex-grow h-full relative z-0">
          <MapContainer
            center={selectedReport?.latitude && selectedReport?.longitude ? [selectedReport.longitude, selectedReport.latitude] : undefined}
            zoom={14}
          >
            {filteredReports.map((report: any) => (
              <SeverityMarker
                key={report.id}
                report={report}
                onClickPopup={() => setSelectedReport(report)}
              />
            ))}
          </MapContainer>

          {/* Active stats details widget floating overlay */}
          {selectedReport && (
            <Card className="absolute top-4 right-4 w-72 bg-zinc-950/95 border border-zinc-800 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex gap-2">
                  <img
                    src={selectedReport.imageUrl}
                    alt="Pothole"
                    className="size-16 rounded object-cover bg-zinc-900"
                  />
                  <div className="min-w-0 flex-grow">
                    <div className="flex justify-between">
                      <span className="font-bold text-zinc-200 truncate block">
                        {selectedReport.streetAddress || 'Unnamed Road'}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 block font-mono">
                      ID: {selectedReport.id.substring(0, 8)}...
                    </span>
                    <span className={`text-[10px] font-bold block mt-1 ${
                      selectedReport.severity === 'CRITICAL' ? 'text-red-500' : 'text-yellow-500'
                    }`}>
                      Severity: {selectedReport.severity}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-900 pt-2.5 gap-2">
                  <Link to={`/admin/report/${selectedReport.id}`} className="flex-1">
                    <Button variant="outline" className="w-full border-zinc-800 hover:bg-zinc-900 text-[10px] h-7 py-0">
                      Configure Details
                    </Button>
                  </Link>

                  {selectedReport.status === 'REPORTED' && (
                    <Button
                      onClick={() => handleAssignClick(selectedReport)}
                      className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-[10px] h-7 py-0 font-medium"
                    >
                      <UserCheck className="size-3 mr-1" /> Assign Crew
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* ── ASSIGN WORKER DIALOG/SHEET ── */}
      <AssignWorkerSheet
        report={selectedReport}
        isOpen={isAssignOpen}
        onOpenChange={setIsAssignOpen}
      />
    </div>
  );
}
