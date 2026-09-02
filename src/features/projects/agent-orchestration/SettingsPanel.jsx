import { useEffect, useState } from 'react'
import { Key, Trash2, Plus, Clock, HardDrive } from 'lucide-react'
import { agentApi } from '../../../lib/agentApi'

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'groq', name: 'Groq' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google_genai', name: 'Google GenAI' },
  { id: 'openrouter', name: 'OpenRouter' },
  { id: 'mistral', name: 'Mistral' },
]
const STAT_LABELS = [{ key: 'agents', label: 'Agents' }, { key: 'tools', label: 'Tools' }, { key: 'connections', label: 'Connections' }, { key: 'rag_documents', label: 'RAG Docs' }, { key: 'executions', label: 'Executions' }]

export default function SettingsPanel() {
  const [configs, setConfigs] = useState([])
  const [stats, setStats] = useState({})
  const [draft, setDraft] = useState({ provider: 'openai', api_key: '', base_url: '' })
  const [error, setError] = useState('')

  const load = () => {
    agentApi('/settings/llm-configs').then(setConfigs).catch(() => {})
    agentApi('/settings/stats').then(setStats).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!draft.api_key) { setError('API key is required'); return }
    try {
      await agentApi('/settings/llm-configs', { method: 'POST', body: JSON.stringify({ ...draft, models: [] }) })
      setDraft({ provider: 'openai', api_key: '', base_url: '' })
      setError('')
      load()
    } catch (requestError) { setError(requestError.message) }
  }
  const remove = async (id) => {
    if (!confirm('Remove this key?')) return
    try { await agentApi(`/settings/llm-configs/${id}`, { method: 'DELETE' }); load() } catch (requestError) { setError(requestError.message) }
  }

  return (
    <div className="agent-panel">
      <header className="agent-panel-header"><h1>Settings</h1><p>Manage LLM API keys</p></header>
      <div className="agent-panel-scroll"><div className="agent-panel-content">
        <section className="agent-card">
          <h2><Key size={16} /> LLM API Keys</h2>
          <p className="agent-muted">Keys are auto-deleted after 48 hours.</p>
          <div className="agent-dialog-row three">
            <label>Provider<select value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })}>{PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label>API Key<input type="password" value={draft.api_key} onChange={(e) => setDraft({ ...draft, api_key: e.target.value })} /></label>
            <label>Base URL (optional)<input value={draft.base_url} onChange={(e) => setDraft({ ...draft, base_url: e.target.value })} /></label>
          </div>
          {error && <p className="agent-error">{error}</p>}
          <button className="agent-primary-button" onClick={save}><Plus size={14} /> Save API Key</button>
          <hr />
          {configs.length === 0 ? <p className="agent-muted center">No keys configured</p> : <div className="agent-list">
            {configs.map((config) => (
              <div className="agent-list-row" key={config.id}>
                <div className="agent-list-row-main"><span className="provider-chip">{config.provider[0].toUpperCase()}</span><div><p>{PROVIDERS.find((p) => p.id === config.provider)?.name || config.provider}</p><small>{config.api_key_masked}</small></div></div>
                <button className="icon-button danger" onClick={() => remove(config.id)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>}
        </section>

        <section className="agent-card">
          <h2><HardDrive size={16} /> Stats</h2>
          <div className="agent-stats-grid">{STAT_LABELS.map((stat) => <div key={stat.key} className="agent-stat-tile"><strong>{stats[stat.key] || 0}</strong><span>{stat.label}</span></div>)}</div>
        </section>

        <section className="agent-card notice">
          <Clock size={18} />
          <div><p>48-Hour Retention</p><small>All data is purged automatically after 48 hours.</small></div>
        </section>
      </div></div>
    </div>
  )
}
