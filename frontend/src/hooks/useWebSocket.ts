import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

type EventHandler = (data?: any) => void;

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function useWebSocket(handlers: Record<string, EventHandler>, deps: any[] = []) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handlersRef = useRef(handlers);
  const { tokens } = useAuthStore();

  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (!tokens?.access_token) return;
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ token: tokens.access_token }));
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
    };

    ws.onmessage = (event) => {
      try {
        const { event: eventName, data } = JSON.parse(event.data);
        const handler = handlersRef.current[eventName];
        if (handler) handler(data);
      } catch {}
    };

    ws.onclose = () => {
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [tokens?.access_token]);

  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens?.access_token]);
}
