import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Primary: Render.com
// Fallback: Hostinger PHP
const PRIMARY_BASE_URL = 'https://messaging-app-xlvj.onrender.com/api';
const FALLBACK_BASE_URL = 'https://YOUR_HOSTINGER_DOMAIN/pm-api/api'; 

const api = axios.create({
    baseURL: PRIMARY_BASE_URL,
    timeout: 5000,
});

// Helper to switch backend
export const setBackend = (useFallback = false) => {
    api.defaults.baseURL = useFallback ? FALLBACK_BASE_URL : PRIMARY_BASE_URL;
};

// Add Interceptor to attach token
api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('user_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor to handle fallback
api.interceptors.response.use(
    response => response,
    async error => {
        if (error.config && !error.config._retry && !error.config.baseURL.includes(FALLBACK_BASE_URL)) {
            error.config._retry = true;
            console.log('Primary API failed, trying fallback...');
            setBackend(true);
            error.config.baseURL = FALLBACK_BASE_URL;
            return api(error.config);
        }
        return Promise.reject(error);
    }
);

export default api;
