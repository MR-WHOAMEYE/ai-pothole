import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { DamageReport, WorkOrder, DashboardStats } from '@/src/lib/mockData';
import { useAuthStore } from '@/src/stores/authStore';
import { toast } from 'sonner';

// ── 1. Nearby Reports Query ───────────────────────────────────────────────
export function useNearbyReports(lat: number, lng: number, radiusMeters: number = 1000) {
  return useQuery({
    queryKey: ['reports', 'nearby', lat, lng, radiusMeters],
    queryFn: async () => {
      const response = await api.get(`/api/reports/nearby?lat=${lat}&lng=${lng}&radiusMeters=${radiusMeters}`);
      return response.data as DamageReport[];
    },
    enabled: !!lat && !!lng && lat !== 0 && lng !== 0,
  });
}

// ── 2. My Reports Query ──────────────────────────────────────────────────
export function useMyReports(userId?: string) {
  return useQuery({
    queryKey: ['reports', 'my-reports', userId],
    queryFn: async () => {
      const response = await api.get(`/api/reports/my-reports?userId=${userId || ''}`);
      return response.data as DamageReport[];
    },
    enabled: !!userId && userId !== 'offline-uuid',
  });
}

// ── 3. Single Report Details ──────────────────────────────────────────────
export function useReportDetail(id: string) {
  return useQuery({
    queryKey: ['reports', 'detail', id],
    queryFn: async () => {
      const response = await api.get(`/api/reports/${id}`);
      return response.data as DamageReport;
    },
    enabled: !!id,
  });
}

// ── 3b. Report Work Order Details ─────────────────────────────────────────
export function useReportWorkOrder(reportId?: string) {
  return useQuery({
    queryKey: ['reports', 'workorder', reportId],
    queryFn: async () => {
      const response = await api.get(`/api/admin/reports/${reportId}/workorder`);
      return response.data as WorkOrder;
    },
    enabled: !!reportId,
    retry: false, // Will 404 if no work order exists, don't keep retrying
  });
}

// ── 4. Admin Map Data (GeoJSON) ───────────────────────────────────────────
export function useAdminMapData(severity?: string, status?: string) {
  return useQuery({
    queryKey: ['admin', 'map-data', severity, status],
    queryFn: async () => {
      const sevQuery = severity ? `severity=${severity}` : '';
      const statQuery = status ? `status=${status}` : '';
      const query = [sevQuery, statQuery].filter(Boolean).join('&');
      const response = await api.get(`/api/admin/map-data?${query}`);
      return response.data;
    },
  });
}

// ── 5. Admin Heatmap Data ─────────────────────────────────────────────────
export function useAdminHeatmap() {
  return useQuery({
    queryKey: ['admin', 'heatmap'],
    queryFn: async () => {
      const response = await api.get('/api/admin/heatmap');
      return response.data as { lat: number; lng: number; count: number }[];
    },
  });
}

// ── 6. Admin Dashboard Stats ──────────────────────────────────────────────
export function useDashboardStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const response = await api.get('/api/admin/dashboard/stats');
      return response.data as DashboardStats;
    },
  });
}

// ── 7. Admin Paginated Reports List ───────────────────────────────────────
export function useAdminReportsList(status?: string, page: number = 0, size: number = 20) {
  return useQuery({
    queryKey: ['admin', 'reports-list', status, page, size],
    queryFn: async () => {
      const response = await api.get(`/api/admin/reports?status=${status || ''}&page=${page}&size=${size}`);
      return response.data;
    },
  });
}

// ── 8. Crew Assignments Query ─────────────────────────────────────────────
export function useCrewAssignments(email?: string | null) {
  return useQuery({
    queryKey: ['crew', 'assignments', email],
    queryFn: async () => {
      const response = await api.get(`/api/crew/assignments?email=${encodeURIComponent(email || '')}`);
      return response.data as WorkOrder[];
    },
    enabled: !!email && email !== '',
  });
}

// ── 9. Crew Job Details Query ─────────────────────────────────────────────
export function useCrewJobDetail(id: string) {
  return useQuery({
    queryKey: ['crew', 'job-detail', id],
    queryFn: async () => {
      const response = await api.get(`/api/crew/workorders/${id}`);
      return response.data as WorkOrder;
    },
    enabled: !!id,
  });
}

// ── MUTATIONS ─────────────────────────────────────────────────────────────

// A. Upload report (Citizen photo flow)
export function useUploadReportMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  return useMutation({
    mutationFn: async ({ imageFile, lat, lng, sessionId, description }: {
      imageFile: File;
      lat?: number;
      lng?: number;
      sessionId?: string;
      description?: string;
    }) => {
      const formData = new FormData();
      formData.append('image', imageFile);
      if (lat) formData.append('lat', lat.toString());
      if (lng) formData.append('lng', lng.toString());
      if (sessionId) formData.append('sessionId', sessionId);
      if (description) formData.append('description', description);
      if (user?.id) formData.append('reporterId', user.id);

      const response = await api.post('/api/reports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

// B. Submit location manually
export function useSubmitLocationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, latitude, longitude }: { reportId: string; latitude: number; longitude: number }) => {
      const response = await api.post(`/api/scanner/location?reportId=${reportId}`, { latitude, longitude });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

// C. Assign work order (Admin)
export function useAssignCrewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, teamName, wardEmail, scheduledDate }: {
      reportId: string;
      teamName: string;
      wardEmail?: string;
      scheduledDate?: string;
    }) => {
      const response = await api.post(`/api/admin/assign?reportId=${reportId}&teamName=${encodeURIComponent(teamName)}&wardEmail=${encodeURIComponent(wardEmail || '')}&scheduledDate=${encodeURIComponent(scheduledDate || '')}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success('Repair crew assigned successfully!');
    },
  });
}

// D. Start work order (Crew)
export function useStartJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workOrderId: string) => {
      const response = await api.post(`/api/crew/workorders/${workOrderId}/start`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Job started!');
    },
  });
}

// E. Add progress notes (Crew)
export function useAddJobNotesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workOrderId, notes }: { workOrderId: string; notes: string }) => {
      const response = await api.post(`/api/crew/workorders/${workOrderId}/notes`, notes, {
        headers: { 'Content-Type': 'text/plain' },
      });
      return response.data;
    },
    onSuccess: (_, { workOrderId }) => {
      queryClient.invalidateQueries({ queryKey: ['crew', 'job-detail', workOrderId] });
      toast.success('Progress note saved.');
    },
  });
}

// F. Complete work order (Crew)
export function useCompleteJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workOrderId, afterImage, completedAt }: { workOrderId: string; afterImage?: File; completedAt?: string }) => {
      const formData = new FormData();
      if (afterImage) {
        formData.append('afterImage', afterImage);
      }

      const url = `/api/crew/workorders/${workOrderId}/complete` + 
        (completedAt ? `?completedAtStr=${encodeURIComponent(completedAt)}` : '');

      const response = await api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Job marked completed!');
    },
  });
}
