import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Wrench, Search, Globe, GitBranch, FileText, Zap, Link2, Clock, Calculator, MessageSquare, Send } from 'lucide-react'
import { agentApi } from '../../../lib/agentApi'
import { useAgentStore } from './store'

// The catalogue itself comes from the backend so the two can't drift; this map
// only supplies presentation for the config keys the backend advertises.
const FIELD_META = {
  api_key: { label: 'API Key', type: 'password' },
  webhook_url: { label: 'Slack Webhook URL', type: 'text' },
  channel: { label: 'Default Channel (e.g. #general)', type: 'text' },
  repo: { label: 'Repository (owner/name)', type: 'text' },
  max_results: { label: 'Max Results', type: 'number' },
  top_k: { label: 'Results to retrieve', type: 'number' },
  timezone_offset_hours: { label: 'UTC offset in hours (e.g. 5.5 for IST)', type: 'number' },
  headers: { label: 'Default headers (JSON)', type: 'text' },
}
const TOOL_ICONS = {
  tavily: Search, google_search: Globe, duckduckgo: Search, github: GitBranch, rag: FileText,
  datetime: Clock, calculator: Calculator, slack: MessageSquare, web_fetch: Globe,
  http_request: Send, custom: Link2,
}
const emptyCustomTool = { name: '', desc: '', api_url: '', method: 'POST', auth_type: 'none', auth_config: {} }

/** `requires` entries are field keys; "a|b" means either one satisfies it. */
function missingRequired(entry, config) {
  return (entry.requires || []).filter(
    (rule) => !rule.split('|').some((key) => String(config[key] ?? '').trim()),
  )
}

export default function ToolManager() {
  const { tools, setTools, addTool, removeTool } = useAgentStore()
  const [catalogue, setCatalogue] = useState([])
  const [builtinType, setBuiltinType] = useState(null)
  const [builtinConfig, setBuiltinConfig] = useState({})
  const [customTool, setCustomTool] = useState(emptyCustomTool)
  const [schemaFields, setSchemaFields] = useState([{ key: '', type: 'string', desc: '' }])
  const [error, setError] = useState('')
  const builtinDialog = useRef(null)
  const customDialog = useRef(null)

  useEffect(() => { agentApi('/tools').then(setTools).catch(() => {}) }, [setTools])
  useEffect(() => { agentApi('/tools/builtin').then(setCatalogue).catch(() => {}) }, [])

  const openBuiltinDialog = () => { setBuiltinType(catalogue[0]?.type || null); setBuiltinConfig({}); setError(''); builtinDialog.current?.showModal() }
  const openCustomDialog = () => { setCustomTool(emptyCustomTool); setSchemaFields([{ key: '', type: 'string', desc: '' }]); setError(''); customDialog.current?.showModal() }

  const selectedBuiltin = catalogue.find((tool) => tool.type === builtinType)
  const addBuiltin = async () => {
    if (!selectedBuiltin) return
    const missing = missingRequired(selectedBuiltin, builtinConfig)
    if (missing.length) {
      setError(`${missing.map((rule) => rule.split('|').map((key) => FIELD_META[key]?.label || key).join(' or ')).join(', ')} required — without it this tool is skipped at run time`)
      return
    }
    try {
      const created = await agentApi('/tools', { method: 'POST', body: JSON.stringify({ name: selectedBuiltin.name, description: selectedBuiltin.description, tool_type: selectedBuiltin.type, is_builtin: true, config: builtinConfig }) })
      addTool({ ...created, custom_schema: null, assigned_agents: [] })
      builtinDialog.current?.close()
    } catch (requestError) { setError(requestError.message) }
  }

  const createCustom = async () => {
    if (!customTool.name || !customTool.api_url) { setError('Name and URL are required'); return }
    try {
      const requestSchema = { type: 'object', properties: {} }
      schemaFields.forEach((field) => { if (field.key) requestSchema.properties[field.key] = { type: field.type || 'string', description: field.desc } })
      const created = await agentApi('/tools', { method: 'POST', body: JSON.stringify({ name: customTool.name, description: customTool.desc, tool_type: 'custom', is_builtin: false, config: {} }) })
      await agentApi(`/tools/${created.id}/schema`, { method: 'POST', body: JSON.stringify({ api_url: customTool.api_url, method: customTool.method, headers: {}, request_body: requestSchema, response_body: {}, path_params: [], query_params: [], auth_type: customTool.auth_type, auth_config: customTool.auth_config }) })
      addTool({ ...created, custom_schema: null, assigned_agents: [] })
      customDialog.current?.close()
    } catch (requestError) { setError(requestError.message) }
  }

  const remove = async (id) => {
    if (!confirm('Delete this tool?')) return
    try { await agentApi(`/tools/${id}`, { method: 'DELETE' }); removeTool(id) } catch (requestError) { setError(requestError.message) }
  }

  return (
    <div className="agent-panel">
      <header className="agent-panel-header agent-panel-header-row">
        <div><h1>Tools</h1><p>Create and manage tools your agents can call</p></div>
        <div className="agent-panel-header-actions">
          <button onClick={openBuiltinDialog}><Zap size={14} /> Built-in</button>
          <button className="agent-primary-button" onClick={openCustomDialog}><Plus size={14} /> Custom Tool</button>
        </div>
      </header>
      <div className="agent-panel-scroll"><div className="agent-panel-content">
        {tools.length === 0 ? <div className="agent-empty"><Wrench size={36} /><p>No tools yet</p></div> : <div className="agent-tool-grid">
          {tools.map((tool) => {
            const Icon = TOOL_ICONS[tool.tool_type] || Wrench
            return <div className="agent-card tool-card" key={tool.id}>
              <div className="agent-list-row-main"><span className="provider-chip"><Icon size={16} /></span><div><h3>{tool.name}</h3><p className="agent-muted">{tool.description || 'No description'}</p></div></div>
              <div className="agent-list-row-actions"><span className={`badge ${tool.is_builtin ? '' : 'outline'}`}>{tool.tool_type}</span><button className="icon-button danger" onClick={() => remove(tool.id)}><Trash2 size={14} /></button></div>
            </div>
          })}
        </div>}
      </div></div>

      <dialog ref={builtinDialog} className="agent-dialog">
        <h2>Add Built-in Tool</h2>
        <div className="agent-dialog-body">
          <div className="agent-builtin-list">
            {catalogue.map((tool) => {
              const Icon = TOOL_ICONS[tool.type] || Wrench
              return (
                <button type="button" key={tool.type} className={`agent-builtin-option ${builtinType === tool.type ? 'active' : ''}`} onClick={() => { setBuiltinType(tool.type); setBuiltinConfig({}); setError('') }}>
                  <span className="provider-chip"><Icon size={16} /></span>
                  <div><p>{tool.name}</p><small>{tool.description}</small></div>
                  {(tool.requires || []).length === 0 && <span className="badge outline">no key</span>}
                </button>
              )
            })}
          </div>
          {selectedBuiltin && selectedBuiltin.config_fields.length > 0 && <div className="agent-builtin-config">
            <h4>Config for {selectedBuiltin.name}</h4>
            {selectedBuiltin.config_fields.map((key) => {
              const meta = FIELD_META[key] || { label: key, type: 'text' }
              const required = (selectedBuiltin.requires || []).some((rule) => rule.split('|').includes(key))
              return (
                <label key={key}>{meta.label}{required ? ' *' : ''}
                  <input type={meta.type} value={builtinConfig[key] || ''} autoComplete="off"
                    onChange={(e) => setBuiltinConfig({ ...builtinConfig, [key]: e.target.value })} />
                </label>
              )
            })}
          </div>}
          {error && <p className="agent-error">{error}</p>}
          <div className="agent-dialog-actions">
            <button type="button" onClick={() => builtinDialog.current?.close()}>Cancel</button>
            <button type="button" className="agent-primary-button" onClick={addBuiltin}>Add Tool</button>
          </div>
        </div>
      </dialog>

      <dialog ref={customDialog} className="agent-dialog wide">
        <h2><Link2 size={17} /> Custom API Tool</h2>
        <div className="agent-dialog-body">
          <div className="agent-dialog-row">
            <label>Name *<input value={customTool.name} onChange={(e) => setCustomTool({ ...customTool, name: e.target.value })} placeholder="get_weather" /></label>
            <label>Method<select value={customTool.method} onChange={(e) => setCustomTool({ ...customTool, method: e.target.value })}>{['GET', 'POST', 'PUT', 'DELETE'].map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
          </div>
          <label>API URL *<input value={customTool.api_url} onChange={(e) => setCustomTool({ ...customTool, api_url: e.target.value })} placeholder="https://api.example.com/v1/data" /></label>
          <label>Description<textarea rows="2" value={customTool.desc} onChange={(e) => setCustomTool({ ...customTool, desc: e.target.value })} /></label>
          <label>Auth Type<select value={customTool.auth_type} onChange={(e) => setCustomTool({ ...customTool, auth_type: e.target.value })}>{['none', 'bearer', 'api_key', 'basic'].map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
          {(customTool.auth_type === 'bearer' || customTool.auth_type === 'api_key') && <label>Token / API Key<input type="password" onChange={(e) => setCustomTool({ ...customTool, auth_config: { ...customTool.auth_config, token: e.target.value, api_key: e.target.value } })} /></label>}
          <hr />
          <div className="agent-schema-head"><span>Request Schema</span><button type="button" onClick={() => setSchemaFields([...schemaFields, { key: '', type: 'string', desc: '' }])}>+ Field</button></div>
          {schemaFields.map((field, index) => (
            <div className="agent-schema-row" key={index}>
              <label>Field<input value={field.key} onChange={(e) => { const next = [...schemaFields]; next[index] = { ...next[index], key: e.target.value }; setSchemaFields(next) }} /></label>
              <label>Type<select value={field.type} onChange={(e) => { const next = [...schemaFields]; next[index] = { ...next[index], type: e.target.value }; setSchemaFields(next) }}>{['string', 'number', 'integer', 'boolean'].map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
              <label>Description<input value={field.desc} onChange={(e) => { const next = [...schemaFields]; next[index] = { ...next[index], desc: e.target.value }; setSchemaFields(next) }} /></label>
              {schemaFields.length > 1 && <button type="button" className="icon-button danger" onClick={() => setSchemaFields(schemaFields.filter((_, j) => j !== index))}><Trash2 size={14} /></button>}
            </div>
          ))}
          {error && <p className="agent-error">{error}</p>}
          <div className="agent-dialog-actions">
            <button type="button" onClick={() => customDialog.current?.close()}>Cancel</button>
            <button type="button" className="agent-primary-button" onClick={createCustom}>Create Custom Tool</button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
