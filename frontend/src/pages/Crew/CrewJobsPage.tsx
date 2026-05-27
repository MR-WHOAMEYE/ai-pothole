import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/src/stores/authStore';
import { useCrewAssignments } from '@/src/hooks/useReports';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/src/components/ui/card';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { ArrowLeft, LogOut, Wrench, Sparkles, MapPin, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function CrewJobsPage() {
  const navigate = useNavigate();
  const { user, signOut, isAuthenticated } = useAuthStore();
  const crewEmail = user?.email;
  
  const { data: assignments = [], isLoading, refetch } = useCrewAssignments(crewEmail);
  const [filter, setFilter] = useState<'pending' | 'completed'>('pending');

  const jobsList = Array.isArray(assignments) ? assignments : [];

  const filteredJobs = jobsList.filter((job) => {
    if (filter === 'completed') return job.status === 'COMPLETED';
    return job.status !== 'COMPLETED' && job.status !== 'CANCELLED';
  });

  const handleRefresh = () => {
    refetch();
    toast.success('Crew jobs updated.');
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900 px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-yellow-950/20 border border-yellow-900/50 flex items-center justify-center">
            <Wrench className="size-4 text-yellow-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-zinc-100">
              Pothole<span className="text-red-500">IQ</span> Crew Dispatch
            </h1>
            <p className="text-[10px] text-zinc-500">Field Maintenance Panel</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/">
            <Button size="sm" variant="outline" className="border-zinc-800 hover:bg-zinc-800 gap-1.5 text-xs text-zinc-300">
              <ArrowLeft className="size-3.5" /> Citizen Portal
            </Button>
          </Link>
          {isAuthenticated && (
            <Button
              size="sm"
              variant="ghost"
              onClick={signOut}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            >
              <LogOut className="size-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-grow max-w-4xl mx-auto w-full p-4 md:p-6 space-y-6 flex flex-col">
        {/* Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-900 pb-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Assigned Work Orders</h2>
            <p className="text-xs text-zinc-400 font-mono">Email: {crewEmail || 'Loading...'}</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Tabs
              value={filter}
              onValueChange={(val) => setFilter(val as any)}
              className="flex-1 sm:flex-none"
            >
              <TabsList className="bg-zinc-900 border border-zinc-800 text-zinc-400 w-full">
                <TabsTrigger value="pending" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-xs flex-1">
                  Active
                </TabsTrigger>
                <TabsTrigger value="completed" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-xs flex-1">
                  Done
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              className="border-zinc-800 hover:bg-zinc-900 text-xs h-9 px-3"
            >
              Sync
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-28 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 bg-zinc-900/30 border border-zinc-900 rounded-2xl p-6">
              <div className="size-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                <Calendar className="size-5 text-zinc-650" />
              </div>
              <h3 className="font-semibold text-zinc-200 text-sm">No Assignments Found</h3>
              <p className="text-xs text-zinc-500 max-w-sm mt-1 leading-normal">
                You have no scheduled road patch assignments under this filter. Take a break!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJobs.map((job) => {
                const isLate = !!job.scheduledDate && new Date(job.scheduledDate) < new Date() && job.status !== 'COMPLETED';

                return (
                  <Card key={job.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-1">
                          <span className="text-[10px] text-zinc-500 font-mono block">Order ID: {job.id}</span>
                          <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
                            <MapPin className="size-4 text-red-500" />
                            {job.teamName || 'Assigned Site Location'}
                          </CardTitle>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize font-medium ${
                            job.status === 'COMPLETED'
                              ? 'border-green-500 text-green-500 bg-green-950/10'
                              : job.status === 'IN_PROGRESS'
                              ? 'border-amber-500 text-amber-500 bg-amber-950/10'
                              : 'border-yellow-500 text-yellow-500 bg-yellow-950/10'
                          }`}
                        >
                          {job.status.toLowerCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 pb-3 text-xs text-zinc-400 flex flex-wrap gap-x-6 gap-y-2">
                      {job.scheduledDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3.5 text-zinc-500" />
                          <span>Scheduled: <strong className={isLate ? 'text-red-400' : 'text-zinc-300'}>{new Date(job.scheduledDate).toLocaleDateString()}</strong></span>
                          {isLate && (
                            <span className="text-[9px] font-bold text-red-400 border border-red-500/30 bg-red-950/10 px-1 py-0 rounded font-mono uppercase">Overdue</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3.5 text-zinc-500" />
                          <span>Scheduled: <strong className="text-zinc-300">Pending</strong></span>
                        </div>
                      )}
                      {job.estimatedCost !== undefined && job.estimatedCost !== null && (
                        <div className="flex items-center gap-1">
                          <Sparkles className="size-3.5 text-zinc-500" />
                          <span>Est. Budget: <strong className="text-zinc-300">₹{job.estimatedCost.toLocaleString('en-IN')}</strong></span>
                        </div>
                      )}
                      {job.status === 'COMPLETED' && job.completedAt && (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="size-3.5 text-green-500" />
                          <span>Completed: <strong className="text-zinc-300">{new Date(job.completedAt).toLocaleString()}</strong></span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="p-4 pt-0 border-t border-zinc-800/40 bg-zinc-900/10 flex justify-end">
                      <Link to={`/crew/job/${job.id}`} className="mt-3">
                        <Button size="sm" className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-semibold">
                          Open Job Panel
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
