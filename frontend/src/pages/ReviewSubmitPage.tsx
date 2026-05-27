import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocationStore } from '@/src/stores/locationStore';
import { useUploadReportMutation, useSubmitLocationMutation } from '@/src/hooks/useReports';
import { BboxCanvas } from '@/src/components/scanner/BboxCanvas';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/src/components/ui/card';
import { MapContainer } from '@/src/components/map/MapContainer';
import { MapMarker } from '@/src/components/map/Map';
import { ArrowLeft, Compass, Check, ShieldAlert, Sparkles, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/src/lib/api';


export default function ReviewSubmitPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const startWatching = useLocationStore((s) => s.startWatching);
  const stopWatching = useLocationStore((s) => s.stopWatching);
  const userLat = useLocationStore((s) => s.lat);
  const userLng = useLocationStore((s) => s.lng);

  const state = location.state || {};
  const imageFile = state.imageFile as File;
  const reportId = state.reportId as string | undefined;
  const detectionData = state.detectionData || null;

  const [imageSrc, setImageSrc] = useState<string>('');
  const imageRef = useRef<HTMLImageElement>(null);

  // AI Verification state
  const [localDetections, setLocalDetections] = useState<any[] | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Default coordinate states
  const [lat, setLat] = useState<number>(detectionData?.latitude || userLat);
  const [lng, setLng] = useState<number>(detectionData?.longitude || userLng);
  const [hasManuallyPinned, setHasManuallyPinned] = useState(false);
  
  const uploadMutation = useUploadReportMutation();
  const confirmLocationMutation = useSubmitLocationMutation();

  // Start watching location on mount
  useEffect(() => {
    startWatching();
    return () => stopWatching();
  }, [startWatching, stopWatching]);

  // Dynamically update coordinates as high-accuracy GPS resolves (if not manual or pre-filled by AI detection data)
  useEffect(() => {
    if (!localDetections && !hasManuallyPinned && userLat !== 12.9716) {
      setLat(userLat);
      setLng(userLng);
    }
  }, [userLat, userLng, localDetections, hasManuallyPinned]);

  // Perform pre-submit AI verification if mounted without detection data
  useEffect(() => {
    if (detectionData) {
      setLocalDetections(detectionData.detections || [detectionData]);
      return;
    }

    if (imageFile) {
      const controller = new AbortController();

      const verifyImage = async () => {
        setIsVerifying(true);
        setVerificationError(null);
        try {
          const formData = new FormData();
          formData.append('image', imageFile);

          const response = await api.post('/api/scanner/check', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            signal: controller.signal,
          });

          const data = response.data;
          if (data.potholeFound && data.detections && data.detections.length > 0) {
            setLocalDetections(data.detections);
            toast.success('Potholes successfully verified by AI scanner!');
          } else {
            setLocalDetections(null);
            setVerificationError(data.message || 'No road damage or pothole detected in this image. Reports can only be submitted for verified potholes.');
            toast.error('AI verification failed: No pothole detected.');
          }
        } catch (err: any) {
          if (err?.code === 'ERR_CANCELED' || err?.name === 'AbortError' || err?.name === 'CanceledError') return;
          console.error('AI verification error:', err);
          setVerificationError('Unable to connect to the AI model. Please verify your backend server is running.');
          toast.error('AI verification request failed.');
        } finally {
          setIsVerifying(false);
        }
      };

      verifyImage();
      return () => controller.abort();
    }
  }, [imageFile, detectionData]);

  // Create image object URL for previews
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageSrc(url);
      return () => {
        if (url) URL.revokeObjectURL(url);
      };
    } else {
      // If accessed directly without file, redirect back
      toast.error('No upload file session active.');
      navigate('/');
    }
  }, [imageFile, navigate]);

  const handleMapClick = (e: any) => {
    if (e.lngLat) {
      setLat(e.lngLat.lat);
      setLng(e.lngLat.lng);
      setHasManuallyPinned(true);
      toast.info(`Coordinates updated: ${e.lngLat.lat != null ? e.lngLat.lat.toFixed(5) : 'N/A'}, ${e.lngLat.lng != null ? e.lngLat.lng.toFixed(5) : 'N/A'}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) return;

    if (reportId) {
      // Flow 1: Scanner already posted frame. Just confirm/update GPS location.
      const promise = confirmLocationMutation.mutateAsync({
        reportId,
        latitude: lat,
        longitude: lng,
      });
      toast.promise(promise, {
        loading: 'Confirming report location...',
        success: 'Location details confirmed successfully!',
        error: 'Failed to confirm report location.',
      });
      navigate('/');
    } else {
      // Flow 2: Citizen manual upload. Submit file + coordinates together.
      const promise = uploadMutation.mutateAsync({
        imageFile,
        lat,
        lng,
        description: 'Citizen submitted report via photo gallery.',
      });
      toast.promise(promise, {
        loading: 'Uploading road damage report...',
        success: 'Report submitted successfully!',
        error: 'Failed to upload report.',
      });
      navigate('/');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 p-4 md:p-8 flex flex-col font-sans">
      <div className="max-w-5xl mx-auto w-full space-y-6 flex-grow flex flex-col justify-center">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-zinc-400 hover:text-white hover:bg-zinc-900"
          >
            <ArrowLeft className="size-4 sm:mr-2" /> <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
            <Sparkles className="size-3 text-red-500 animate-pulse" />
            <span className="hidden sm:inline">Verification Screen</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left panel: Image Canvas with Bbox Overlays */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <Card className="bg-zinc-900 border-zinc-800 overflow-hidden flex flex-col justify-center relative flex-grow min-h-[300px]">
              <CardHeader className="p-4 border-b border-zinc-800/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-zinc-200">
                  <ShieldAlert className="size-4 text-zinc-400" />
                  Captured Image Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex items-center justify-center bg-black/60 relative overflow-hidden flex-grow">
                {isVerifying && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10 animate-in fade-in duration-200">
                    <div className="size-8 rounded-full border-4 border-zinc-700 border-t-red-500 animate-spin" />
                    <div className="text-xs font-mono text-zinc-400 animate-pulse">Running AI Check...</div>
                  </div>
                )}
                {imageSrc && (
                  <div className="relative inline-block mt-4 mx-auto border border-zinc-800 rounded-md overflow-hidden shadow-sm">
                    <img
                      ref={imageRef}
                      src={imageSrc}
                      alt="Pothole Preview"
                      className="max-w-full max-h-[400px] object-contain block mx-auto"
                      onLoad={() => {
                        if (imageSrc && imageSrc.startsWith('blob:')) {
                          URL.revokeObjectURL(imageSrc);
                        }
                      }}
                    />

                    {/* Pre-scan Flow: Map over detectionData.detections if they exist, otherwise the single bbox */}
                    {detectionData && !isVerifying && (
                      <>
                        {detectionData.detections && detectionData.detections.length > 0 ? (
                          detectionData.detections.map((det: any, i: number) => (
                            <BboxCanvas
                              key={`prescan-det-${i}`}
                              bboxX={det.bboxX}
                              bboxY={det.bboxY}
                              bboxWidth={det.bboxWidth}
                              bboxHeight={det.bboxHeight}
                              color={det.severityColor || '#ecc94b'}
                              label={`${det.severity} - ${det.confidenceScore != null ? (det.confidenceScore * 100).toFixed(0) : '0'}%`}
                              imageRef={imageRef}
                            />
                          ))
                        ) : (
                          detectionData.bboxX !== undefined && (
                            <BboxCanvas
                              bboxX={detectionData.bboxX}
                              bboxY={detectionData.bboxY}
                              bboxWidth={detectionData.bboxWidth}
                              bboxHeight={detectionData.bboxHeight}
                              color={detectionData.severityColor || '#ecc94b'}
                              label={`${detectionData.severity} - ${detectionData.confidenceScore != null ? (detectionData.confidenceScore * 100).toFixed(0) : '0'}%`}
                              imageRef={imageRef}
                            />
                          )
                        )}
                      </>
                    )}

                    {/* Manual Upload Flow: localDetections */}
                    {!detectionData && localDetections && localDetections.map((det, i) => (
                      <BboxCanvas
                        key={`local-det-${i}`}
                        bboxX={det.bboxX}
                        bboxY={det.bboxY}
                        bboxWidth={det.bboxWidth}
                        bboxHeight={det.bboxHeight}
                        color={det.severityColor || '#ecc94b'}
                        label={`${det.severity} - ${det.confidenceScore != null ? (det.confidenceScore * 100).toFixed(0) : '0'}%`}
                        imageRef={imageRef}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right panel: Geocoding Location and Form Details */}
          <div className="lg:col-span-5 flex flex-col">
            <Card className="bg-zinc-900 border-zinc-800 flex flex-col h-full">
              <CardHeader className="p-5">
                <CardTitle className="text-base text-zinc-100">Verify Location & Details</CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Verify or manually pin the pothole location using the map locator.
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleSubmit} className="flex-grow flex flex-col">
                <CardContent className="space-y-4 p-5 pt-0">
                  {/* Coordinates Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="latitude" className="text-xs text-zinc-400">Latitude</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        value={lat}
                        onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                        className="bg-zinc-950 border-zinc-800 text-zinc-200 h-9 font-mono text-xs focus-visible:ring-zinc-700"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="longitude" className="text-xs text-zinc-400">Longitude</Label>
                      <Input
                        id="longitude"
                        type="number"
                        step="any"
                        value={lng}
                        onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                        className="bg-zinc-950 border-zinc-800 text-zinc-200 h-9 font-mono text-xs focus-visible:ring-zinc-700"
                        required
                      />
                    </div>
                  </div>

                  {/* Geolocation Marker Map */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">Map Locator (Tap to Pin Pothole)</Label>
                    <div className="h-44 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 relative">
                      <MapContainer
                        center={[lng, lat]}
                        zoom={15}
                        onClick={handleMapClick}
                      >
                        <MapMarker latitude={lat} longitude={lng}>
                          <div className="size-4 bg-red-500 rounded-full border-2 border-zinc-950 shadow-lg animate-pulse" />
                        </MapMarker>
                      </MapContainer>
                    </div>
                    <p className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                      <MapPin className="size-3 text-zinc-500" />
                      Tap the map directly to update the report pin coordinates.
                    </p>
                  </div>

                  {/* AI Metadata Overview */}
                  {localDetections && localDetections.length > 0 && (
                    <div className="p-3.5 bg-zinc-950 border border-zinc-805 rounded-xl space-y-2 text-xs">
                      <div className="font-semibold text-zinc-300 text-xs border-b border-zinc-900 pb-1.5 flex items-center gap-1.5">
                        <Compass className="size-4 text-zinc-500" /> AI Detection Summary
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 font-mono">
                        <div>Severity: <strong className="text-zinc-200 uppercase">{localDetections[0].severity}</strong></div>
                        <div>Estimated Depth: <strong className="text-zinc-200">{localDetections[0].estimatedDepthCm != null ? localDetections[0].estimatedDepthCm.toFixed(1) : 'N/A'} cm</strong></div>
                        <div>Confidence: <strong className="text-zinc-200">{localDetections[0].confidenceScore != null ? (localDetections[0].confidenceScore * 100).toFixed(0) : 'N/A'}%</strong></div>
                        <div>Priority Score: <strong className="text-zinc-200">{localDetections[0].priorityScore != null ? localDetections[0].priorityScore.toFixed(0) : 'N/A'}</strong></div>
                      </div>
                    </div>
                  )}

                  {verificationError && (
                    <div className="p-3.5 bg-red-950/20 border border-red-900/40 rounded-xl space-y-1.5 text-xs text-red-400 leading-normal">
                      <div className="font-semibold text-red-300 flex items-center gap-1.5">
                        <ShieldAlert className="size-4 text-red-400" /> AI Verification Warning
                      </div>
                      <p className="text-[11px] text-red-300/90 font-mono">{verificationError}</p>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="p-5 border-t border-zinc-800/40 bg-zinc-900/20 mt-auto">
                  <Button
                    type="submit"
                    disabled={
                      uploadMutation.isPending || 
                      confirmLocationMutation.isPending || 
                      isVerifying || 
                      (!localDetections || localDetections.length === 0)
                    }
                    className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold h-11 flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      'Running AI Check...'
                    ) : uploadMutation.isPending || confirmLocationMutation.isPending ? (
                      'Uploading Report...'
                    ) : (
                      <>
                        <Check className="size-4" /> Submit & File Report
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
