export interface DamageReport {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  latitude?: number;
  longitude?: number;
  addressText?: string;
  streetAddress?: string;
  hasPothole: boolean;
  confidenceScore?: number;
  bboxX?: number;
  bboxY?: number;
  bboxWidth?: number;
  bboxHeight?: number;
  additionalDetections?: {
    bboxX: number;
    bboxY: number;
    bboxWidth: number;
    bboxHeight: number;
    confidenceScore: number;
    severity: string;
    severityColor: string;
  }[];
  estimatedDepthCm?: number;
  severity?: 'MINOR' | 'MODERATE' | 'CRITICAL';
  priorityScore?: number;
  status: 'REPORTED' | 'VERIFIED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  complaintSent?: boolean;
  complaintPdfUrl?: string;
  detectedAt?: string;
  scannerSessionId?: string;
  createdAt?: string;
  updatedAt?: string;
  reporterId?: string;
}

export interface WorkOrder {
  id: string;
  reportId: string;
  assignedCrewId?: string;
  adminId?: string;
  estimatedCost?: number;
  scheduledDate?: string;
  completedAt?: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  crewNotes?: string;
  status: 'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  teamName?: string;
  wardOfficeEmail?: string;
  createdAt?: string;
}

export interface DashboardStats {
  total: number;
  pending: number;
  completed: number;
  critical: number;
  avgResponseTimeH: number;
}

export const MOCK_REPORTS: DamageReport[] = [];
export const MOCK_WORK_ORDERS: WorkOrder[] = [];
export const MOCK_STATS: DashboardStats = {
  total: 0,
  pending: 0,
  completed: 0,
  critical: 0,
  avgResponseTimeH: 0,
};
export const MOCK_HEATMAP: { lat: number; lng: number; count: number }[] = [];
export const MOCK_GEOJSON = {
  type: 'FeatureCollection',
  features: [],
};
