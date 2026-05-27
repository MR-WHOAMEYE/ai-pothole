import { create } from 'zustand';
import { DamageReport } from '@/src/lib/mockData';

interface LiveFeedState {
  reports: DamageReport[];
  setReports: (reports: DamageReport[]) => void;
  addReport: (report: DamageReport) => void;
  clearFeed: () => void;
}

export const useLiveFeedStore = create<LiveFeedState>((set) => ({
  reports: [],

  setReports: (reports) => {
    set({ reports: reports.slice(0, 50) });
  },

  addReport: (report) => {
    set((state) => {
      // Avoid duplicate reports by ID (e.g. if polling overlaps)
      if (state.reports.some((r) => r.id === report.id)) {
        return state;
      }
      
      // Prepend the new report (newest first) and keep only the last 50 items
      const updatedReports = [report, ...state.reports].slice(0, 50);
      return { reports: updatedReports };
    });
  },

  clearFeed: () => set({ reports: [] }),
}));
