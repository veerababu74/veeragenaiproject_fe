import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { ArrowLeft, Workflow, Wrench, FileText, Settings, Bot, Clock, Activity, Sparkles } from 'lucide-react'
import { agentApi } from '../../../lib/agentApi'
import { useAgentStore } from './store'
import AgentGraph from './AgentGraph'
import ExamplesPanel from './ExamplesPanel'
import AgentDetailPanel from './AgentDetailPanel'
import ChatPanel from './ChatPanel'
import ToolManager from './ToolManager'
import RagManager from './RagManager'
import SettingsPanel from './SettingsPanel'
import TracePanel from './TracePanel'
import './AgentOrchestration.css'

const TABS = [
  // First, and the default for an empty workspace: an empty canvas is where
  // most people stop, and a working graph is one click from here.
  { id: 'examples', label: 'Examples', icon: Sparkles },
  { id: 'graph', label: 'Agent Graph', icon: Workflow },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'rag', label: 'RAG Docs', icon: FileText },
  { id: 'traces', label: 'Traces', icon: Activity },
  { id: 'settings', label: 'Keys & Runs', icon: Settings },
]

export default function AgentOrchestration({ onBack }) {
  const { activeTab, setActiveTab, agents, connections, selectedAgentId, reloadGraph } = useAgentStore()

  const loadGraph = useCallback(async () => {
    try { await reloadGraph() } catch (requestError) { console.error(requestError) }
  }, [reloadGraph])

  useEffect(() => { loadGraph() }, [loadGraph])

  // A first-time visitor has nothing to look at on the graph tab, so send them
  // where there is something to press. Done once, and only while the workspace
  // is genuinely empty, so it never fights someone who navigated deliberately.
  const [routed, setRouted] = useState(false)
  useEffect(() => {
    if (routed || agents.length === 0) return
    setRouted(true)
    if (activeTab === 'examples') setActiveTab('graph')
  }, [agents.length, routed, activeTab, setActiveTab])

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
          {activeTab === 'examples' && <ExamplesPanel />}
          {activeTab === 'tools' && <ToolManager />}
          {activeTab === 'rag' && <RagManager />}
          {activeTab === 'traces' && <TracePanel />}
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
