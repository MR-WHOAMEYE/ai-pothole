import { create } from 'zustand';

export interface Detection {
  reportId?: string;
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  confidenceScore: number;
  severity: 'MINOR' | 'MODERATE' | 'CRITICAL';
  severityColor: string;
  priorityScore: number;
  estimatedDepthCm: number;
  streetAddress?: string;
  latitude?: number;
  longitude?: number;
}

export interface ScannerState {
  sessionId: string;
  isScanning: boolean;
  lastDetection: Detection | null;
  initializeSession: () => void;
  startScanning: () => void;
  stopScanning: () => void;
  setLastDetection: (detection: Detection | null) => void;
  resetSession: () => void;
}

const generateUUID = () => {
  return 'scanner-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const useScannerStore = create<ScannerState>((set, get) => ({
  sessionId: generateUUID(),
  isScanning: false,
  lastDetection: null,

  initializeSession: () => {
    if (!get().sessionId) {
      set({ sessionId: generateUUID() });
    }
  },

  startScanning: () => set({ isScanning: true, lastDetection: null }),
  stopScanning: () => set({ isScanning: false }),
  setLastDetection: (detection) => set({ lastDetection: detection }),
  resetSession: () => set({ sessionId: generateUUID(), isScanning: false, lastDetection: null }),
}));
