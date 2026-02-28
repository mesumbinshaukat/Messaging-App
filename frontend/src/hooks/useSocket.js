import { useEffect, useRef, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

// Primary: Render.com WebSocket
// Fallback: Long polling via PHP backend
const WS_URL = 'wss://messaging-app-xlvj.onrender.com'; 
const POLL_URL = 'https://YOUR_HOSTINGER_DOMAIN/pm-api'; 

export const useSocket = () => {
  const ws = useRef(null);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [transport, setTransport] = useState('disconnected'); // 'websocket' | 'polling' | 'ble' | 'disconnected'
  const reconnectDelay = useRef(1000);
  const pingInterval = useRef(null);
  const reconnectTimeout = useRef(null);
  const pollingInterval = useRef(null);
  const lastTimestamp = useRef(Date.now());

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const startPolling = useCallback(async () => {
    stopPolling();
    setTransport('polling');
    
    pollingInterval.current = setInterval(async () => {
      try {
        const token = await SecureStore.getItemAsync('user_token');
        const response = await fetch(`${POLL_URL}/api/poll?since=${Math.floor(lastTimestamp.current / 1000)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.messages?.length > 0) {
          lastTimestamp.current = Date.now();
          data.messages.forEach(msg => {
            setMessages(prev => [...prev, { ...msg, type: 'chat_message' }]);
          });
        }
      } catch (e) {
        console.log('Polling error:', e.message);
      }
    }, 3000);
  }, []);

  const connect = useCallback(async () => {
    const token = await SecureStore.getItemAsync('user_token');
    if (!token) return;

    if (ws.current) {
      ws.current.close();
    }

    ws.current = new WebSocket(WS_URL);

    const connectionTimeout = setTimeout(() => {
      if (ws.current?.readyState !== 1) {
        ws.current?.close();
        startPolling(); // Fall back to polling
      }
    }, 5000); // 5s to connect, else poll

    ws.current.onopen = () => {
      clearTimeout(connectionTimeout);
      stopPolling();
      setIsConnected(true);
      setTransport('websocket');
      reconnectDelay.current = 1000; // Reset backoff
      
      ws.current.send(JSON.stringify({ type: 'auth', token }));
      
      // Keep-alive ping every 30s
      pingInterval.current = setInterval(() => {
        if (ws.current?.readyState === 1) {
          ws.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.current.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'pong') return; // Ignore pong
        if (data.type === 'chat_message') {
          lastTimestamp.current = Date.now();
          setMessages(prev => [...prev, data]);
        }
        if (data.type === 'delivery_ack') {
          // Handle logic in UI to update status
          setMessages(prev => [...prev, data]); // Relay to Screen
        }
        if (data.type === 'typing') {
          setMessages(prev => [...prev, data]); // Relay to Screen
        }
      } catch (_) {}
    };

    ws.current.onclose = (e) => {
      clearTimeout(connectionTimeout);
      clearInterval(pingInterval.current);
      setIsConnected(false);
      
      if (e.code !== 1000) { // Not intentional close
        setTransport('polling');
        startPolling(); // Start polling immediately
        
        // Exponential backoff reconnect
        reconnectTimeout.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
          connect();
        }, reconnectDelay.current);
      }
    };

    ws.current.onerror = () => {
      ws.current?.close();
    };
  }, [startPolling]);

  useEffect(() => {
    connect();

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        if (ws.current?.readyState !== 1) connect();
      } else if (state === 'background') {
        // Don't disconnect — keep alive for notifications
      }
    });

    return () => {
      if (ws.current) ws.current.close(1000, 'Component unmounting');
      clearInterval(pingInterval.current);
      clearTimeout(reconnectTimeout.current);
      stopPolling();
      sub.remove();
    };
  }, [connect]);

  const sendMessage = useCallback((recipientId, packet, messageId) => {
    if (ws.current?.readyState === 1) {
      ws.current.send(JSON.stringify({
        type: 'chat_message',
        recipientId,
        content: packet.content,
        nonce: packet.nonce,
        timestamp: new Date().toISOString(),
        messageId,
      }));
      return true;
    }
    return false;
  }, []);

  const sendTyping = useCallback((recipientId, isTyping) => {
    if (ws.current?.readyState === 1) {
      ws.current.send(JSON.stringify({
        type: 'typing',
        recipientId,
        isTyping
      }));
    }
  }, []);

  return { messages, sendMessage, sendTyping, setMessages, isConnected, transport };
};
