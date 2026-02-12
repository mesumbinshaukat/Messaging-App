import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'https://messaging-app-five-gamma.vercel.app/api';

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Add Interceptor to attach token
api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('user_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
