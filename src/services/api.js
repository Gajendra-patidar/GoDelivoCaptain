// Android emulator: use 10.0.2.2 for localhost
// iOS simulator: use http://localhost:5000
// Real device: replace with your machine LAN IP
// Android emulator: 10.0.2.2 maps to host machine's localhost
// Physical device: replace with your machine's LAN IP (e.g. 192.168.x.x)
export const API_HOST = 'https://godelivo.com/api';

export const DRIVER_BASE_URL = `${API_HOST}/driver`;
export const CAPTAIN_BASE_URL = `${API_HOST}/captain`;
export const AUTH_MOBILE_BASE_URL = `${API_HOST}/auth/mobile`;

// Backward-compat: many files import BASE_URL assuming driver APIs.
export const BASE_URL = DRIVER_BASE_URL;
