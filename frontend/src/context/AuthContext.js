import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../utils/api';
import { registerForPushNotificationsAsync, sendTokenToServer } from '../utils/notifications';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStorageData();
    }, []);

    const loadStorageData = async () => {
        try {
            const token = await SecureStore.getItemAsync('user_token');
            const userData = await SecureStore.getItemAsync('user_data');

            if (token && userData) {
                setUser(JSON.parse(userData));
                // Refresh push token on start
                registerForPushNotificationsAsync().then(t => {
                    if (t) sendTokenToServer(t);
                });
            }
        } catch (e) {
            console.error('Failed to load storage data', e);
        } finally {
            setLoading(false);
        }
    };

    const login = async (loginId, password) => {
        const response = await api.post('/auth/login', { login: loginId, password });
        const { token, user: userData } = response.data;

        await SecureStore.setItemAsync('user_token', token);
        await SecureStore.setItemAsync('user_data', JSON.stringify(userData));
        setUser(userData);

        // Register Push Token
        const pToken = await registerForPushNotificationsAsync();
        if (pToken) await sendTokenToServer(pToken);
    };

    const logout = async () => {
        await SecureStore.deleteItemAsync('user_token');
        await SecureStore.deleteItemAsync('user_data');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
