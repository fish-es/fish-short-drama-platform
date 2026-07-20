import { create } from 'zustand'

export interface Project {
  id: string
  name: string
  createdAt: string
  status: string
  outputPath: string
  aspectRatio: string
  coverImage: string | null
  dramaTitle: string | null
}

export interface Episode {
  id: string
  number: number
  title: string
  summary: string
  status: string
}

export interface Scene {
  id: string
  scriptId: string
  description: string
  dialogue: string
  characters: string[]
  duration: number
  order: number
  state: string
  errorMessage: string | null
  retryCount: number
}

interface AppStore {
  // Projects
  projects: Project[]
  currentProject: Project | null
  // Episodes
  episodes: Episode[]
  scriptId: string | null
  currentEpisodeId: string | null
  // Scenes
  scenes: Scene[]
  // Chat
  messages: Array<{ role: string; content: string }>
  loading: boolean
  progressMsg: string
  genre: string
  episodeCount: number
  // Pipeline
  pipelineStatus: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  pipelineStep: string
  pipelineProgress: number

  // Actions
  setProjects: (projects: Project[]) => void
  setCurrentProject: (project: Project | null) => void
  setEpisodes: (episodes: Episode[], scriptId: string) => void
  setCurrentEpisodeId: (id: string | null) => void
  updateEpisode: (id: string, partial: Partial<Episode>) => void
  setScenes: (scenes: Scene[]) => void
  updateScene: (id: string, partial: Partial<Scene>) => void
  addMessage: (msg: { role: string; content: string }) => void
  setLoading: (loading: boolean) => void
  setProgressMsg: (msg: string) => void
  setGenre: (genre: string) => void
  setEpisodeCount: (count: number) => void
  setPipelineStatus: (status: AppStore['pipelineStatus']) => void
  setPipelineStep: (step: string) => void
  setPipelineProgress: (progress: number) => void
  resetPipeline: () => void
  clearProject: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  projects: [],
  currentProject: null,
  episodes: [],
  scriptId: null,
  currentEpisodeId: null,
  scenes: [],
  messages: [],
  loading: false,
  progressMsg: '',
  genre: 'auto',
  episodeCount: 15,
  pipelineStatus: 'idle',
  pipelineStep: '',
  pipelineProgress: 0,

  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project }),
  setEpisodes: (episodes, scriptId) => set({ episodes, scriptId }),
  setCurrentEpisodeId: (id) => set({ currentEpisodeId: id }),
  updateEpisode: (id, partial) => set(state => ({
    episodes: state.episodes.map(e => e.id === id ? { ...e, ...partial } : e)
  })),
  setScenes: (scenes) => set({ scenes }),
  updateScene: (id, partial) => set(state => ({
    scenes: state.scenes.map(s => s.id === id ? { ...s, ...partial } : s)
  })),
  addMessage: (msg) => set(state => ({ messages: [...state.messages, msg] })),
  setLoading: (loading) => set({ loading }),
  setProgressMsg: (msg) => set({ progressMsg: msg }),
  setGenre: (genre) => set({ genre }),
  setEpisodeCount: (count) => set({ episodeCount: count }),
  setPipelineStatus: (status) => set({ pipelineStatus: status }),
  setPipelineStep: (step) => set({ pipelineStep: step }),
  setPipelineProgress: (progress) => set({ pipelineProgress: progress }),
  resetPipeline: () => set({ pipelineStatus: 'idle', pipelineStep: '', pipelineProgress: 0 }),
  clearProject: () => set({
    currentProject: null, episodes: [], scriptId: null,
    currentEpisodeId: null, scenes: [], messages: [],
    loading: false, progressMsg: '', pipelineStatus: 'idle',
    pipelineStep: '', pipelineProgress: 0
  })
}))
