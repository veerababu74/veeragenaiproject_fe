import { useEffect, useState } from 'react'
import { X, Save, Trash2, Wrench, KeyRound, CheckCircle2, AlertTriangle, Workflow } from 'lucide-react'
import { agentApi } from '../../../lib/agentApi'
import { useAgentStore } from './store'
import { PROVIDERS, loadKeyedProviders, modelsFor } from './providers'

export default function AgentDetailPanel() {
  const { selectedAgentId, setSelectedAgentId, agents, connections, updateAgentInStore, removeAgent } = useAgentStore()
  const agent = agents.find((a) => a.id === selectedAgentId)
  const [editForm, setEditForm] = useState(null)
  const [allTools, setAllTools] = useState([])
  const [assignedToolIds, setAssignedToolIds] = useState([])
  const [keyedProviders, setKeyedProviders] = useState([])
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [prevId, setPrevId] = useState(null)
  const [error, setError] = useState('')

  if (agent && agent.id !== prevId) {
    setPrevId(agent.id)
    setEditForm({ ...agent })
    setAssignedToolIds(agent.tools?.map((t) => t.id) || [])
    setApiKey(''); setSaved(false)
  }
  useEffect(() => { agentApi('/tools').then(setAllTools).catch(() => {}) }, [])
  useEffect(() => { loadKeyedProviders().then(setKeyedProviders) }, [selectedAgentId])
  if (!agent || !editForm) return null

  const models = modelsFor(editForm.llm_provider)
  const providerHasKey = keyedProviders.includes(editForm.llm_provider)
  // Read from the store's connections, not agent.connections: /agents/graph
  // returns plain agent rows, and this stays in sync as edges are drawn.
  // Direction is ignored to match how the backend resolves delegates.
  const delegates = connections
    .filter((c) => c.source_agent_id === agent.id || c.target_agent_id === agent.id)
    .map((c) => ({
      id: c.id,
      label: c.label,
      agent: agents.find((a) => a.id === (c.source_agent_id === agent.id ? c.target_agent_id : c.source_agent_id)),
    }))
    .filter((d) => d.agent && d.agent.id !== agent.id)

  const handleSave = async () => {
    setError(''); setSaved(false)
    if (!editForm.llm_model.trim()) { setError('Model is required'); return }
    try {
      const payload = { ...editForm, llm_model: editForm.llm_model.trim(), api_key: apiKey.trim() || undefined }
      const updated = await agentApi(`/agents/${agent.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      updateAgentInStore({ ...updated, tools: agent.tools, connections: agent.connections })
      if (apiKey.trim()) {
        setKeyedProviders((current) => [...new Set([...current, editForm.llm_provider])])
        setApiKey('')
      }
      setSaved(true)
    } catch (requestError) { setError(requestError.message) }
  }
  const handleDelete = async () => {
    if (!confirm('Delete this agent?')) return
    try { await agentApi(`/agents/${agent.id}`, { method: 'DELETE' }); removeAgent(agent.id); setSelectedAgentId(null) } catch (requestError) { setError(requestError.message) }
  }
  const toggleTool = async (toolId, isAssigned) => {
    try {
      if (isAssigned) {
        await agentApi(`/tools/unassign?agent_id=${agent.id}&tool_id=${toolId}`, { method: 'DELETE' })
        setAssignedToolIds((current) => current.filter((id) => id !== toolId))
      } else {
        await agentApi('/tools/assign', { method: 'POST', body: JSON.stringify({ agent_id: agent.id, tool_id: toolId }) })
        setAssignedToolIds((current) => [...current, toolId])
      }
    } catch (requestError) { setError(requestError.message) }
  }

  return (
    <div className="agent-detail-panel">
      <div className="agent-detail-header"><h2>Agent Config</h2><button onClick={() => setSelectedAgentId(null)}><X size={16} /></button></div>
      <div className="agent-detail-body">
        <label>Name<input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label>
        <label>Description<input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></label>
        <label>System Prompt<textarea rows="5" value={editForm.system_prompt} onChange={(e) => setEditForm({ ...editForm, system_prompt: e.target.value })} /></label>
        <hr />
        <div className="agent-dialog-row">
          <label>Provider<select value={editForm.llm_provider} onChange={(e) => { const provider = e.target.value; setEditForm({ ...editForm, llm_provider: provider, llm_model: modelsFor(provider)[0] || '' }) }}>{PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Model
            <input list={`detail-models-${editForm.llm_provider}`} value={editForm.llm_model} autoComplete="off"
              onChange={(e) => setEditForm({ ...editForm, llm_model: e.target.value })}
              placeholder="e.g. llama-3.3-70b-versatile" />
            <datalist id={`detail-models-${editForm.llm_provider}`}>{models.map((m) => <option key={m} value={m} />)}</datalist>
          </label>
        </div>
        <label>
          <span className="agent-key-label">
            <KeyRound size={12} /> API Key
            {providerHasKey
              ? <span className="agent-key-saved"><CheckCircle2 size={11} /> saved</span>
              : <span className="agent-key-missing"><AlertTriangle size={11} /> none for this provider</span>}
          </span>
          <input type="password" value={apiKey} autoComplete="off" onChange={(e) => setApiKey(e.target.value)}
            placeholder={providerHasKey ? 'Leave blank to keep the saved key' : 'Required — this agent cannot run yet'} />
        </label>
        <div className="agent-dialog-row">
          <label>Temp: {editForm.temperature.toFixed(1)}<input type="range" min="0" max="2" step="0.1" value={editForm.temperature} onChange={(e) => setEditForm({ ...editForm, temperature: parseFloat(e.target.value) })} /></label>
          <label>Max Tokens<input type="number" value={editForm.max_tokens} onChange={(e) => setEditForm({ ...editForm, max_tokens: parseInt(e.target.value) || 4096 })} /></label>
        </div>
        <label className="agent-switch-row"><input type="checkbox" checked={editForm.is_sub_agent} onChange={(e) => setEditForm({ ...editForm, is_sub_agent: e.target.checked })} /> Sub-agent</label>
        <hr />
        <div className="agent-detail-tools">
          <div className="agent-detail-tools-head"><Wrench size={14} /><span>Tools</span></div>
          {allTools.length === 0 ? <p className="agent-muted">No tools yet.</p> : allTools.map((tool) => (
            <div className="agent-tool-row" key={tool.id}>
              <label className="agent-switch-row small"><input type="checkbox" checked={assignedToolIds.includes(tool.id)} onChange={() => toggleTool(tool.id, assignedToolIds.includes(tool.id))} /><div><p>{tool.name}</p><small>{tool.tool_type}</small></div></label>
              <span className={`badge ${assignedToolIds.includes(tool.id) ? '' : 'outline'}`}>{assignedToolIds.includes(tool.id) ? 'Active' : 'Off'}</span>
            </div>
          ))}
        </div>
        <hr />
        <div className="agent-detail-tools">
          <div className="agent-detail-tools-head"><Workflow size={14} /><span>Can consult</span></div>
          {delegates.length === 0
            ? <p className="agent-muted">No outgoing connections. Drag from this node's right edge to another agent to let it ask that agent questions during a run.</p>
            : delegates.map((d) => (
                <div className="agent-tool-row" key={d.id}>
                  <div><p>{d.agent.name}</p><small>{d.label || d.agent.description || `${d.agent.llm_provider}/${d.agent.llm_model}`}</small></div>
                  <span className="badge">delegate</span>
                </div>
              ))}
        </div>
        {error && <p className="agent-error">{error}</p>}
        {saved && <p className="agent-saved-note"><CheckCircle2 size={12} /> Saved</p>}
        <div className="agent-detail-actions">
          <button className="agent-primary-button" onClick={handleSave}><Save size={14} /> Save</button>
          <button className="agent-danger-button" onClick={handleDelete}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  )
}
