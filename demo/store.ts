import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { LiveAPIState } from '../src/liveapi/live-api-client'
import type { UIMessage } from 'ai'
import type { LogEntry } from '../src/client'

export interface PreviewModule {
  url: string
  Component: React.ComponentType
}

/**
 * `shown` is rendered. `fallback` is the last module that rendered without throwing.
 * A module that fails to import or render is replaced by `fallback`, so the user never sees a crash.
 */
export interface Preview {
  shown: PreviewModule | null
  fallback: PreviewModule | null
  /** Last module that failed, shown as a notice above the fallback */
  error: { url: string; message: string } | null
}

interface AppState {
  // LiveAPI state
  connected: boolean
  muted: boolean
  logs: string[]
  
  // App specific state
  apiKey: string
  code: string
  isGenerating: boolean
  preview: Preview
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
    preview: { shown: null, fallback: null, error: null },
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