import { create } from 'zustand'
import { agentApi } from '../../../lib/agentApi'

export const useAgentStore = create((set) => ({
  /* Reloading the graph lives here rather than in the shell component.
   *
   * It used to be a local callback in AgentOrchestration that ran once on
   * mount, which meant anything else changing the graph — loading an example,
   * say — left the canvas showing stale state until the whole project was
   * remounted. That is exactly the "my agents did not appear until I navigated
   * away and back" bug. Any panel can call this now. */
  reloadGraph: async () => {
    const graph = await agentApi('/agents/graph')
    set({
      agents: (graph.agents || []).map((agent) => ({
        ...agent,
        tools: agent.tools || [],
        connections: agent.connections || [],
        is_sub_agent: Boolean(agent.is_sub_agent),
      })),
      connections: (graph.connections || []).map((c) => ({
        ...c, condition: c.condition || c.condition_expr || '',
      })),
    })
    return graph
  },

  activeTab: 'examples', setActiveTab: (tab) => set({ activeTab: tab }),
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
