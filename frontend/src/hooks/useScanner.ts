import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScannerStore, Detection } from '@/src/stores/scannerStore';
import { useLocationStore } from '@/src/stores/locationStore';
import { useAuthStore } from '@/src/stores/authStore';
import { api } from '@/src/lib/api';
import { toast } from 'sonner';

export function useScanner(webcamRef: React.RefObject<any>, onTriggerFlash: (color: string) => void) {
  const navigate = useNavigate();
  const { sessionId, isScanning, stopScanning, setLastDetection } = useScannerStore();
  const { lat, lng } = useLocationStore();
  const { user } = useAuthStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to convert dataURI (base64) from react-webcam to File object
  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const captureAndUploadFrame = useCallback(async () => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    try {
      const file = dataURLtoFile(imageSrc, 'frame.jpg');
      const formData = new FormData();
      formData.append('image', file);
      formData.append('sessionId', sessionId);
      if (lat && lng) {
        formData.append('lat', lat.toString());
        formData.append('lng', lng.toString());
      }
      // Link the report to the logged-in user's row in the users table
      if (user?.id) {
        formData.append('reporterId', user.id);
      }

      // POST to backend API
      const response = await api.post('/api/scanner/frame', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = response.data;

      // Handle 202 Accepted (location required) or 200 OK (processed)
      if (data.potholeFound || (data.detections && data.detections.length > 0)) {
        const detections = data.detections || [];
        const bestDetection: Detection = detections[0];
        
        // Match severity to colors
        const flashColor =
          bestDetection.severity === 'CRITICAL'
            ? '#F44336'
            : bestDetection.severity === 'MODERATE'
            ? '#FFC107'
            : '#4CAF50';

        // Trigger visual feedback
        onTriggerFlash(flashColor);
        setLastDetection(bestDetection);
        
        toast.success(`Pothole detected! Severity: ${bestDetection.severity}`);

        if (data.locationRequired) {
          // Pause scan to handle manual GPS entry
          stopScanning();
          // Redirect to submit page passing locationRequired=true
          navigate('/submit', {
            state: {
              imageFile: file,
              reportId: data.reportId,
              detectionData: bestDetection,
              locationRequired: true,
            },
          });
        } else {
          // Fully resolved - redirect directly to submit for confirmation
          stopScanning();
          navigate('/submit', {
            state: {
              imageFile: file,
              reportId: data.reportId || bestDetection.reportId,
              detectionData: bestDetection,
              locationRequired: false,
            },
          });
        }
      }
    } catch (error: any) {
      // In case the API is offline/unreachable, we run silently without crashing
      console.warn('Frame upload failed or API is offline.', error.message);
    }
  }, [sessionId, lat, lng, webcamRef, onTriggerFlash, setLastDetection, stopScanning, navigate]);

  useEffect(() => {
    if (isScanning) {
      intervalRef.current = setInterval(() => {
        captureAndUploadFrame();
      }, 800);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isScanning, captureAndUploadFrame]);

  return {
    captureAndUploadFrame,
  };
}
