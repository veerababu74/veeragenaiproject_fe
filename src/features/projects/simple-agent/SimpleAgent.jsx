import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, Bot, Clock3, FileText, History, MessageSquare, Wand2, Wrench, X,
} from 'lucide-react'
import { simpleAgentApi } from '../../../lib/simpleAgentApi'
import AgentBuilder from './AgentBuilder'
import DocumentsPanel from './DocumentsPanel'
import RunConsole from './RunConsole'
import RunsHistory from './RunsHistory'
import ToolLibrary from './ToolLibrary'
import { useSimpleAgentStore } from './store'
import './SimpleAgent.css'

const TABS = [
  { id: 'build', label: 'Build', icon: Wand2 },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'run', label: 'Run', icon: MessageSquare },
  { id: 'history', label: 'History', icon: History },
]

export default function SimpleAgent({ onBack }) {
  const {
    activeTab, setActiveTab, agent, setAgent, setProviders, setCatalog,
    setTools, setDocuments, banner, setBanner, attachedCount,
  } = useSimpleAgentStore()
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [agentData, toolData, documentData] = await Promise.all([
        simpleAgentApi('/agent'),
        simpleAgentApi('/tools'),
        simpleAgentApi('/documents'),
      ])
      setAgent(agentData)
      setTools(toolData.tools, toolData.attached_count)
      setDocuments(documentData.documents, {
        used_bytes: documentData.used_bytes,
        quota_bytes: documentData.quota_bytes,
        remaining_bytes: documentData.remaining_bytes,
      })
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [setAgent, setTools, setDocuments])

  useEffect(() => {
    Promise.all([simpleAgentApi('/providers'), simpleAgentApi('/tools/catalog')])
      .then(([providerData, catalogData]) => {
        setProviders(providerData.providers)
        setCatalog(catalogData.tools)
      })
      .catch((requestError) => setError(requestError.message))
    refresh()
  }, [refresh, setProviders, setCatalog])

  return (
    <section className="simple-agent-app">
      <header className="sa-header">
        <button className="sa-back" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <div className="sa-brand">
          <span className="sa-brand-icon"><Bot size={17} /></span>
          <div>
            <span>TOOL-CALLING, IN THE OPEN</span>
            <h1>SimpleAgent</h1>
          </div>
        </div>
        <div className="sa-header-meta">
          {agent && <span className="sa-pill">{agent.provider}/{agent.model}</span>}
          <span className="sa-pill">{attachedCount}/10 tools</span>
          <span className="sa-pill ghost"><Clock3 size={12} /> 48h retention</span>
        </div>
      </header>

      <nav className="sa-tabs">
        {TABS.map((tab) => (
          <button key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </nav>

      {(banner || error) && (
        <div className={`sa-banner ${error ? 'error' : banner?.tone}`}>
          <p>{error || banner.text}</p>
          <button onClick={() => { setBanner(null); setError('') }} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      <div className="sa-body">
        {activeTab === 'build' && <AgentBuilder onRefresh={refresh} />}
        {activeTab === 'tools' && <ToolLibrary onRefresh={refresh} />}
        {activeTab === 'documents' && <DocumentsPanel onRefresh={refresh} />}
        {activeTab === 'run' && <RunConsole />}
        {activeTab === 'history' && <RunsHistory />}
      </div>

      <footer className="sa-footer">
        One agent · up to 10 tools · LangGraph think-act loop · every decision traced ·
        all data deleted after 48 hours
      </footer>
    </section>
  )
}
