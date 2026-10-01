import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { LiveAPIState } from '../src/liveapi/live-api-client'
import type { UIMessage } from 'ai'
import type { LogEntry } from '../src/client'

interface AppState {
  // LiveAPI state
  connected: boolean
  muted: boolean
  logs: string[]
  
  // App specific state
  apiKey: string
  code: string
  isGenerating: boolean
  previewComponent: React.ComponentType | null
  uiMessages: UIMessage[]
  history: LogEntry[]
}

export const useStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    // LiveAPI state
    connected: false,
    muted: false,
    logs: [],
    
    // App specific state
    apiKey: localStorage.getItem('google-api-key') || '',
    code: '',
    isGenerating: false,
    previewComponent: null,
    uiMessages: [],
    history: [],
  }))
)

// Subscribe to apiKey changes to sync with localStorage
useStore.subscribe(
  (state) => state.apiKey,
  (apiKey) => {
    localStorage.setItem('google-api-key', apiKey)
  }
)