import { useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const WS_URL = 'ws://192.168.18.58:5000'; // Local IP for physical device

export const useSocket = () => {
    const ws = useRef(null);
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        const connect = async () => {
            const token = await SecureStore.getItemAsync('user_token');
            if (!token) return;

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

            ws.current.onclose = () => {
                console.log('WS Disconnected');
            };
        };

        connect();

        return () => {
            if (ws.current) ws.current.close();
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
        }
    };

    return { messages, sendMessage, setMessages };
};
