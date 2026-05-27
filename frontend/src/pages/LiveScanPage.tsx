import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { useScannerStore } from '@/src/stores/scannerStore';
import { useLocationStore } from '@/src/stores/locationStore';
import { useScanner } from '@/src/hooks/useScanner';
import { CameraView } from '@/src/components/scanner/CameraView';
import { ScanOverlay } from '@/src/components/scanner/ScanOverlay';
import { SeverityFlash } from '@/src/components/scanner/SeverityFlash';
import { Button } from '@/src/components/ui/button';
import { ArrowLeft, Play, Square, Compass, ShieldAlert, Sparkles } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent } from '@/src/components/ui/card';

export default function LiveScanPage() {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);

  const {
    sessionId,
    isScanning,
    startScanning,
    stopScanning,
    lastDetection,
    initializeSession,
  } = useScannerStore();

  const { lat, lng, startWatching, stopWatching, error: gpsError } = useLocationStore();
  const [flashColor, setFlashColor] = useState<string | null>(null);

  // Start watching GPS when mounting scanner page
  useEffect(() => {
    startWatching();
    return () => stopWatching();
  }, [startWatching, stopWatching]);

  // Initialize and clean up scanning sessions
  useEffect(() => {
    initializeSession();
    startScanning();
    return () => {
      stopScanning();
    };
  }, [initializeSession, startScanning, stopScanning]);

  const handleTriggerFlash = (color: string) => {
    setFlashColor(color);
    // Reset flash color after animation completes
    setTimeout(() => setFlashColor(null), 600);
  };

  // Connect scanning capture loops
  useScanner(webcamRef, handleTriggerFlash);

  return (
    <div className="h-[100dvh] w-screen bg-black text-zinc-100 flex flex-col overflow-hidden relative font-sans">
      {/* ── CAMERA STREAM ── */}
      <CameraView webcamRef={webcamRef} />

      {/* ── SCANNER RETICLES & LASER ── */}
      {isScanning && <ScanOverlay />}

      {/* ── SEVERITY DETECTION COLOR FLASH ── */}
      <SeverityFlash color={flashColor} />

      {/* ── TOP NAV BAR HUD ── */}
      <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-30">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            stopScanning();
            navigate('/');
          }}
          className="text-zinc-300 hover:text-white hover:bg-zinc-900/60 backdrop-blur-md"
        >
          <ArrowLeft className="size-4 sm:mr-2" /> <span className="hidden sm:inline">Back</span>
        </Button>

        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
          <span className="hidden sm:inline-block text-xs font-mono uppercase tracking-widest font-bold text-zinc-300">
            Live AI Analyzer
          </span>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-full px-3 py-1 text-[10px] font-mono text-zinc-300 flex items-center gap-1.5 backdrop-blur-md">
          <Compass className="size-3.5 text-zinc-400" />
          <span>{lat != null ? lat.toFixed(5) : '0.00000'}, {lng != null ? lng.toFixed(5) : '0.00000'}</span>
        </div>
      </div>

      {/* ── BOTTOM HUD BAR ── */}
      <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col items-center gap-4 z-30">
        {gpsError && (
          <div className="max-w-md p-2 bg-red-950/40 border border-red-900/50 rounded-lg text-[10px] text-red-400 text-center leading-normal backdrop-blur-md">
            Warning: {gpsError}
          </div>
        )}

        {/* Real-time Detections Card Banner */}
        {lastDetection && (
          <Card className="w-full max-w-sm bg-zinc-900/90 border border-zinc-800 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200">
            <CardContent className="p-4 flex gap-3">
              <div className="size-10 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="size-5" style={{ color: lastDetection.severityColor || '#FFC107' }} />
              </div>
              <div className="min-w-0 flex-grow">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs font-bold text-zinc-100 truncate block">
                    Pothole Found!
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] font-bold px-1.5 py-0 border-zinc-700 bg-zinc-800/30 text-zinc-300 capitalize"
                  >
                    {lastDetection.severity.toLowerCase()}
                  </Badge>
                </div>
                <div className="flex gap-3 text-[10px] text-zinc-400 mt-1 font-mono">
                  <span>Depth: <strong className="text-zinc-200">{lastDetection.estimatedDepthCm != null ? lastDetection.estimatedDepthCm.toFixed(1) : 'N/A'}cm</strong></span>
                  <span>Conf: <strong className="text-zinc-200">{lastDetection.confidenceScore != null ? (lastDetection.confidenceScore * 100).toFixed(0) : 'N/A'}%</strong></span>
                  <span>Priority: <strong className="text-zinc-200">{lastDetection.priorityScore != null ? lastDetection.priorityScore.toFixed(0) : 'N/A'}</strong></span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Scanner Action Button */}
        <div className="flex justify-center w-full">
          {isScanning ? (
            <Button
              onClick={stopScanning}
              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold h-12 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg border border-zinc-200"
            >
              <Square className="size-4 fill-zinc-950 text-zinc-950" /> Stop Scanning
            </Button>
          ) : (
            <Button
              onClick={startScanning}
              className="bg-red-650 hover:bg-red-500 text-white font-bold h-12 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg border border-red-500 animate-pulse"
            >
              <Play className="size-4 fill-white text-white" /> Resume Scanning
            </Button>
          )}
        </div>

        <p className="text-[10px] text-zinc-500 text-center font-mono select-none">
          Session: {sessionId.substring(0, 16)}...
        </p>
      </div>
    </div>
  );
}
