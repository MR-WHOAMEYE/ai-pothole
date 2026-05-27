import { create } from 'zustand';

export interface LocationState {
  lat: number;
  lng: number;
  accuracy: number | null;
  isWatching: boolean;
  watchId: number | null;
  error: string | null;
  startWatching: () => void;
  stopWatching: () => void;
  setManualLocation: (lat: number, lng: number) => void;
}

// Default location is Bengaluru center (India)
const DEFAULT_LAT = 12.9716;
const DEFAULT_LNG = 77.5946;

export const useLocationStore = create<LocationState>((set, get) => ({
  lat: DEFAULT_LAT,
  lng: DEFAULT_LNG,
  accuracy: null,
  isWatching: false,
  watchId: null,
  error: null,

  startWatching: () => {
    if (get().isWatching) return;

    if (!navigator.geolocation) {
      set({ error: 'Geolocation is not supported by this browser.' });
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        set({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
          isWatching: true,
        });
      },
      (error) => {
        let msg = 'Failed to fetch location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission denied. Using default coordinates.';
        }
        set({ error: msg, isWatching: false });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );

    set({ watchId: id, isWatching: true });
  },

  stopWatching: () => {
    const id = get().watchId;
    if (id !== null) {
      navigator.geolocation.clearWatch(id);
      set({ watchId: null, isWatching: false });
    }
  },

  setManualLocation: (lat: number, lng: number) => {
    get().stopWatching();
    set({ lat, lng, accuracy: null, isWatching: false, error: null });
  },
}));
