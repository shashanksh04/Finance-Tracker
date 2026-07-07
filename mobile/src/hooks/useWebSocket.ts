import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

type EventHandler = (data: any) => void;

const WS_BASE_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8000/ws';

export function useWebSocket(handlers: Record<string, EventHandler>) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const { tokens, isAuthenticated } = useAuthStore.getState();

  const connect = useCallback(() => {
    if (!isAuthenticated || !tokens?.access_token) return;

    const url = `${WS_BASE_URL}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ token: tokens.access_token }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { event: eventName, data } = message;
        if (handlers[eventName]) {
          handlers[eventName](data);
        }
      } catch {}
    };

    ws.onclose = () => {
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [isAuthenticated, tokens?.access_token]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return wsRef;
}
