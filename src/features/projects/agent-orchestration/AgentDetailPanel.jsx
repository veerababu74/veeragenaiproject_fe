import { useEffect, useState } from 'react'
import { X, Save, Trash2, Wrench } from 'lucide-react'
import { agentApi } from '../../../lib/agentApi'
import { useAgentStore } from './store'

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'] },
  { id: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'] },
  { id: 'google_genai', name: 'Google GenAI', models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
  { id: 'openrouter', name: 'OpenRouter', models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4'] },
  { id: 'mistral', name: 'Mistral', models: ['mistral-large-latest', 'codestral-latest'] },
]

export default function AgentDetailPanel() {
  const { selectedAgentId, setSelectedAgentId, agents, updateAgentInStore, removeAgent } = useAgentStore()
  const agent = agents.find((a) => a.id === selectedAgentId)
  const [editForm, setEditForm] = useState(null)
  const [allTools, setAllTools] = useState([])
  const [assignedToolIds, setAssignedToolIds] = useState([])
  const [prevId, setPrevId] = useState(null)
  const [error, setError] = useState('')

  if (agent && agent.id !== prevId) {
    setPrevId(agent.id)
    setEditForm({ ...agent })
    setAssignedToolIds(agent.tools?.map((t) => t.id) || [])
  }
  useEffect(() => { agentApi('/tools').then(setAllTools).catch(() => {}) }, [])
  if (!agent || !editForm) return null

  const models = PROVIDERS.find((p) => p.id === editForm.llm_provider)?.models || []

  const handleSave = async () => {
    try {
      const updated = await agentApi(`/agents/${agent.id}`, { method: 'PUT', body: JSON.stringify(editForm) })
      updateAgentInStore({ ...updated, tools: agent.tools, connections: agent.connections })
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
          <label>Provider<select value={editForm.llm_provider} onChange={(e) => { const provider = e.target.value; setEditForm({ ...editForm, llm_provider: provider, llm_model: PROVIDERS.find((p) => p.id === provider)?.models[0] || '' }) }}>{PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Model<select value={editForm.llm_model} onChange={(e) => setEditForm({ ...editForm, llm_model: e.target.value })}>{models.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
        </div>
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
        {error && <p className="agent-error">{error}</p>}
        <div className="agent-detail-actions">
          <button className="agent-primary-button" onClick={handleSave}><Save size={14} /> Save</button>
          <button className="agent-danger-button" onClick={handleDelete}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  )
}
