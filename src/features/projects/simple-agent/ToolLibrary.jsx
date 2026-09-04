import { useState } from 'react'
import { Link2, Loader2, Plus, Puzzle, Trash2, Unlink, Wrench, X } from 'lucide-react'
import { simpleAgentApi } from '../../../lib/simpleAgentApi'
import { useSimpleAgentStore } from './store'

const FIELD_LABELS = {
  api_key: 'API key',
  webhook_url: 'Webhook URL',
  channel: 'Default channel',
  repo: 'Repository (owner/name)',
  max_results: 'Max results',
  timezone_offset_hours: 'UTC offset in hours',
  headers: 'Extra headers (JSON)',
  top_k: 'Passages to retrieve',
}

const SECRET_FIELDS = new Set(['api_key', 'webhook_url'])

const BLANK_CUSTOM = {
  name: '', description: '', api_url: '', method: 'GET',
  auth_type: 'none', auth_config: {}, fields: [],
}

function ConfigForm({ entry, onCancel, onAdd, busy }) {
  const [config, setConfig] = useState({})
  return (
    <div className="sa-config-form">
      {entry.config_fields.map((field) => (
        <label key={field}>
          <span>{FIELD_LABELS[field] || field}</span>
          <input
            type={SECRET_FIELDS.has(field) ? 'password' : 'text'}
            autoComplete="off"
            value={config[field] || ''}
            onChange={(event) => setConfig({ ...config, [field]: event.target.value })}
          />
        </label>
      ))}
      <div className="sa-config-actions">
        <button className="sa-primary" onClick={() => onAdd(config)} disabled={busy}>
          {busy ? <Loader2 size={12} className="sa-spin" /> : <Plus size={12} />} Add
        </button>
        <button className="sa-ghost" onClick={onCancel}><X size={12} /> Cancel</button>
      </div>
    </div>
  )
}

export default function ToolLibrary({ onRefresh }) {
  const { agent, catalog, tools, attachedCount, setActiveTab } = useSimpleAgentStore()
  const [openConfig, setOpenConfig] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [custom, setCustom] = useState(BLANK_CUSTOM)

  const maxReached = attachedCount >= 10

  const addBuiltin = async (toolType, config) => {
    setBusy(toolType)
    setError('')
    try {
      await simpleAgentApi('/tools/builtin', { method: 'POST', body: JSON.stringify({ tool_type: toolType, config }) })
      setOpenConfig('')
      await onRefresh()
    } catch (requestError) {
      setError(requestError.message)
    }
    setBusy('')
  }

  const toggleAttach = async (tool) => {
    setBusy(tool.id)
    setError('')
    try {
      await simpleAgentApi(`/tools/${tool.id}/attach`, { method: tool.attached ? 'DELETE' : 'POST' })
      await onRefresh()
    } catch (requestError) {
      setError(requestError.message)
    }
    setBusy('')
  }

  const removeTool = async (tool) => {
    setBusy(tool.id)
    try {
      await simpleAgentApi(`/tools/${tool.id}`, { method: 'DELETE' })
      await onRefresh()
    } catch (requestError) {
      setError(requestError.message)
    }
    setBusy('')
  }

  const saveCustom = async () => {
    setBusy('custom')
    setError('')
    try {
      await simpleAgentApi('/tools/custom', { method: 'POST', body: JSON.stringify(custom) })
      setCustom(BLANK_CUSTOM)
      setCustomOpen(false)
      await onRefresh()
    } catch (requestError) {
      setError(requestError.message)
    }
    setBusy('')
  }

  return (
    <div className="sa-tools">
      <section className="sa-card">
        <header className="sa-card-head">
          <h3><Wrench size={16} /> Tool catalogue</h3>
          <span className={`sa-count ${maxReached ? 'full' : ''}`}>{attachedCount} / 10 attached</span>
        </header>
        {!agent && (
          <p className="sa-notice">
            Create the agent first — tools attach to it.
            <button className="sa-ghost" onClick={() => setActiveTab('build')}>Go to Build</button>
          </p>
        )}
        <div className="sa-catalog-grid">
          {catalog.map((entry) => (
            <article className="sa-catalog-card" key={entry.tool_type}>
              <div className="sa-catalog-top">
                <h4>{entry.name}</h4>
                <span className={`sa-chip ${entry.needs_key ? 'key' : 'free'}`}>
                  {entry.needs_key ? 'needs key' : 'no key'}
                </span>
              </div>
              <p>{entry.description}</p>
              <small>{entry.category}</small>
              {openConfig === entry.tool_type ? (
                <ConfigForm entry={entry} busy={busy === entry.tool_type}
                  onCancel={() => setOpenConfig('')}
                  onAdd={(config) => addBuiltin(entry.tool_type, config)} />
              ) : (
                <button className="sa-secondary"
                  onClick={() => (entry.config_fields.length
                    ? setOpenConfig(entry.tool_type)
                    : addBuiltin(entry.tool_type, {}))}
                  disabled={busy === entry.tool_type}>
                  {busy === entry.tool_type ? <Loader2 size={12} className="sa-spin" /> : <Plus size={12} />}
                  Add to library
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="sa-card">
        <header className="sa-card-head">
          <h3><Puzzle size={16} /> Custom API tool</h3>
          <button className="sa-ghost" onClick={() => setCustomOpen(!customOpen)}>
            {customOpen ? <X size={13} /> : <Plus size={13} />} {customOpen ? 'Close' : 'New custom tool'}
          </button>
        </header>
        <p className="sa-muted">
          Describe any HTTP endpoint once and it becomes a tool the model can call. The fields you list
          become the arguments it fills in; a <code>{'{placeholder}'}</code> in the URL is substituted from them.
        </p>

        {customOpen && (
          <div className="sa-custom-form">
            <div className="sa-field-grid">
              <label className="sa-field">
                <span>Tool name</span>
                <input value={custom.name} onChange={(event) => setCustom({ ...custom, name: event.target.value })}
                  placeholder="Weather lookup" />
              </label>
              <label className="sa-field">
                <span>Method</span>
                <select value={custom.method} onChange={(event) => setCustom({ ...custom, method: event.target.value })}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <option key={method}>{method}</option>)}
                </select>
              </label>
              <label className="sa-field sa-field-wide">
                <span>Description the model reads</span>
                <input value={custom.description} placeholder="Get the current weather for a city"
                  onChange={(event) => setCustom({ ...custom, description: event.target.value })} />
                <small>This is how the model decides whether to call it, so be specific about when to use it.</small>
              </label>
              <label className="sa-field sa-field-wide">
                <span>API URL</span>
                <input value={custom.api_url} placeholder="https://api.example.com/weather/{city}"
                  onChange={(event) => setCustom({ ...custom, api_url: event.target.value })} />
              </label>
              <label className="sa-field">
                <span>Authentication</span>
                <select value={custom.auth_type}
                  onChange={(event) => setCustom({ ...custom, auth_type: event.target.value, auth_config: {} })}>
                  <option value="none">None</option>
                  <option value="bearer">Bearer token</option>
                  <option value="api_key">API key header</option>
                </select>
              </label>
              {custom.auth_type === 'bearer' && (
                <label className="sa-field">
                  <span>Token</span>
                  <input type="password" autoComplete="off"
                    onChange={(event) => setCustom({ ...custom, auth_config: { token: event.target.value } })} />
                </label>
              )}
              {custom.auth_type === 'api_key' && (
                <>
                  <label className="sa-field">
                    <span>Header name</span>
                    <input placeholder="X-API-Key"
                      onChange={(event) => setCustom({
                        ...custom, auth_config: { ...custom.auth_config, header_name: event.target.value } })} />
                  </label>
                  <label className="sa-field">
                    <span>Key</span>
                    <input type="password" autoComplete="off"
                      onChange={(event) => setCustom({
                        ...custom, auth_config: { ...custom.auth_config, api_key: event.target.value } })} />
                  </label>
                </>
              )}
            </div>

            <div className="sa-custom-fields">
              <div className="sa-custom-fields-head">
                <strong>Arguments the model fills in</strong>
                <button className="sa-ghost" onClick={() => setCustom({
                  ...custom,
                  fields: [...custom.fields, { name: '', type: 'string', description: '', required: true }],
                })}><Plus size={12} /> Add argument</button>
              </div>
              {custom.fields.map((field, index) => (
                <div className="sa-custom-field-row" key={index}>
                  <input placeholder="name" value={field.name} onChange={(event) => {
                    const fields = custom.fields.slice()
                    fields[index] = { ...field, name: event.target.value }
                    setCustom({ ...custom, fields })
                  }} />
                  <select value={field.type} onChange={(event) => {
                    const fields = custom.fields.slice()
                    fields[index] = { ...field, type: event.target.value }
                    setCustom({ ...custom, fields })
                  }}>
                    {['string', 'integer', 'number', 'boolean'].map((type) => <option key={type}>{type}</option>)}
                  </select>
                  <input placeholder="what this argument means" value={field.description} onChange={(event) => {
                    const fields = custom.fields.slice()
                    fields[index] = { ...field, description: event.target.value }
                    setCustom({ ...custom, fields })
                  }} />
                  <button className="sa-ghost" onClick={() => setCustom({
                    ...custom, fields: custom.fields.filter((_, position) => position !== index),
                  })}><X size={12} /></button>
                </div>
              ))}
            </div>

            <button className="sa-primary" onClick={saveCustom} disabled={busy === 'custom'}>
              {busy === 'custom' ? <Loader2 size={13} className="sa-spin" /> : <Plus size={13} />} Create tool
            </button>
          </div>
        )}
      </section>

      <section className="sa-card">
        <header className="sa-card-head">
          <h3><Link2 size={16} /> Your tools</h3>
          <span className="sa-muted">Attach up to 10 to the agent. Only attached tools reach the model.</span>
        </header>
        {error && <p className="sa-error">{error}</p>}
        {tools.length === 0 && <p className="sa-muted">Nothing added yet — pick something from the catalogue above.</p>}
        <ul className="sa-tool-rows">
          {tools.map((tool) => (
            <li key={tool.id} className={tool.attached ? 'attached' : ''}>
              <div>
                <strong>{tool.name}</strong>
                <small>{tool.description}</small>
                {tool.api_url && <code>{tool.method} {tool.api_url}</code>}
              </div>
              <div className="sa-tool-row-actions">
                <button
                  className={tool.attached ? 'sa-ghost' : 'sa-secondary'}
                  onClick={() => toggleAttach(tool)}
                  disabled={busy === tool.id || !agent || (!tool.attached && maxReached)}
                  title={!tool.attached && maxReached ? 'Detach a tool first — the limit is 10' : ''}>
                  {busy === tool.id ? <Loader2 size={12} className="sa-spin" />
                    : tool.attached ? <Unlink size={12} /> : <Link2 size={12} />}
                  {tool.attached ? 'Detach' : 'Attach'}
                </button>
                <button className="sa-danger-link" onClick={() => removeTool(tool)} title="Delete this tool">
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
