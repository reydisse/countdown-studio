// Shared fetch-based implementation used by both adapters.
// VITE_API_URL points to the CF Worker in production (set in .env.production).
// Falls back to root-relative paths for local Express dev.
const SERVER_URL = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_SERVER_URL)) || '';

export const getServerUrl = () => SERVER_URL || `${location.protocol}//${location.host}`;
export const getWsUrl = () => {
  const api = SERVER_URL
  if (!api) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${location.host}`
  }
  return api.replace('https://', 'wss://').replace('http://', 'ws://')
};

async function request(path, options = {}) {
  const { body, headers = {}, ...rest } = options;
  const isFormData = body instanceof FormData;

  const res = await fetch(`${SERVER_URL}${path}`, {
    headers: isFormData ? headers : { 'Content-Type': 'application/json', ...headers },
    body: body && !isFormData ? JSON.stringify(body) : body,
    ...rest,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const err = new Error(payload.error ?? res.statusText);
    err.status = res.status;
    throw err;
  }

  return res.status === 204 ? null : res.json();
}

// Projects
export const getProjects = () => request('/api/projects');
export const getProject  = (id) => request(`/api/projects/${id}`);
export const saveProject  = (data) =>
  data.id
    ? request(`/api/projects/${data.id}`, { method: 'PATCH', body: data })
    : request('/api/projects',            { method: 'POST',  body: data });
export const deleteProject = (id) => request(`/api/projects/${id}`, { method: 'DELETE' });

// Assets
export const getAssets   = (type) =>
  request(`/api/assets${type ? `?type=${encodeURIComponent(type)}` : ''}`);
export const deleteAsset = (id) => request(`/api/assets/${id}`, { method: 'DELETE' });

export async function uploadAsset(file) {
  const formData = new FormData();
  formData.append('file', file);
  return request('/api/assets', { method: 'POST', body: formData });
}

// Cues
export const getCues    = (projectId) =>
  request(`/api/projects/${projectId}/cues`);
export const createCue  = (projectId, data) =>
  request(`/api/projects/${projectId}/cues`, { method: 'POST',   body: data });
export const updateCue  = (projectId, cueId, data) =>
  request(`/api/projects/${projectId}/cues/${cueId}`, { method: 'PUT',    body: data });
export const deleteCue  = (projectId, cueId) =>
  request(`/api/projects/${projectId}/cues/${cueId}`, { method: 'DELETE' });

// Rooms
export const createRoom = (data) => request('/api/rooms', { method: 'POST', body: data });
export const getRoom    = (code) => request(`/api/rooms/${code}`);

// Room-scoped assets
export const getRoomAssets  = (code, type) =>
  request(`/api/rooms/${code}/assets${type ? `?type=${encodeURIComponent(type)}` : ''}`);
export const deleteRoomAsset = (code, id) =>
  request(`/api/rooms/${code}/assets/${id}`, { method: 'DELETE' });
export async function uploadRoomAsset(code, file) {
  const formData = new FormData();
  formData.append('file', file);
  return request(`/api/rooms/${code}/assets`, { method: 'POST', body: formData });
}

// Room-scoped cues
export const getRoomCues   = (code) =>
  request(`/api/rooms/${code}/cues`);
export const createRoomCue = (code, data) =>
  request(`/api/rooms/${code}/cues`, { method: 'POST', body: data });
export const updateRoomCue = (code, cueId, data) =>
  request(`/api/rooms/${code}/cues/${cueId}`, { method: 'PUT', body: data });
export const deleteRoomCue = (code, cueId) =>
  request(`/api/rooms/${code}/cues/${cueId}`, { method: 'DELETE' });

// Room settings persistence
export const saveRoomSettings = (code, settings) =>
  request(`/api/rooms/${code}`, { method: 'PATCH', body: { settings } });
