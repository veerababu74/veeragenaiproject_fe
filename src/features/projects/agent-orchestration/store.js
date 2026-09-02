import { create } from 'zustand'

export const useAgentStore = create((set) => ({
  activeTab: 'graph', setActiveTab: (tab) => set({ activeTab: tab }),
  agents: [], connections: [], tools: [],
  selectedAgentId: null, setSelectedAgentId: (id) => set({ selectedAgentId: id }),
  setAgents: (agents) => set({ agents }),
  setConnections: (connections) => set({ connections }),
  setTools: (tools) => set({ tools }),
  addAgent: (agent) => set((s) => ({ agents: [...s.agents, agent] })),
  updateAgentInStore: (agent) => set((s) => ({ agents: s.agents.map((a) => (a.id === agent.id ? agent : a)) })),
  removeAgent: (id) => set((s) => ({
    agents: s.agents.filter((a) => a.id !== id),
    connections: s.connections.filter((c) => c.source_agent_id !== id && c.target_agent_id !== id),
    selectedAgentId: s.selectedAgentId === id ? null : s.selectedAgentId,
  })),
  addConnection: (conn) => set((s) => ({ connections: [...s.connections, conn] })),
  updateConnection: (conn) => set((s) => ({ connections: s.connections.map((c) => (c.id === conn.id ? { ...c, ...conn } : c)) })),
  removeConnection: (id) => set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),
  addTool: (tool) => set((s) => ({ tools: [...s.tools, tool] })),
  removeTool: (id) => set((s) => ({ tools: s.tools.filter((t) => t.id !== id) })),
  isChatOpen: false, setIsChatOpen: (open) => set({ isChatOpen: open }),
  chatAgentId: null, setChatAgentId: (id) => set({ chatAgentId: id }),
  chatMessages: [], addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  // Replaces the last message; used to grow the streaming reply in place.
  updateLastChatMessage: (patch) => set((s) => {
    if (s.chatMessages.length === 0) return s
    const messages = s.chatMessages.slice()
    messages[messages.length - 1] = { ...messages[messages.length - 1], ...patch }
    return { chatMessages: messages }
  }),
  clearChatMessages: () => set({ chatMessages: [] }),
  // Identifies the thread the backend replays as memory. A new id starts a
  // fresh thread, which is what clearing the conversation does.
  conversationId: null,
  setConversationId: (id) => set({ conversationId: id }),
  isExecuting: false, setIsExecuting: (executing) => set({ isExecuting: executing }),
}))
