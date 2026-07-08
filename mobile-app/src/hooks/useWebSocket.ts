import { useEffect, useRef, useState, useCallback } from 'react';
import { getStoredTokens } from '../services/api';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'wss://finance.shashankakumar.com/ws';

type MessageHandler = (data: any) => void;

export function useWebSocket(handlers?: Record<string, MessageHandler>) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();
  const handlersRef = useRef(handlers);

  handlersRef.current = handlers;

  const connect = useCallback(async () => {
    try {
      const tokens = await getStoredTokens();
      if (!tokens?.access_token) return;

      const ws = new WebSocket(`${WS_URL}?token=${tokens.access_token}`);

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const handler = handlersRef.current?.[msg.type];
          if (handler) handler(msg.payload || msg);
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      reconnectTimeout.current = setTimeout(connect, 10000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: Record<string, any>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, send };
}
