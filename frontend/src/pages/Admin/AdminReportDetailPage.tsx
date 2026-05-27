import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReportDetail, useReportWorkOrder } from '@/src/hooks/useReports';
import { BboxCanvas } from '@/src/components/scanner/BboxCanvas';
import { StatusBadge } from '@/src/components/reports/StatusBadge';
import { AssignWorkerSheet } from '@/src/components/admin/AssignWorkerSheet';
import { MapContainer } from '@/src/components/map/MapContainer';
import { MapMarker } from '@/src/components/map/Map';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import {
  ArrowLeft,
  FileText,
  MapPin,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function AdminReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: report, isLoading } = useReportDetail(id || '');
  const { data: workOrder } = useReportWorkOrder(id);
  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);
  const imageRef = useRef<HTMLImageElement>(null);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center text-zinc-400 font-mono text-xs">
        Loading incident details...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center p-4">
        <h2 className="text-zinc-200 text-sm font-semibold">Incident Not Found</h2>
        <Button onClick={() => navigate('/admin')} className="mt-4 bg-zinc-100 text-zinc-950 text-xs">
          Return to Admin
        </Button>
      </div>
    );
  }

  const {
    imageUrl,
    streetAddress,
    severity,
    status,
    detectedAt,
    estimatedDepthCm,
    priorityScore,
    confidenceScore,
  } = report;

  const timeAgo = detectedAt
    ? formatDistanceToNow(new Date(detectedAt), { addSuffix: true })
    : 'recently';

  const severityColor = {
    CRITICAL: '#F44336',
    MODERATE: '#FFC107',
    MINOR: '#4CAF50',
  }[severity || 'MINOR'];

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
            <Sparkles className="size-3 text-red-500 animate-pulse" /> Incident Inspector
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Image with bounding box overlays */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <Card className="bg-zinc-900 border-zinc-800 overflow-hidden flex flex-col justify-center relative flex-grow min-h-[350px]">
              <CardHeader className="p-4 border-b border-zinc-800/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-zinc-200">
                  <ShieldAlert className="size-4 text-zinc-400" />
                  Captured Image Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex items-center justify-center bg-black/60 relative overflow-hidden flex-grow">
                <div className="relative max-w-full max-h-[500px]">
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt={streetAddress || 'Pothole'}
                    className="max-w-full max-h-[500px] object-contain block mx-auto"
                  />

                  {/* Primary BBox Canvas */}
                  {report.bboxX !== undefined &&
                    report.bboxY !== undefined &&
                    report.bboxWidth !== undefined &&
                    report.bboxHeight !== undefined && (
                      <BboxCanvas
                        bboxX={report.bboxX}
                        bboxY={report.bboxY}
                        bboxWidth={report.bboxWidth}
                        bboxHeight={report.bboxHeight}
                        color={severityColor}
                        label={`${severity} - ${((confidenceScore || 0) * 100).toFixed(0)}%`}
                        imageRef={imageRef}
                      />
                    )}

                  {/* Additional BBox Canvases */}
                  {report.additionalDetections?.map((det, index) => (
                    <BboxCanvas
                      key={`additional-bbox-${index}`}
                      bboxX={det.bboxX}
                      bboxY={det.bboxY}
                      bboxWidth={det.bboxWidth}
                      bboxHeight={det.bboxHeight}
                      color={det.severityColor || '#ecc94b'}
                      label={`${det.severity || 'MINOR'} - ${((det.confidenceScore || 0) * 100).toFixed(0)}%`}
                      imageRef={imageRef}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: AI Analysis details, Municipal PDF generation, Maps & Dispatch */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center gap-2 mb-1">
                  <StatusBadge status={status} />
                  <span className="text-[10px] text-zinc-500 font-mono">ID: {report.id.substring(0, 8)}...</span>
                </div>
                <CardTitle className="text-lg text-zinc-100">{streetAddress || 'Unnamed Road'}</CardTitle>
                <CardDescription className="text-xs text-zinc-400">Captured {timeAgo}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* AI Metas */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-zinc-950 border border-zinc-805 rounded-xl text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-zinc-500 block text-[10px] uppercase">Severity</span>
                    <span className="font-semibold text-zinc-200" style={{ color: severityColor }}>{severity}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 block text-[10px] uppercase">Est. Depth</span>
                    <span className="font-semibold text-zinc-200">{estimatedDepthCm != null ? estimatedDepthCm.toFixed(1) : 'N/A'} cm</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 block text-[10px] uppercase">Confidence</span>
                    <span className="font-semibold text-zinc-200">{confidenceScore != null ? `${(confidenceScore * 100).toFixed(0)}%` : 'N/A'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 block text-[10px] uppercase">Priority Score</span>
                    <span className="font-semibold text-zinc-200">{priorityScore != null ? priorityScore.toFixed(0) : 'N/A'} / 100</span>
                  </div>
                </div>

                {/* PDF Complaint Filing */}
                <div className="p-3.5 bg-zinc-950/40 border border-zinc-800 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                      <FileText className="size-4 text-zinc-500" />
                      Municipal PDF Complaint
                    </span>
                    <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0 ${
                      report.complaintSent ? 'border-green-500 text-green-500 bg-green-950/10' : 'border-zinc-800 text-zinc-500'
                    }`}>
                      {report.complaintSent ? 'Generated' : 'Not Filed'}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-normal">
                    Official engineering PDF reports are automatically prepared detailing coordinates, severity, and photo logs.
                  </p>
                  {report.complaintSent && report.complaintPdfUrl && (
                    <a
                      href={report.complaintPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button size="sm" variant="outline" className="w-full text-xs border-zinc-800 hover:bg-zinc-800 text-zinc-300 h-8">
                        Download PDF Log
                      </Button>
                    </a>
                  )}
                </div>

                {/* Dispatch Crew status */}
                <div className="p-3.5 bg-zinc-950/40 border border-zinc-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                    <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                      <UserCheck className="size-4 text-zinc-500" /> Dispatch Status
                    </span>
                  </div>

                  {status === 'REPORTED' || status === 'VERIFIED' ? (
                    <div className="space-y-2">
                      <p className="text-[10px] text-zinc-500 leading-normal">
                        No maintenance crew has been dispatched to patch this pothole yet.
                      </p>
                      <Button
                        onClick={() => setIsAssignOpen(true)}
                        className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold h-8 text-xs flex items-center justify-center gap-1.5"
                      >
                        <UserCheck className="size-3.5" /> Assign Repair Crew
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs space-y-1.5 text-zinc-400 font-mono">
                        <div className="flex justify-between">
                          <span>Crew Assigned:</span>
                          <strong className="text-zinc-200">{workOrder?.teamName || 'N/A'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Schedule Date:</span>
                          <span className="text-zinc-300">
                            {workOrder?.scheduledDate 
                              ? new Date(workOrder.scheduledDate).toLocaleDateString()
                              : 'Pending'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Ward Office:</span>
                          <span className="text-zinc-300">{workOrder?.wardOfficeEmail || 'None'}</span>
                        </div>
                        {workOrder?.completedAt && (
                          <div className="flex justify-between">
                            <span>Completed Date:</span>
                            <span className="text-zinc-300">
                              {new Date(workOrder.completedAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                      {(status === 'ASSIGNED' || status === 'IN_PROGRESS') && (
                        <Button
                          onClick={() => setIsAssignOpen(true)}
                          variant="outline"
                          className="w-full border-zinc-800 hover:bg-zinc-800 text-zinc-300 h-8 text-xs flex items-center justify-center gap-1.5"
                        >
                          <UserCheck className="size-3.5" /> Reassign Repair Crew
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Map coordinates display */}
                {report.latitude && report.longitude && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                      <MapPin className="size-3.5 text-zinc-500" /> Geolocated Pin
                    </span>
                    <div className="h-28 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 relative">
                      <MapContainer center={[report.longitude, report.latitude]} zoom={15}>
                        <MapMarker latitude={report.latitude} longitude={report.longitude}>
                          <div className="size-3.5 rounded-full border-2 border-zinc-950 shadow-lg animate-pulse" style={{ backgroundColor: severityColor }} />
                        </MapMarker>
                      </MapContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AssignWorkerSheet
        report={report}
        isOpen={isAssignOpen}
        onOpenChange={setIsAssignOpen}
      />
    </div>
  );
}
