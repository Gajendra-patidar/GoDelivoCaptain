// Android emulator: use 10.0.2.2 for localhost
// iOS simulator: use http://localhost:5000
// Real device: replace with your machine LAN IP
export const API_HOST = 'https://porterbackend-iyxh.onrender.com';
export const DRIVER_BASE_URL = `${API_HOST}/api/driver`;
export const AUTH_MOBILE_BASE_URL = `${API_HOST}/api/auth/mobile`;

// Backward-compat: many files import BASE_URL assuming driver APIs.
export const BASE_URL = DRIVER_BASE_URL;
