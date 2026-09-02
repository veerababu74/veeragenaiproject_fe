import { useEffect, useState } from 'react'
import { Key, Trash2, Plus, Clock, HardDrive, History } from 'lucide-react'
import { agentApi } from '../../../lib/agentApi'
import { PROVIDERS } from './providers'
const STAT_LABELS = [{ key: 'agents', label: 'Agents' }, { key: 'tools', label: 'Tools' }, { key: 'connections', label: 'Connections' }, { key: 'rag_documents', label: 'RAG Docs' }, { key: 'executions', label: 'Executions' }]

export default function SettingsPanel() {
  const [configs, setConfigs] = useState([])
  const [stats, setStats] = useState({})
  const [runs, setRuns] = useState([])
  const [draft, setDraft] = useState({ provider: 'openai', api_key: '', base_url: '' })
  const [error, setError] = useState('')

  const load = () => {
    agentApi('/settings/llm-configs').then(setConfigs).catch(() => {})
    agentApi('/settings/stats').then(setStats).catch(() => {})
    agentApi('/execute/history?limit=15').then(setRuns).catch(() => {})
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
      <header className="agent-panel-header"><h1>Provider Keys</h1><p>Keys you have saved, and the runs your agents have made</p></header>
      <div className="agent-panel-scroll"><div className="agent-panel-content">
        <section className="agent-card">
          <h2><Key size={16} /> Saved Keys</h2>
          <p className="agent-muted">One key per provider, shared by every agent using it. You normally add these on the agent itself — this is where you replace or remove one. All keys are deleted after 48 hours.</p>
          {configs.length === 0 ? <p className="agent-muted center">No keys yet — add one when you create an agent</p> : <div className="agent-list">
            {configs.map((config) => (
              <div className="agent-list-row" key={config.id}>
                <div className="agent-list-row-main"><span className="provider-chip">{config.provider[0].toUpperCase()}</span><div><p>{PROVIDERS.find((p) => p.id === config.provider)?.name || config.provider}</p><small>{config.api_key_masked}</small></div></div>
                <button className="icon-button danger" onClick={() => remove(config.id)} title="Remove this key"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>}
          {error && <p className="agent-error">{error}</p>}
          <details className="agent-add-key">
            <summary><Plus size={12} /> Add a key directly</summary>
            <p className="agent-muted">Needed for RAG document search, which embeds with Google GenAI even when none of your agents use it.</p>
            <div className="agent-dialog-row three">
              <label>Provider<select value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })}>{PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label>API Key<input type="password" value={draft.api_key} autoComplete="off" onChange={(e) => setDraft({ ...draft, api_key: e.target.value })} /></label>
              <label>Base URL (optional)<input value={draft.base_url} onChange={(e) => setDraft({ ...draft, base_url: e.target.value })} /></label>
            </div>
            <button className="agent-primary-button" onClick={save}><Plus size={14} /> Save Key</button>
          </details>
        </section>

        <section className="agent-card">
          <h2><HardDrive size={16} /> Stats</h2>
          <div className="agent-stats-grid">{STAT_LABELS.map((stat) => <div key={stat.key} className="agent-stat-tile"><strong>{stats[stat.key] || 0}</strong><span>{stat.label}</span></div>)}</div>
        </section>

        <section className="agent-card">
          <h2><History size={16} /> Recent Runs</h2>
          {runs.length === 0 ? <p className="agent-muted center">No runs yet</p> : <div className="agent-list">
            {runs.map((run) => (
              <div className="agent-list-row" key={run.id}>
                <div className="agent-list-row-main">
                  <div>
                    <p>{run.agent_name || 'Deleted agent'}</p>
                    <small>{run.input_text?.slice(0, 90) || '(no input)'}</small>
                    {run.error_message && <small className="status-error">{run.error_message.slice(0, 120)}</small>}
                  </div>
                </div>
                <div className="agent-list-row-actions">
                  <small className="agent-muted">{run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : ''}</small>
                  <span className={`badge ${run.status === 'error' ? 'destructive' : run.status === 'completed' ? '' : 'outline'}`}>{run.status}</span>
                </div>
              </div>
            ))}
          </div>}
        </section>

        <section className="agent-card notice">
          <Clock size={18} />
          <div><p>48-Hour Retention</p><small>All data is purged automatically after 48 hours.</small></div>
        </section>
      </div></div>
    </div>
  )
}
