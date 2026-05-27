import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useCrewJobDetail,
  useReportDetail,
  useStartJobMutation,
  useAddJobNotesMutation,
  useCompleteJobMutation,
} from '@/src/hooks/useReports';
import { MapContainer } from '@/src/components/map/MapContainer';
import { MapMarker } from '@/src/components/map/Map';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Badge } from '@/src/components/ui/badge';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  Wrench,
  CalendarIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Calendar } from '@/src/components/ui/calendar';
import { format } from 'date-fns';

export default function CrewJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: job, isLoading: jobLoading } = useCrewJobDetail(id || '');
  // Query report details to get the original pothole image and coordinates
  const { data: report, isLoading: reportLoading } = useReportDetail(job?.reportId || '');

  const [notes, setNotes] = useState<string>('');
  const [afterImageFile, setAfterImageFile] = useState<File | null>(null);
  const [afterImagePreview, setAfterImagePreview] = useState<string>('');
  const [completedDate, setCompletedDate] = useState<Date | undefined>(undefined);
  const [showCompleteCalendar, setShowCompleteCalendar] = useState(false);

  const startMutation = useStartJobMutation();
  const notesMutation = useAddJobNotesMutation();
  const completeMutation = useCompleteJobMutation();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (jobLoading || reportLoading) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center text-zinc-400 font-mono text-xs">
        Loading job parameters...
      </div>
    );
  }

  if (!job || !report) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center p-4">
        <h2 className="text-zinc-200 text-sm font-semibold">Job Assignment Not Found</h2>
        <Button onClick={() => navigate('/crew')} className="mt-4 bg-zinc-100 text-zinc-950 text-xs">
          Return to Assignments
        </Button>
      </div>
    );
  }

  const handleStart = () => {
    startMutation.mutate(job.id);
  };

  const handleSaveNotes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;
    notesMutation.mutate(
      { workOrderId: job.id, notes },
      {
        onSuccess: () => {
          setNotes('');
        },
      }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAfterImageFile(file);
      const url = URL.createObjectURL(file);
      setAfterImagePreview(url);
    }
  };

  const handleComplete = () => {
    completeMutation.mutate(
      {
        workOrderId: job.id,
        afterImage: afterImageFile || undefined,
        completedAt: completedDate ? format(completedDate, 'yyyy-MM-dd') : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Assignment reported completed!');
          navigate('/crew');
        },
      }
    );
  };

  const isCompleted = job.status === 'COMPLETED';
  const isInProgress = job.status === 'IN_PROGRESS';
  const isPending = job.status === 'PENDING' || job.status === 'SCHEDULED';

  const severityColor = {
    CRITICAL: '#F44336',
    MODERATE: '#FFC107',
    MINOR: '#4CAF50',
  }[report.severity || 'MINOR'];

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 p-4 md:p-8 flex flex-col font-sans">
      <div className="max-w-5xl mx-auto w-full space-y-6 flex-grow flex flex-col justify-center">
        {/* Navigation header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/crew')}
            className="text-zinc-400 hover:text-white hover:bg-zinc-900"
          >
            <ArrowLeft className="size-4 mr-2" /> Assignments Feed
          </Button>
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-1">
            <Sparkles className="size-3 text-yellow-500 animate-pulse" /> Job Console
          </span>
        </div>

        {/* Title */}
        <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <Wrench className="size-5 text-yellow-500" />
              Work Order Log
            </h1>
            <p className="text-xs text-zinc-500 font-mono">Order ID: {job.id}</p>
          </div>
          <Badge
            variant="outline"
            className={`text-xs px-2.5 py-0.5 capitalize font-medium ${
              isCompleted
                ? 'border-green-500 text-green-500 bg-green-950/10'
                : isInProgress
                ? 'border-amber-500 text-amber-500 bg-amber-950/10'
                : 'border-yellow-500 text-yellow-500 bg-yellow-950/10'
            }`}
          >
            {job.status.toLowerCase()}
          </Badge>
        </div>

        {/* Side-by-side details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Photos Comparison */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <Card className="bg-zinc-900 border-zinc-800 flex flex-col flex-grow">
              <CardHeader className="p-4 border-b border-zinc-800/50">
                <CardTitle className="text-sm font-semibold text-zinc-200">Before & After Comparisons</CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 flex-grow items-center">
                {/* Before Photo */}
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase">Original reported damage</span>
                  <div className="aspect-square bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden relative">
                    <img
                      src={report.imageUrl}
                      alt="Before patch"
                      className="w-full h-full object-cover"
                    />
                    <Badge className="absolute top-2 left-2 bg-red-950/80 border border-red-500/30 text-red-400 uppercase text-[9px]">
                      Before
                    </Badge>
                  </div>
                </div>

                {/* After Photo Upload/Result */}
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase">Resolution verification</span>
                  <div className="aspect-square bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden relative flex flex-col items-center justify-center text-center">
                    {isCompleted ? (
                      <>
                        <img
                          src={job.afterImageUrl || 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=400'}
                          alt="After patch"
                          className="w-full h-full object-cover"
                        />
                        <Badge className="absolute top-2 left-2 bg-green-950/80 border border-green-500/30 text-green-400 uppercase text-[9px]">
                          After
                        </Badge>
                      </>
                    ) : afterImagePreview ? (
                      <>
                        <img
                          src={afterImagePreview}
                          alt="After patch preview"
                          className="w-full h-full object-cover"
                        />
                        <Badge className="absolute top-2 left-2 bg-yellow-950/80 border border-yellow-500/30 text-yellow-400 uppercase text-[9px]">
                          Preview
                        </Badge>
                      </>
                    ) : (
                      <div className="p-4 space-y-2">
                        <Camera className="size-8 text-zinc-700 mx-auto" />
                        <span className="text-[11px] text-zinc-500 block">No verification image selected.</span>
                        {isInProgress && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="border-zinc-800 hover:bg-zinc-800 text-[10px] text-zinc-400 mt-2"
                          >
                            Add Photo
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Information, map, log comments, check in operations */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <Card className="bg-zinc-900 border-zinc-800 flex flex-col h-full">
              <CardHeader className="p-5">
                <CardTitle className="text-base text-zinc-100">Site parameters & log</CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Target repair details and field crew checklist inputs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-grow p-5 pt-0">
                {/* Details list */}
                <div className="p-3.5 bg-zinc-950 border border-zinc-805 rounded-xl text-xs space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Site address:</span>
                    <strong className="text-zinc-200">{report.streetAddress || 'Unnamed Road'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Depth severity:</span>
                    <span className="font-bold uppercase" style={{ color: severityColor }}>{report.severity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Est. Budget:</span>
                    <span className="text-zinc-300">₹{job.estimatedCost?.toLocaleString('en-IN') || '0'}</span>
                  </div>
                  {report.latitude && report.longitude && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">GPS location:</span>
                      <span className="text-zinc-300">{report.latitude != null ? report.latitude.toFixed(5) : 'N/A'}, {report.longitude != null ? report.longitude.toFixed(5) : 'N/A'}</span>
                    </div>
                  )}
                  {job.scheduledDate && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Schedule Date:</span>
                      <span className="text-zinc-300">
                        {new Date(job.scheduledDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {job.completedAt && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Completed Date:</span>
                      <span className="text-zinc-300">
                        {new Date(job.completedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Map pin */}
                {report.latitude && report.longitude && (
                  <div className="h-28 rounded-lg overflow-hidden border border-zinc-850 bg-zinc-950 relative">
                    <MapContainer center={[report.longitude, report.latitude]} zoom={15}>
                      <MapMarker latitude={report.latitude} longitude={report.longitude}>
                        <div className="size-3 rounded-full border border-zinc-950 shadow-lg animate-pulse bg-yellow-500" />
                      </MapMarker>
                    </MapContainer>
                  </div>
                )}

                {/* Log progress notes */}
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-400 flex items-center gap-1">
                    <MessageSquare className="size-3.5 text-zinc-500" />
                    Field Crew Notes
                  </Label>
                  <div className="p-3 bg-zinc-950 border border-zinc-805 rounded-lg text-xs min-h-[50px] leading-relaxed">
                    {job.crewNotes || (
                      <span className="text-zinc-650 italic">No notes logged yet. Use the input below to log progress.</span>
                    )}
                  </div>

                  {isInProgress && (
                    <form onSubmit={handleSaveNotes} className="flex gap-2 mt-2">
                      <Input
                        placeholder="Add a progress update note..."
                        value={notes}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                        className="bg-zinc-950 border-zinc-805 text-xs h-9 focus-visible:ring-zinc-700 flex-grow"
                      />
                      <Button
                        type="submit"
                        disabled={notesMutation.isPending || !notes.trim()}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs px-3 h-9 font-medium"
                      >
                        Log Notes
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>

              {/* Main operational actions (Start / Complete) */}
              <CardFooter className="p-5 border-t border-zinc-800/40 bg-zinc-900/20 mt-auto">
                {isPending && (
                  <Button
                    onClick={handleStart}
                    disabled={startMutation.isPending}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold h-11 flex items-center justify-center gap-1.5 border border-yellow-400 shadow-md"
                  >
                    <Clock className="size-4" /> Start Assignment
                  </Button>
                )}

                {isInProgress && (
                  <div className="w-full space-y-3">
                    <div className="space-y-1.5 text-left relative">
                      <Label className="text-zinc-400 text-[10px] uppercase font-mono tracking-wider">Completion Date (Optional)</Label>
                      <div className="relative">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCompleteCalendar(!showCompleteCalendar)}
                          className="w-full bg-zinc-950 border-zinc-800 text-left justify-start text-xs font-normal text-zinc-300 flex items-center gap-2 h-9 px-3 hover:bg-zinc-900 hover:text-zinc-100"
                        >
                          <CalendarIcon className="size-4 text-zinc-500" />
                          {completedDate ? format(completedDate, "PPP") : <span>Today (Default)</span>}
                        </Button>
                        
                        {showCompleteCalendar && (
                          <div className="absolute bottom-11 z-50 bg-zinc-950 border border-zinc-800 rounded-lg p-2 shadow-xl left-0 right-0 flex justify-center">
                            <Calendar
                              mode="single"
                              selected={completedDate}
                              onSelect={(date) => {
                                setCompletedDate(date);
                                setShowCompleteCalendar(false);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      onClick={handleComplete}
                      disabled={completeMutation.isPending}
                      className="w-full bg-green-500 hover:bg-green-400 text-zinc-950 font-bold h-11 flex items-center justify-center gap-1.5 border border-green-400 shadow-md"
                    >
                      <CheckCircle2 className="size-4" /> Submit Resolution Logs
                    </Button>
                  </div>
                )}

                {isCompleted && (
                  <div className="w-full p-2 border border-zinc-800 bg-zinc-950/40 rounded-xl text-center text-green-500 text-xs font-semibold flex items-center justify-center gap-1.5 font-mono select-none">
                    <CheckCircle2 className="size-4" /> JOB FULLY RESOLVED
                  </div>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
