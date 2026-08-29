const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function getToken() {
  return sessionStorage.getItem('eventpro_token');
}

export function setToken(token) {
  sessionStorage.setItem('eventpro_token', token);
}

export function clearToken() {
  sessionStorage.removeItem('eventpro_token');
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login:          (email, password)   => request('POST', '/auth/login', { email, password }),
  register:       (email, password, name) => request('POST', '/auth/register', { email, password, name }),
  changePassword: (current_password, new_password) =>
                    request('POST', '/auth/change-password', { current_password, new_password }),

  // Events
  getEvents:      (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/events${qs ? '?' + qs : ''}`);
  },
  getEvent:       (id)          => request('GET', `/events/${id}`),
  createEvent:    (data)        => request('POST', '/events', data),
  updateEvent:    (id, data)    => request('PATCH', `/events/${id}`, data),

  // Photos
  getUploadUrl:   (eventId, filename, mime) =>
                    request('POST', `/events/${eventId}/upload-url`, { filename, mime }),
  notifyUploaded: (eventId, photoId, key) =>
                    request('POST', `/events/${eventId}/uploaded`, { photoId, key }),
  getGallery:     (eventId)     => request('GET', `/gallery/${eventId}`),
  getMyPhotos:    ()            => request('GET', '/photos/mine'),
  searchBySelfie: (event_id)   => request('POST', '/search/selfie', { event_id }),
};
