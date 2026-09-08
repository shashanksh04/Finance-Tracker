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
  const shouldReconnectRef = useRef(true);
  const attemptRef = useRef(0);
  const { tokens } = useAuthStore();

  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (!tokens?.access_token) return;
    if (!shouldReconnectRef.current) return;
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      ws.send(JSON.stringify({ token: tokens.access_token }));
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (!parsed || typeof parsed.event !== 'string') return;
        const handler = handlersRef.current[parsed.event];
        if (handler) handler(parsed.data);
      } catch {}
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (!shouldReconnectRef.current) return;
      const delay = Math.min(30000, 1000 * Math.pow(1.6, attemptRef.current++)) + Math.random() * 500;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      try { ws.close(); } catch {}
    };
  }, [tokens?.access_token]);

  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    shouldReconnectRef.current = true;
    attemptRef.current = 0;
    connect();
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };
  }, [tokens?.access_token, connect]);
}
