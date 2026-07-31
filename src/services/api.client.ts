// API client - all requests go through here with the API key from localStorage

function getApiKey(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('agnes_api_key') || ''
}

// Returns all configured keys (for parallel generation). Primary key first.
export function getApiKeys(): string[] {
  if (typeof window === 'undefined') return []
  const multi = localStorage.getItem('agnes_api_keys') || ''
  const keys = multi.split('\n').map(k => k.trim()).filter(Boolean)
  if (keys.length > 0) return keys
  const single = localStorage.getItem('agnes_api_key') || ''
  return single ? [single] : []
}

export function setApiKey(key: string) {
  localStorage.setItem('agnes_api_key', key)
}

// Save multiple keys. First key becomes the primary (used for all /api/* auth).
export function setApiKeys(keys: string[]) {
  const cleaned = keys.map(k => k.trim()).filter(Boolean)
  localStorage.setItem('agnes_api_keys', cleaned.join('\n'))
  localStorage.setItem('agnes_api_key', cleaned[0] || '')
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

// ── Auth session ─────────────────────────────────────────────────────────────

export function getSessionToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('auth_session_token') || ''
}

export function setSessionToken(token: string) {
  localStorage.setItem('auth_session_token', token)
}

export function hasSession(): boolean {
  return !!getSessionToken()
}

export async function logout(): Promise<void> {
  const token = getSessionToken()
  if (token) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'x-session-token': token },
    }).catch(() => {/* best-effort */})
  }
  localStorage.removeItem('auth_session_token')
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function api(url: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': getApiKey(),
    ...(options.headers as Record<string, string> || {})
  }

  const res = await fetch(url, { ...options, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `请求失败: ${res.status}`)
  return data
}

// Projects
export const projectApi = {
  list: () => api('/api/project'),
  listDeleted: () => api('/api/project?deleted=1'),
  create: (name: string, aspectRatio: string, projectType: string = 'drama', targetDuration: number = 0) => api('/api/project', { method: 'POST', body: JSON.stringify({ name, aspectRatio, projectType, targetDuration }) }),
  delete: (id: string, permanent: boolean = false) => api('/api/project', { method: 'DELETE', body: JSON.stringify({ id, permanent }) }),
  restore: (id: string) => api('/api/project/restore', { method: 'POST', body: JSON.stringify({ id }) }),
  rename: (id: string, dramaTitle: string) => api('/api/project', { method: 'PUT', body: JSON.stringify({ id, dramaTitle }) }),
}

// Script / Outline
export const scriptApi = {
  generate: (projectId: string, prompt: string) => api('/api/script', { method: 'POST', body: JSON.stringify({ projectId, prompt }) }),
  getByProject: (projectId: string) => api(`/api/script?projectId=${projectId}`),
  save: (data: any) => api('/api/script/save', { method: 'POST', body: JSON.stringify(data) }),
}

// Episodes
export const episodeApi = {
  list: (scriptId: string) => api(`/api/episode?scriptId=${scriptId}`),
  generate: (episodeId: string, projectId: string) => api('/api/episode', { method: 'POST', body: JSON.stringify({ episodeId, projectId }) }),
  getScenes: (episodeId: string) => api(`/api/scene?episodeId=${episodeId}`),
  getContext: (episodeId: string) => api(`/api/episode/context?episodeId=${episodeId}`),
  saveScenes: (episodeId: string, scriptId: string, scenes: any[]) =>
    api('/api/episode/save', { method: 'POST', body: JSON.stringify({ episodeId, scriptId, scenes }) }),
}

// Scenes
export const sceneApi = {
  generateImage: (sceneId: string) => api('/api/scene', { method: 'POST', body: JSON.stringify({ sceneId, action: 'generateImage' }) }),
  generateVideo: (sceneId: string) => api('/api/video', { method: 'POST', body: JSON.stringify({ sceneId }) }),
  getContext: (sceneId: string) => api(`/api/scene/context?sceneId=${sceneId}`),
  saveImage: (sceneId: string, imageUrl: string, prompt: string, size: string) =>
    api('/api/scene/save', { method: 'POST', body: JSON.stringify({ sceneId, imageUrl, prompt, size }) }),
  getVideoContext: (sceneId: string) => api(`/api/video/context?sceneId=${sceneId}`),
  saveVideo: (sceneId: string, videoUrl: string, videoId: string) =>
    api('/api/video/save', { method: 'POST', body: JSON.stringify({ sceneId, videoUrl, videoId }) }),
  updateText: (sceneId: string, description: string, dialogue: string) =>
    api('/api/scene/manage', { method: 'PUT', body: JSON.stringify({ sceneId, description, dialogue }) }),
  remove: (sceneId: string) => api('/api/scene/manage', { method: 'DELETE', body: JSON.stringify({ sceneId }) }),
  reorder: (orderedIds: string[]) => api('/api/scene/manage', { method: 'POST', body: JSON.stringify({ orderedIds }) }),
}
