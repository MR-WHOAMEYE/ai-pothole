import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/src/stores/authStore';

// Lazy load pages for optimized loading
const HomePage = React.lazy(() => import('@/src/pages/HomePage'));
const LoginPage = React.lazy(() => import('@/src/pages/LoginPage'));
const LiveScanPage = React.lazy(() => import('@/src/pages/LiveScanPage'));
const ReviewSubmitPage = React.lazy(() => import('@/src/pages/ReviewSubmitPage'));
const MyReportsPage = React.lazy(() => import('@/src/pages/MyReportsPage'));
const AdminMapPage = React.lazy(() => import('@/src/pages/Admin/AdminMapPage'));
const AdminReportDetailPage = React.lazy(() => import('@/src/pages/Admin/AdminReportDetailPage'));
const AdminAnalyticsPage = React.lazy(() => import('@/src/pages/Admin/AdminAnalyticsPage'));
const CrewJobsPage = React.lazy(() => import('@/src/pages/Crew/CrewJobsPage'));
const CrewJobDetailPage = React.lazy(() => import('@/src/pages/Crew/CrewJobDetailPage'));

// Create TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Guard components for routes
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, role } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  // Enforce dark mode class on document.documentElement
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <React.Suspense
          fallback={
            <div className="h-[100dvh] w-screen bg-zinc-950 flex items-center justify-center text-zinc-400 font-mono text-xs">
              Initializing PotholeIQ...
            </div>
          }
        >
          <Routes>
            {/* Citizens Portal Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/scan" element={<LiveScanPage />} />
            <Route path="/submit" element={<ReviewSubmitPage />} />
            <Route path="/reports" element={<MyReportsPage />} />

            {/* Admin Portal Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminMapPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/report/:id"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminReportDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminAnalyticsPage />
                </ProtectedRoute>
              }
            />

            {/* Crew Portal Routes */}
            <Route
              path="/crew"
              element={
                <ProtectedRoute allowedRoles={['CREW']}>
                  <CrewJobsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/crew/job/:id"
              element={
                <ProtectedRoute allowedRoles={['CREW']}>
                  <CrewJobDetailPage />
                </ProtectedRoute>
              }
            />

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>

      {/* Global Notifications */}
      <Toaster position="top-center" theme="dark" closeButton richColors />
    </QueryClientProvider>
  );
}
