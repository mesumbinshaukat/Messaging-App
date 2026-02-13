import { useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const WS_URL = 'wss://messaging-app-five-gamma.vercel.app';

export const useSocket = () => {
    const ws = useRef(null);
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        let reconnectTimeout;

        const connect = async () => {
            const token = await SecureStore.getItemAsync('user_token');
            if (!token) {
                console.log('No token found, skipping WS connection');
                return;
            }

            console.log('Attempting WS connection...');
            ws.current = new WebSocket(WS_URL);

            ws.current.onopen = () => {
                console.log('WS Connected');
                ws.current.send(JSON.stringify({ type: 'auth', token }));
            };

            ws.current.onmessage = (e) => {
                const data = JSON.parse(e.data);
                if (data.type === 'chat_message') {
                    setMessages((prev) => [...prev, data]);
                }
            };

            ws.current.onclose = (e) => {
                console.log(`WS Disconnected: ${e.code}. Reconnecting in 3s...`);
                reconnectTimeout = setTimeout(connect, 3000);
            };

            ws.current.onerror = (err) => {
                console.error('WS Error:', err);
                ws.current.close();
            };
        };

        connect();

        return () => {
            if (ws.current) ws.current.close();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };
    }, []);

    const sendMessage = (recipientId, content) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'chat_message',
                recipientId,
                content,
                timestamp: new Date().toISOString(),
                messageId: Math.random().toString(36).substr(2, 9)
            }));
            return true;
        }
        return false;
    };

    return { messages, sendMessage, setMessages };
};
