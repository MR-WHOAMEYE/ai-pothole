import { useEffect, useRef, useState } from 'react';
import { DamageReport } from '@/src/lib/mockData';
import { api } from '@/src/lib/api';

export function useWebSocket(onNewReport: (report: DamageReport) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const wsUrl = API_URL.replace(/^http/, 'ws') + '/ws/admin';

    const connect = () => {
      try {
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          setIsConnected(true);
          console.log('WS: Connected to admin live feed.');
          // Stop polling if WebSocket is successful
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        };

        socket.onmessage = (event) => {
          try {
            const report: DamageReport = JSON.parse(event.data);
            onNewReport(report);
          } catch (e) {
            console.error('WS Error parsing message:', e);
          }
        };

        socket.onclose = () => {
          setIsConnected(false);
          console.log('WS: Closed. Falling back to HTTP polling.');
          startPolling();
        };

        socket.onerror = () => {
          setIsConnected(false);
          socket.close();
        };
      } catch (err) {
        console.warn('WS connection failed. Starting HTTP polling.');
        startPolling();
      }
    };

    const startPolling = () => {
      if (pollingIntervalRef.current) return;

      // Poll every 5s from the reports endpoint for new reports
      pollingIntervalRef.current = setInterval(async () => {
        try {
          // Fetch the first page of reports to check for new entries
          const response = await api.get('/api/admin/reports?page=0&size=5');
          const reports: DamageReport[] = response.data.content || [];
          // Emit each fetched report
          reports.reverse().forEach((r) => onNewReport(r));
        } catch (err) {
          console.debug('Polling failed. API offline.');
        }
      }, 5000);
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [onNewReport]);

  return { isConnected };
}
