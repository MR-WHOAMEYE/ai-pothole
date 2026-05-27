import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/src/stores/authStore';
import { useLocationStore } from '@/src/stores/locationStore';
import { useNearbyReports } from '@/src/hooks/useReports';
import { MapContainer } from '@/src/components/map/MapContainer';
import { MapMarker } from '@/src/components/map/Map';
import { SeverityMarker } from '@/src/components/map/SeverityMarker';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import {
  Camera,
  Upload,
  LogOut,
  MapPin,
  List,
  AlertTriangle,
  FolderOpen,
  LayoutDashboard,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

export default function HomePage() {
  const navigate = useNavigate();
  const { user, role, signOut, isAuthenticated } = useAuthStore();
  const { lat, lng, startWatching, stopWatching, error: gpsError } = useLocationStore();

  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start watching GPS when mounting home
  useEffect(() => {
    startWatching();
    return () => stopWatching();
  }, [startWatching, stopWatching]);

  // Query nearby reports within 1km of coordinates
  const { data: nearbyReports = [], isLoading } = useNearbyReports(lat, lng, 1500);

  const reportsList = Array.isArray(nearbyReports) ? nearbyReports : [];

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Navigate to Review/Submit screen with the selected file
    toast.info('Image selected. Navigating to confirmation...');
    navigate('/submit', {
      state: {
        imageFile: file,
        locationRequired: true, // Manual review of coordinates for files by default
      },
    });
  };

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden relative font-sans">
      {/* ── HEADER ── */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center">
            <AlertTriangle className="size-4 text-red-500 animate-pulse" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            Pothole<span className="text-red-500">IQ</span>
          </span>
          <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-2 py-0.5 rounded border border-zinc-800 bg-zinc-950/50 text-zinc-400">
            {role.toLowerCase()}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {role === 'ADMIN' && (
            <Link to="/admin">
              <Button size="sm" variant="outline" className="border-zinc-800 hover:bg-zinc-800 gap-1.5 text-xs text-zinc-300">
                <LayoutDashboard className="size-3.5" /> <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
          )}

          {role === 'CREW' && (
            <Link to="/crew">
              <Button size="sm" variant="outline" className="border-zinc-800 hover:bg-zinc-800 gap-1.5 text-xs text-zinc-300">
                <Wrench className="size-3.5 text-yellow-500" /> <span className="hidden sm:inline">Jobs Feed</span>
              </Button>
            </Link>
          )}

          <Link to="/reports">
            <Button size="sm" variant="outline" className="border-zinc-800 hover:bg-zinc-800 gap-1.5 text-xs text-zinc-300">
              <FolderOpen className="size-3.5" /> <span className="hidden sm:inline">My Reports</span>
            </Button>
          </Link>

          {isAuthenticated ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={signOut}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            >
              <LogOut className="size-4" />
            </Button>
          ) : (
            <Link to="/login">
              <Button size="sm" className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold">
                <span className="hidden sm:inline">Sign In</span>
                <span className="sm:hidden">Login</span>
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* ── WORKSPACE ── */}
      <div className="flex-grow flex relative min-h-0">
        {/* Sidebar for list view on large screens, toggled on mobile */}
        <div className={`w-80 border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex-col flex-shrink-0 z-10 transition-transform ${
          activeTab === 'list' ? 'flex absolute inset-0 w-full z-30' : 'hidden md:flex'
        }`}>
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
              <MapPin className="size-4 text-red-500" />
              Nearby Detections
            </h2>
            <span className="text-xs font-mono text-zinc-500">{reportsList.length} logged</span>
          </div>

          <ScrollArea className="flex-grow">
            <div className="p-4 space-y-3">
              {gpsError && (
                <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-lg text-xs text-red-400 leading-normal">
                  {gpsError}
                </div>
              )}

              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
                ))
              ) : reportsList.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  No potholes reported within 1.5km.
                </div>
              ) : (
                reportsList.map((report) => (
                  <div
                    key={report.id}
                    className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/80 hover:bg-zinc-900 transition-colors cursor-pointer group"
                    onClick={() => {
                      if (report.latitude && report.longitude) {
                        // Zoom or center map logic can be handled or simply notify
                        toast.info(`Inspecting report at: ${report.streetAddress}`);
                      }
                    }}
                  >
                    <div className="flex gap-2">
                      <img
                        src={report.imageUrl}
                        alt="pothole"
                        className="size-12 rounded object-cover bg-zinc-950"
                      />
                      <div className="min-w-0 flex-grow">
                        <div className="flex justify-between items-start gap-1">
                          <span className="text-xs font-medium text-zinc-200 truncate block">
                            {report.streetAddress || 'Unnamed Road'}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border capitalize ${
                            report.severity === 'CRITICAL'
                              ? 'border-red-500/50 text-red-400 bg-red-950/10'
                              : 'border-yellow-500/50 text-yellow-400 bg-yellow-950/10'
                          }`}>
                            {report.severity?.toLowerCase()}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 block mt-1">
                          Status: <strong className="text-zinc-400 capitalize">{report.status.toLowerCase()}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Mobile view toggle back to map */}
          <div className="p-4 border-t border-zinc-800 md:hidden bg-zinc-900">
            <Button onClick={() => setActiveTab('map')} className="w-full bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs">
              Back to Map View
            </Button>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-grow h-full w-full relative z-0">
          <MapContainer zoom={15}>
            {/* Real-time user location marker */}
            {lat && lng && (
              <MapMarker latitude={lat} longitude={lng}>
                <div className="relative flex items-center justify-center">
                  <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-zinc-100 opacity-20" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-zinc-100 border-2 border-zinc-950 shadow-md" />
                </div>
              </MapMarker>
            )}

            {reportsList.map((report) => (
              <SeverityMarker key={report.id} report={report} />
            ))}
          </MapContainer>

          {/* Location status pill overlay */}
          <div className="absolute top-4 left-4 bg-zinc-950/90 border border-zinc-800 rounded-full px-3 py-1.5 text-[11px] font-medium text-zinc-300 flex items-center gap-2 shadow-lg backdrop-blur-sm">
            <div className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span>GPS Active: {lat != null ? lat.toFixed(5) : '0.00000'}, {lng != null ? lng.toFixed(5) : '0.00000'}</span>
          </div>

          {/* Primary Quick Actions Overlays (Bottom of Map) */}
          {role !== 'ADMIN' && role !== 'CREW' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 w-[calc(100%-2rem)] max-w-sm">
              <Button
                onClick={() => navigate('/scan')}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold h-12 rounded-xl shadow-lg border border-red-500 flex items-center justify-center gap-2 animate-bounce-short"
              >
                <Camera className="size-5" />
                Scan Road
              </Button>

              <Button
                onClick={handleFileUploadClick}
                className="flex-grow-0 bg-zinc-900/90 hover:bg-zinc-855 text-zinc-200 font-semibold h-12 w-12 rounded-xl shadow-lg border border-zinc-800 flex items-center justify-center backdrop-blur-sm"
                title="Upload Photo"
              >
                <Upload className="size-5" />
              </Button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>
          )}

          {/* Mobile switcher button */}
          <Button
            onClick={() => setActiveTab(activeTab === 'map' ? 'list' : 'map')}
            className="absolute top-4 right-4 md:hidden bg-zinc-950/90 border border-zinc-800 size-9 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm text-zinc-300"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
