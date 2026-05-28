const api = window.__ELECTRON_API__

let _config = null
async function getConfig() {
  if (!_config) _config = await api.getConfig()
  return _config
}

async function apiUrl() { return (await getConfig()).apiUrl }

async function request(path, options = {}) {
  const base = await apiUrl()
  const { body, headers = {}, ...rest } = options
  const isFormData = body instanceof FormData
  const res = await fetch(`${base}${path}`, {
    headers: isFormData ? headers : { 'Content-Type': 'application/json', ...headers },
    body: body && !isFormData ? JSON.stringify(body) : body,
    ...rest,
  })
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    const err = new Error(payload.error ?? res.statusText)
    err.status = res.status
    throw err
  }
  return res.status === 204 ? null : res.json()
}

export const getServerUrl = async () => (await getConfig()).apiUrl
export const getWsUrl     = async () => (await getConfig()).wsUrl

export const createRoom = (data) => request('/api/rooms', { method: 'POST', body: data })
export const getRoom    = (code) => request(`/api/rooms/${code}`)

export const getProjects    = ()     => request('/api/rooms?type=countdown')
export const getProject     = (code) => request(`/api/rooms/${code}`)
export const saveProject    = (data) => request(`/api/rooms/${data.code}/settings`, { method: 'PUT', body: { settings: data.settings } })
export const deleteProject  = (code) => request(`/api/rooms/${code}`, { method: 'DELETE' })

export const getRoomAssets   = (code, type) => request(`/api/rooms/${code}/assets${type ? `?type=${type}` : ''}`)
export const deleteRoomAsset = (code, id)   => request(`/api/rooms/${code}/assets/${id}`, { method: 'DELETE' })

export async function uploadRoomAsset(code, filePathOrFile) {
  const base = await apiUrl()
  let file
  if (typeof filePathOrFile === 'string') {
    const { data, mimeType, name, error } = await api.readFileBase64(filePathOrFile)
    if (error) throw new Error(error)
    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
    file = new File([bytes], name, { type: mimeType })
  } else {
    file = filePathOrFile
  }
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${base}/api/rooms/${code}/assets`, { method: 'POST', body: form })
  return res.json()
}

export const getRoomCues      = (code)             => request(`/api/rooms/${code}/cues`)
export const createRoomCue    = (code, data)        => request(`/api/rooms/${code}/cues`, { method: 'POST', body: data })
export const updateRoomCue    = (code, cueId, data) => request(`/api/rooms/${code}/cues/${cueId}`, { method: 'PUT', body: data })
export const deleteRoomCue    = (code, cueId)       => request(`/api/rooms/${code}/cues/${cueId}`, { method: 'DELETE' })
export const saveRoomSettings = (code, settings)    => request(`/api/rooms/${code}/settings`, { method: 'PUT', body: { settings } })

export const openFilePicker         = (opts) => api.openFilePicker(opts)
export const openOutputWindow       = (rc)   => api.openOutputWindow(rc)
export const openTeleprompterReader = (rc)   => api.openTeleprompterReader(rc)
