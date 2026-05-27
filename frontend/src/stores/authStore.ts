import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth, googleProvider } from '@/src/firebase';
import { signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { api } from '@/src/lib/api';
import { toast } from 'sonner';

export type UserRole = 'ADMIN' | 'COMMUNITY' | 'CREW';

export interface UserState {
  user: {
    id?: string;
    uid?: string;
    email: string | null;
    displayName: string | null;
    photoURL?: string | null;
  } | null;
  role: UserRole;
  token: string | null;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  setRole: (role: UserRole) => void;
  isAdmin: () => boolean;
  isCrew: () => boolean;
}

export const useAuthStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      role: 'COMMUNITY',
      token: null,
      isAuthenticated: false,

      signInWithGoogle: async () => {
        try {
          const result = await signInWithPopup(auth, googleProvider);
          const fbUser = result.user;
          const token = await fbUser.getIdToken();

          try {
            // Sync user to PostgreSQL backend
            const syncResponse = await api.post('/api/auth/google-sync', {
              email: fbUser.email,
              fullName: fbUser.displayName || 'Google User',
              firebaseUid: fbUser.uid,
            });

            const dbUser = syncResponse.data;

            set({
              user: {
                id: dbUser.id,
                uid: fbUser.uid,
                email: dbUser.email,
                displayName: dbUser.fullName,
                photoURL: fbUser.photoURL,
              },
              role: dbUser.role as UserRole,
              token,
              isAuthenticated: true,
            });

            toast.success(`Welcome back, ${dbUser.fullName || 'User'}! (${dbUser.role} Portal)`);
          } catch (syncError: any) {
            console.error('Google sync to PostgreSQL failed:', syncError);
            if (syncError.code === 'ERR_NETWORK' || !syncError.response) {
              toast.warning('Database offline. Simulating local session.');
              
              // Fallback role resolution if DB is offline
              let resolvedRole: UserRole = 'COMMUNITY';
              const email = fbUser.email?.toLowerCase() || '';
              if (email.includes('admin')) {
                resolvedRole = 'ADMIN';
              } else if (email.includes('crew')) {
                resolvedRole = 'CREW';
              }

              set({
                user: {
                  id: 'offline-uuid',
                  uid: fbUser.uid,
                  email: fbUser.email,
                  displayName: fbUser.displayName,
                  photoURL: fbUser.photoURL,
                },
                role: resolvedRole,
                token,
                isAuthenticated: true,
              });
            } else {
              throw syncError;
            }
          }
        } catch (error: any) {
          console.error('Google Sign In Error:', error);
          toast.error(error.message || 'Failed to authenticate with Google.');
        }
      },

      signInWithEmail: async (email, password) => {
        try {
          const response = await api.post('/api/auth/login', { email, password });
          const dbUser = response.data;

          set({
            user: {
              id: dbUser.id,
              email: dbUser.email,
              displayName: dbUser.fullName,
              photoURL: null,
            },
            role: dbUser.role as UserRole,
            token: 'db-session-token',
            isAuthenticated: true,
          });

          toast.success(`Welcome back, ${dbUser.fullName || email}! (${dbUser.role} Portal)`);
        } catch (error: any) {
          console.error('Email Sign In Error:', error);
          const errorMsg = error.response?.data || 'Failed to authenticate with email and password.';
          toast.error(errorMsg);
          throw error;
        }
      },

      signUpWithEmail: async (email, password, fullName) => {
        try {
          const response = await api.post('/api/auth/register', {
            email,
            password,
            fullName,
          });
          const dbUser = response.data;

          set({
            user: {
              id: dbUser.id,
              email: dbUser.email,
              displayName: dbUser.fullName,
              photoURL: null,
            },
            role: dbUser.role as UserRole,
            token: 'db-session-token',
            isAuthenticated: true,
          });

          toast.success(`Account created! Welcome, ${dbUser.fullName}! (${dbUser.role} Portal)`);
        } catch (error: any) {
          console.error('Email Sign Up Error:', error);
          const errorMsg = error.response?.data || 'Failed to register with email and password.';
          toast.error(errorMsg);
          throw error;
        }
      },

      signOut: async () => {
        try {
          await fbSignOut(auth);
          set({
            user: null,
            role: 'COMMUNITY',
            token: null,
            isAuthenticated: false,
          });
          toast.success('Successfully logged out.');
        } catch (error: any) {
          toast.error('Logout failed.');
        }
      },

      setRole: (role: UserRole) => set({ role }),
      isAdmin: () => get().role === 'ADMIN',
      isCrew: () => get().role === 'CREW',
    }),
    {
      name: 'auth-storage',
    }
  )
);
