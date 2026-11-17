import { trackDataAction } from './loadingBus';

const rawApiUrl = process.env.REACT_APP_API_URL;
// Empty REACT_APP_API_URL => same-origin requests (CRA proxy / production reverse proxy)
const API_URL =
  rawApiUrl == null || String(rawApiUrl).trim() === ''
    ? ''
    : String(rawApiUrl).replace(/\/$/, '');

const TOKEN_KEY = 'photobothus_token';
const USER_KEY = 'photobothus_user';

export function getApiUrl() {
  return API_URL;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiRequest(path, options = {}) {
  const { silent, ...request } = options;
  const run = async () => {
    const headers = { ...(request.headers || {}) };
    const token = getToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (request.body && !(request.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...request,
      headers,
      body:
        request.body && !(request.body instanceof FormData) && typeof request.body !== 'string'
          ? JSON.stringify(request.body)
          : request.body,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  };
  return silent ? run() : trackDataAction(run);
}

export async function uploadStrip(endpoint, file, title, extraFields = {}) {
  const form = new FormData();
  form.append('image', file);
  if (title) form.append('title', title);
  Object.entries(extraFields).forEach(([key, value]) => {
    if (value != null && value !== '') form.append(key, value);
  });
  return apiRequest(endpoint, { method: 'POST', body: form });
}

/** Downloads a file from an API route that needs the user to be signed in. */
export async function downloadFile(path, filename) {
  const blob = await trackDataAction(async () => {
    const token = getToken();
    const response = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Download failed');
    }
    return response.blob();
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start saving before the blob is released.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}

export function getEventGuestKey(eventCode) {
  if (!eventCode || typeof window === 'undefined') return '';
  const storageKey = `photobothus_guest_${eventCode}`;
  let key = localStorage.getItem(storageKey);
  if (!key) {
    key =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(storageKey, key);
  }
  return key;
}

