import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/src/stores/authStore';
import { useMyReports } from '@/src/hooks/useReports';
import { ReportCard } from '@/src/components/reports/ReportCard';
import { Button } from '@/src/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { ArrowLeft, Sparkles, LayoutGrid, Calendar, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { saveReportToCache, getCachedReports, evictOldReports } from '@/src/lib/idb';
import { DamageReport } from '@/src/lib/mockData';

export default function MyReportsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: myReports = [], isLoading } = useMyReports(user?.id);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineReports, setOfflineReports] = useState<DamageReport[]>([]);
  const objectUrlsRef = useRef<string[]>([]);

  // Listen to network status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cache reports and download images as Blobs when online
  useEffect(() => {
    if (!isOffline && myReports && myReports.length > 0) {
      const cacheData = async () => {
        try {
          await evictOldReports();
          for (const report of myReports) {
            try {
              let blob: Blob | undefined;
              if (report.imageUrl) {
                const res = await fetch(report.imageUrl);
                if (res.ok) {
                  blob = await res.blob();
                }
              }
              await saveReportToCache(report, blob);
            } catch (err) {
              console.warn(`Failed to cache image for report ${report.id}:`, err);
              await saveReportToCache(report);
            }
          }
          console.log('IndexedDB: Submitted reports successfully cached.');
        } catch (e) {
          console.error('IndexedDB caching error:', e);
        }
      };
      cacheData();
    }
  }, [myReports, isOffline]);

  // Load reports from IndexedDB and convert image Blobs to Object URLs when offline
  useEffect(() => {
    if (isOffline) {
      const loadCached = async () => {
        try {
          const cached = await getCachedReports();
          
          // Clean up old object URLs
          objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
          objectUrlsRef.current = [];

          const mapped = cached.map((item) => {
            let imageUrl = item.report.imageUrl;
            if (item.imageBlob) {
              imageUrl = URL.createObjectURL(item.imageBlob);
              objectUrlsRef.current.push(imageUrl);
            }
            return {
              ...item.report,
              imageUrl,
            };
          });
          setOfflineReports(mapped);
          console.log(`IndexedDB: Loaded ${mapped.length} reports for offline view.`);
        } catch (e) {
          console.error('Failed to load reports from IndexedDB:', e);
        }
      };
      loadCached();
    }
  }, [isOffline]);

  // Revoke Object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const reportsList = isOffline ? offlineReports : (Array.isArray(myReports) ? myReports : []);

  const filteredReports = reportsList.filter((report) => {
    if (filter === 'completed') return report.status === 'COMPLETED';
    if (filter === 'pending') return report.status !== 'COMPLETED' && report.status !== 'REJECTED';
    return true;
  });

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md px-4 flex items-center justify-between z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-sm font-semibold tracking-tight text-zinc-200">
            My Submitted Reports
          </h1>
        </div>
        <div className="hidden sm:flex text-[10px] text-zinc-500 font-mono items-center gap-1.5">
          <Sparkles className="size-3 text-red-500 animate-pulse" />
          Logged submissions
        </div>
      </header>

      <main className="flex-grow max-w-5xl mx-auto w-full p-4 md:p-6 space-y-6 flex flex-col">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-900 pb-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Detections Registry</h2>
            <p className="text-xs text-zinc-400">Track statuses and official PDF filing progress of your submissions.</p>
          </div>

          <Tabs
            value={filter}
            onValueChange={(val) => setFilter(val as any)}
            className="w-full sm:w-auto"
          >
            <TabsList className="bg-zinc-900 border border-zinc-800 text-zinc-400">
              <TabsTrigger value="all" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-xs">
                All ({reportsList.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-xs">
                Pending
              </TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-xs">
                Completed
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Reports Grid */}
        <div className="flex-grow">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="aspect-video bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 bg-zinc-900/30 border border-zinc-900 rounded-2xl p-6">
              <div className="size-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                <LayoutGrid className="size-5 text-zinc-600" />
              </div>
              <h3 className="font-semibold text-zinc-200 text-sm">No Reports Found</h3>
              <p className="text-xs text-zinc-500 max-w-sm mt-1 leading-normal">
                You haven't submitted any pothole reports matching this criteria yet. Run a live scan on the roads to report issues!
              </p>
              <Button
                onClick={() => navigate('/scan')}
                className="mt-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-xs"
              >
                Scan Road
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {filteredReports.map((report) => (
                <ReportCard key={report.id} report={report} isAdmin={false} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
