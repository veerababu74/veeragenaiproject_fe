import { create } from 'zustand'

// crypto.randomUUID exists only in secure contexts, so it throws when the app is
// opened over plain http on a LAN address. A new thread must not fail there.
export const newConversationId = () => (globalThis.crypto?.randomUUID
  ? crypto.randomUUID()
  : `c-${Date.now()}-${Math.random().toString(16).slice(2)}`)

export const useSimpleAgentStore = create((set) => ({
  activeTab: 'build',
  setActiveTab: (activeTab) => set({ activeTab }),

  agent: null,
  setAgent: (agent) => set({ agent }),

  providers: [],
  setProviders: (providers) => set({ providers }),

  catalog: [],
  setCatalog: (catalog) => set({ catalog }),

  tools: [],
  attachedCount: 0,
  setTools: (tools, attachedCount) => set({ tools, attachedCount }),

  documents: [],
  quota: { used_bytes: 0, quota_bytes: 5 * 1024 * 1024, remaining_bytes: 5 * 1024 * 1024 },
  setDocuments: (documents, quota) => set({ documents, quota }),

  messages: [],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  // Replaces the last message, so the streaming reply grows in place.
  patchLastMessage: (patch) => set((state) => {
    if (!state.messages.length) return state
    const messages = state.messages.slice()
    messages[messages.length - 1] = { ...messages[messages.length - 1], ...patch }
    return { messages }
  }),
  clearMessages: () => set({ messages: [] }),

  conversationId: newConversationId(),
  setConversationId: (conversationId) => set({ conversationId }),

  // The live trace. Steps arrive one at a time while the run is in flight, and
  // stay on screen afterwards so the finished run can be read back.
  steps: [],
  addStep: (step) => set((state) => ({ steps: [...state.steps, step] })),
  resetSteps: () => set({ steps: [], runResult: null }),

  runResult: null,
  setRunResult: (runResult) => set({ runResult }),

  isRunning: false,
  setIsRunning: (isRunning) => set({ isRunning }),

  banner: null,
  setBanner: (banner) => set({ banner }),
}))
