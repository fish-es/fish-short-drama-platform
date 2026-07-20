// API client - all requests go through here with the API key from localStorage

function getApiKey(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('agnes_api_key') || ''
}

export function setApiKey(key: string) {
  localStorage.setItem('agnes_api_key', key)
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

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
  create: (name: string, aspectRatio: string) => api('/api/project', { method: 'POST', body: JSON.stringify({ name, aspectRatio }) }),
  delete: (id: string) => api('/api/project', { method: 'DELETE', body: JSON.stringify({ id }) }),
}

// Script / Outline
export const scriptApi = {
  generate: (projectId: string, prompt: string) => api('/api/script', { method: 'POST', body: JSON.stringify({ projectId, prompt }) }),
  getByProject: (projectId: string) => api(`/api/script?projectId=${projectId}`),
}

// Episodes
export const episodeApi = {
  list: (scriptId: string) => api(`/api/episode?scriptId=${scriptId}`),
  generate: (episodeId: string, projectId: string) => api('/api/episode', { method: 'POST', body: JSON.stringify({ episodeId, projectId }) }),
  getScenes: (episodeId: string) => api(`/api/scene?episodeId=${episodeId}`),
}

// Scenes
export const sceneApi = {
  generateImage: (sceneId: string) => api('/api/scene', { method: 'POST', body: JSON.stringify({ sceneId, action: 'generateImage' }) }),
  generateVideo: (sceneId: string) => api('/api/video', { method: 'POST', body: JSON.stringify({ sceneId }) }),
}
