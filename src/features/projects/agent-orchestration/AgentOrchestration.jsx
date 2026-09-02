import { useCallback, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { ArrowLeft, Workflow, Wrench, FileText, Settings, Bot, Clock } from 'lucide-react'
import { agentApi } from '../../../lib/agentApi'
import { useAgentStore } from './store'
import AgentGraph from './AgentGraph'
import AgentDetailPanel from './AgentDetailPanel'
import ChatPanel from './ChatPanel'
import ToolManager from './ToolManager'
import RagManager from './RagManager'
import SettingsPanel from './SettingsPanel'
import './AgentOrchestration.css'

const TABS = [
  { id: 'graph', label: 'Agent Graph', icon: Workflow },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'rag', label: 'RAG Docs', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function AgentOrchestration({ onBack }) {
  const { activeTab, setActiveTab, setAgents, setConnections, agents, connections, selectedAgentId } = useAgentStore()

  const loadGraph = useCallback(async () => {
    try {
      const graph = await agentApi('/agents/graph')
      setAgents((graph.agents || []).map((agent) => ({ ...agent, tools: agent.tools || [], connections: agent.connections || [], is_sub_agent: Boolean(agent.is_sub_agent) })))
      setConnections((graph.connections || []).map((c) => ({ ...c, condition: c.condition || c.condition_expr || '' })))
    } catch (requestError) { console.error(requestError) }
  }, [setAgents, setConnections])

  useEffect(() => { loadGraph() }, [loadGraph])

  return (
    <section className="agent-orchestration-app">
      <header className="agent-orchestration-header">
        <button className="icon-button" onClick={onBack} title="Back to projects"><ArrowLeft size={20} /></button>
        <div className="agent-orchestration-brand"><span className="agent-orchestration-icon"><Bot size={16} /></span><div><span>MULTI-AGENT PLATFORM</span><h1>Agent Orchestrator</h1></div></div>
        <div className="agent-orchestration-meta">
          <span className="agent-retention"><Clock size={13} /> Auto-delete in 48h</span>
          <span className="agent-count"><Bot size={13} /> {agents.length} agents</span>
        </div>
      </header>
      <div className="agent-orchestration-body">
        <div className="agent-orchestration-content">
          {activeTab === 'graph' && <ReactFlowProvider><div className="agent-orchestration-graph-row">
            <div className="agent-orchestration-graph-main"><AgentGraph /><ChatPanel /></div>
            {selectedAgentId && <AgentDetailPanel />}
          </div></ReactFlowProvider>}
          {activeTab === 'tools' && <ToolManager />}
          {activeTab === 'rag' && <RagManager />}
          {activeTab === 'settings' && <SettingsPanel />}
        </div>
        <nav className="agent-orchestration-rail">
          {TABS.map((tab) => <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}><tab.icon size={18} /><span>{tab.label}</span></button>)}
        </nav>
      </div>
      <footer className="agent-orchestration-footer">Built with LangChain + LangGraph + FastAPI · All data auto-deleted after 48 hours · {agents.length} agents · {connections.length} connections</footer>
    </section>
  )
}
