import { useCallback, useEffect, useRef, useState } from 'react'
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, Handle, Position, MarkerType, BackgroundVariant } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Bot, Trash2, Play, Workflow, KeyRound, CheckCircle2 } from 'lucide-react'
import { agentApi } from '../../../lib/agentApi'
import { useAgentStore } from './store'
import { PROVIDERS, PROVIDER_DOT, loadKeyedProviders, modelsFor } from './providers'

function AgentNode({ data, id }) {
  const { selectedAgentId, setSelectedAgentId, removeAgent, setIsChatOpen, setChatAgentId } = useAgentStore()
  return (
    <div className={`agent-node ${selectedAgentId === id ? 'selected' : ''}`} onClick={(event) => { event.stopPropagation(); setSelectedAgentId(id) }}>
      <Handle type="target" position={Position.Left} className="agent-node-handle" />
      <div className={`agent-node-strip ${PROVIDER_DOT[data.llm_provider] || ''}`} />
      <div className="agent-node-body">
        <div className="agent-node-top">
          <div className="agent-node-identity">
            <span className={`agent-node-icon ${data.is_sub_agent ? 'sub' : ''}`}>{data.is_sub_agent ? <Workflow size={15} /> : <Bot size={15} />}</span>
            <div><h3>{data.name}</h3><p>{data.llm_provider}/{data.llm_model}</p></div>
          </div>
          <div className="agent-node-actions">
            <button title="Chat with this agent" onClick={(event) => { event.stopPropagation(); setChatAgentId(id); setIsChatOpen(true) }}><Play size={13} /></button>
            <button className="danger" title="Delete agent" onClick={(event) => { event.stopPropagation(); removeAgent(id) }}><Trash2 size={13} /></button>
          </div>
        </div>
        {data.description && <p className="agent-node-desc">{data.description}</p>}
        {data.tools?.length > 0 && <div className="agent-node-tools">
          {data.tools.slice(0, 3).map((tool) => <span key={tool.id} className="badge">{tool.name}</span>)}
          {data.tools.length > 3 && <span className="badge outline">+{data.tools.length - 3}</span>}
        </div>}
      </div>
      <Handle type="source" position={Position.Right} className="agent-node-handle" />
    </div>
  )
}

const nodeTypes = { agentNode: AgentNode }
const emptyAgent = { name: '', description: '', system_prompt: '', llm_provider: 'openai', llm_model: 'gpt-4o', temperature: 0.7, max_tokens: 4096, is_sub_agent: false, api_key: '' }

export default function AgentGraph() {
  const { agents, connections, addAgent, addConnection, setSelectedAgentId } = useAgentStore()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [draft, setDraft] = useState(emptyAgent)
  const [keyedProviders, setKeyedProviders] = useState([])
  const [error, setError] = useState('')
  const dialogRef = useRef(null)
  const providerHasKey = keyedProviders.includes(draft.llm_provider)

  useEffect(() => {
    setNodes(agents.map((agent) => ({ id: agent.id, type: 'agentNode', position: { x: agent.position_x, y: agent.position_y }, data: { ...agent } })))
    setEdges(connections.map((c) => ({
      id: c.id, source: c.source_agent_id, target: c.target_agent_id, label: c.label || '', type: 'smoothstep', animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 }, style: { stroke: '#9aa5c9', strokeWidth: 2 },
    })))
  }, [agents, connections, setNodes, setEdges])

  const openDialog = () => {
    setDraft(emptyAgent); setError(''); dialogRef.current?.showModal()
    loadKeyedProviders().then(setKeyedProviders)
  }
  const closeDialog = () => dialogRef.current?.close()

  const onConnect = useCallback(async (connection) => {
    if (!connection.source || !connection.target) return
    try {
      const created = await agentApi('/agents/connections', { method: 'POST', body: JSON.stringify({ source_agent_id: connection.source, target_agent_id: connection.target }) })
      addConnection({ ...created, condition: created.condition || created.condition_expr || '' })
    } catch (requestError) { setError(requestError.message) }
  }, [addConnection])

  const onNodeDragStop = useCallback(async (_event, node) => {
    try { await agentApi(`/agents/${node.id}`, { method: 'PUT', body: JSON.stringify({ position_x: node.position.x, position_y: node.position.y }) }) } catch { /* position sync is best-effort */ }
  }, [])

  const handleCreate = async () => {
    if (!draft.name.trim()) { setError('Name is required'); return }
    if (!providerHasKey && !draft.api_key.trim()) { setError(`Enter an API key for ${PROVIDERS.find((p) => p.id === draft.llm_provider)?.name || draft.llm_provider} — this agent cannot run without one`); return }
    try {
      const created = await agentApi('/agents', { method: 'POST', body: JSON.stringify({ ...draft, api_key: draft.api_key.trim() || undefined, position_x: 100 + Math.random() * 400, position_y: 100 + Math.random() * 300 }) })
      addAgent({ ...created, tools: [], connections: [] })
      if (draft.api_key.trim()) setKeyedProviders((current) => [...new Set([...current, draft.llm_provider])])
      closeDialog()
    } catch (requestError) { setError(requestError.message) }
  }

  const models = modelsFor(draft.llm_provider)

  return (
    <div className="agent-graph">
      <div className="agent-graph-toolbar">
        <button className="agent-primary-button" onClick={openDialog}><Bot size={15} /> New Agent</button>
        {agents.length === 0 && <div className="agent-graph-hint">Click <strong>New Agent</strong> to start. Drag from a node's edge to connect agents.</div>}
      </div>
      <div className="agent-graph-count">{agents.length} agents · {connections.length} connections</div>
      <ReactFlow
        nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={onConnect} onNodeDragStop={onNodeDragStop} onPaneClick={() => setSelectedAgentId(null)}
        nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.3 }} deleteKeyCode={null} className="agent-graph-canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d7ddf2" />
        <Controls />
        <MiniMap nodeColor="#2e4cf5" maskColor="rgba(26,26,46,0.06)" />
      </ReactFlow>

      <dialog ref={dialogRef} className="agent-dialog" onCancel={closeDialog}>
        <h2><Bot size={18} /> Create Agent</h2>
        <div className="agent-dialog-body">
          <label>Name *<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Research Agent" /></label>
          <label>Description<input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What does this agent do?" /></label>
          <label>System Prompt<textarea rows="4" value={draft.system_prompt} onChange={(e) => setDraft({ ...draft, system_prompt: e.target.value })} placeholder="You are a helpful AI assistant..." /></label>
          <div className="agent-dialog-row">
            <label>LLM Provider<select value={draft.llm_provider} onChange={(e) => { const provider = e.target.value; setDraft({ ...draft, llm_provider: provider, llm_model: modelsFor(provider)[0] || '' }) }}>{PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label>Model<select value={draft.llm_model} onChange={(e) => setDraft({ ...draft, llm_model: e.target.value })}>{models.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
          </div>
          <label>
            <span className="agent-key-label">
              <KeyRound size={12} /> API Key {providerHasKey ? '' : '*'}
              {providerHasKey && <span className="agent-key-saved"><CheckCircle2 size={11} /> saved for this provider</span>}
            </span>
            <input type="password" value={draft.api_key} autoComplete="off"
              onChange={(e) => setDraft({ ...draft, api_key: e.target.value })}
              placeholder={providerHasKey ? 'Leave blank to reuse the saved key' : 'Required — paste your provider key'} />
            <small className="agent-key-hint">Stored against the provider and shared by every agent using it. Deleted automatically after 48 hours.</small>
          </label>
          <div className="agent-dialog-row">
            <label>Temperature: {draft.temperature.toFixed(1)}<input type="range" min="0" max="2" step="0.1" value={draft.temperature} onChange={(e) => setDraft({ ...draft, temperature: parseFloat(e.target.value) })} /></label>
            <label>Max Tokens<input type="number" value={draft.max_tokens} onChange={(e) => setDraft({ ...draft, max_tokens: parseInt(e.target.value) || 4096 })} /></label>
          </div>
          <label className="agent-switch-row"><input type="checkbox" checked={draft.is_sub_agent} onChange={(e) => setDraft({ ...draft, is_sub_agent: e.target.checked })} /> Sub-agent mode</label>
          {error && <p className="agent-error">{error}</p>}
          <div className="agent-dialog-actions">
            <button type="button" onClick={closeDialog}>Cancel</button>
            <button type="button" className="agent-primary-button" onClick={handleCreate}><Bot size={15} /> Create Agent</button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
