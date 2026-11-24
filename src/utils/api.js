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

/** True when fetch itself failed (API down, offline, CORS block, etc.). */
export function isNetworkError(error) {
  if (!error) return false;
  if (error.name === 'TypeError') return true;
  const message = String(error.message || '').toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed')
  );
}

/** Lightweight reachability check used for the system-down screen. */
export async function checkApiHealth() {
  const response = await fetch(`${API_URL}/api/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  return response.json().catch(() => ({ ok: true }));
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

export async function uploadEventSession(code, {
  guestKey,
  title,
  layoutId,
  look,
  previewFile,
  photoFiles = [],
} = {}) {
  const form = new FormData();
  form.append('guestKey', guestKey);
  if (title) form.append('title', title);
  if (layoutId != null) form.append('layoutId', String(layoutId));
  if (look) form.append('look', typeof look === 'string' ? look : JSON.stringify(look));
  if (previewFile) form.append('image', previewFile);
  photoFiles.forEach((file, index) => {
    form.append('photos', file, file.name || `photo-${index}.png`);
  });
  return apiRequest(`/api/public/events/${code}/strips`, { method: 'POST', body: form });
}

export async function patchEventStrip(code, stripId, { guestKey, look, previewFile } = {}) {
  const form = new FormData();
  form.append('guestKey', guestKey);
  if (look) form.append('look', typeof look === 'string' ? look : JSON.stringify(look));
  if (previewFile) form.append('image', previewFile);
  return apiRequest(`/api/public/events/${code}/strips/${stripId}`, { method: 'PATCH', body: form });
}

export async function patchHostStrip(eventId, stripId, { look, previewFile, applyToEvent = false } = {}) {
  const form = new FormData();
  if (look) form.append('look', typeof look === 'string' ? look : JSON.stringify(look));
  if (previewFile) form.append('image', previewFile);
  if (applyToEvent) form.append('applyToEvent', '1');
  return apiRequest(`/api/events/${eventId}/strips/${stripId}`, { method: 'PATCH', body: form });
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

