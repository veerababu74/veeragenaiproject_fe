import { useEffect, useState } from 'react'
import { BookOpenCheck, Check, KeyRound, Loader2, Save, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { simpleAgentApi } from '../../../lib/simpleAgentApi'
import { useSimpleAgentStore } from './store'

const BLANK = {
  name: '', description: '', system_prompt: '',
  provider: 'openai', model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 2048, api_key: '',
}

export default function AgentBuilder({ onRefresh }) {
  const { agent, providers, setActiveTab, setBanner } = useSimpleAgentStore()
  const [form, setForm] = useState(BLANK)
  const [examples, setExamples] = useState([])
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    simpleAgentApi('/examples').then((data) => setExamples(data.examples)).catch(() => setExamples([]))
  }, [])

  useEffect(() => {
    if (agent) setForm({ ...BLANK, ...agent, api_key: '' })
  }, [agent])

  const provider = providers.find((item) => item.id === form.provider)

  const save = async () => {
    if (!form.name.trim() || !form.model.trim()) {
      setError('An agent needs a name and a model.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await simpleAgentApi('/agent', { method: 'POST', body: JSON.stringify({ ...form, api_key: form.api_key.trim() }) })
      await onRefresh()
      setBanner({ tone: 'ok', text: `${form.name} saved. Attach tools next, then run it.` })
    } catch (requestError) {
      setError(requestError.message)
    }
    setSaving(false)
  }

  const remove = async () => {
    setError('')
    try {
      await simpleAgentApi('/agent', { method: 'DELETE' })
      setForm(BLANK)
      await onRefresh()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const applyExample = async (example) => {
    setApplying(example.id)
    setError('')
    try {
      const result = await simpleAgentApi(`/examples/${example.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ provider: form.provider, model: form.model, api_key: form.api_key.trim() }),
      })
      await onRefresh()
      const missing = result.needs_setup.map((item) => item.name)
      setBanner({
        tone: 'ok',
        text: `${example.title} loaded with ${result.attached.length} tools.` +
          (missing.length ? ` ${missing.join(' and ')} still need an API key — add them under Tools.` : ''),
      })
      setActiveTab('run')
    } catch (requestError) {
      setError(requestError.message)
    }
    setApplying('')
  }

  return (
    <div className="sa-build">
      <section className="sa-card">
        <header className="sa-card-head">
          <h3><Wand2 size={16} /> Your agent</h3>
          {agent && <button className="sa-danger-link" onClick={remove}><Trash2 size={13} /> Delete</button>}
        </header>

        <div className="sa-field-grid">
          <label className="sa-field">
            <span>Name</span>
            <input value={form.name} maxLength={60} placeholder="Research Analyst"
              onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>

          <label className="sa-field">
            <span>Description</span>
            <input value={form.description} maxLength={400} placeholder="What this agent is for"
              onChange={(event) => setForm({ ...form, description: event.target.value })} />
            <small>Added to the prompt as the agent's role, and shown in the trace.</small>
          </label>

          <label className="sa-field sa-field-wide">
            <span>System message</span>
            <textarea rows={7} value={form.system_prompt} maxLength={8000}
              placeholder="Tell the agent how to work. Being explicit about when to use a tool changes what it does."
              onChange={(event) => setForm({ ...form, system_prompt: event.target.value })} />
            <small>This is the instruction the model receives on every turn. The run trace shows it verbatim.</small>
          </label>

          <label className="sa-field">
            <span>Provider</span>
            <select value={form.provider}
              onChange={(event) => {
                const next = providers.find((item) => item.id === event.target.value)
                setForm({ ...form, provider: event.target.value, model: next?.models?.[0] || form.model })
              }}>
              {providers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>

          <label className="sa-field">
            <span>Model</span>
            <input list="sa-model-options" value={form.model} maxLength={120}
              onChange={(event) => setForm({ ...form, model: event.target.value })} />
            <datalist id="sa-model-options">
              {(provider?.models || []).map((model) => <option key={model} value={model} />)}
            </datalist>
            <small>Type any model your account can reach — the list is only a shortcut.</small>
          </label>

          <label className="sa-field">
            <span>API key {agent?.has_key && <em className="sa-saved"><Check size={11} /> saved</em>}</span>
            <input type="password" value={form.api_key} autoComplete="off"
              placeholder={agent?.has_key ? 'Saved — enter a new key to replace it' : 'Paste your provider key'}
              onChange={(event) => setForm({ ...form, api_key: event.target.value })} />
            <small><KeyRound size={10} /> {provider?.key_hint} Stored for 48 hours, then deleted.</small>
          </label>

          <label className="sa-field">
            <span>Temperature · {form.temperature}</span>
            <input type="range" min={0} max={1} step={0.1} value={form.temperature}
              onChange={(event) => setForm({ ...form, temperature: Number(event.target.value) })} />
            <small>Lower is steadier about picking the right tool.</small>
          </label>
        </div>

        {error && <p className="sa-error">{error}</p>}

        <div className="sa-card-actions">
          <button className="sa-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={14} className="sa-spin" /> : <Save size={14} />}
            {agent ? 'Save changes' : 'Create agent'}
          </button>
          {agent && <button className="sa-secondary" onClick={() => setActiveTab('tools')}>Attach tools</button>}
        </div>
      </section>

      <section className="sa-card">
        <header className="sa-card-head">
          <h3><BookOpenCheck size={16} /> Ready-made examples</h3>
          <span className="sa-muted">Loads a complete agent — prompt, role and tools — then opens the run console.</span>
        </header>

        <div className="sa-example-grid">
          {examples.map((example) => (
            <article className="sa-example" key={example.id}>
              <h4>{example.title}</h4>
              <p className="sa-example-tagline">{example.tagline}</p>
              <div className="sa-example-tools">
                {example.tools.map((tool) => (
                  <span key={tool.tool_type} className={tool.needs_key ? 'needs-key' : ''}>
                    {tool.name}{tool.needs_key ? ' · key' : ''}
                  </span>
                ))}
              </div>
              <details>
                <summary>System message</summary>
                <pre>{example.system_prompt}</pre>
              </details>
              <details>
                <summary>Questions to try</summary>
                <ul>{example.sample_questions.map((question) => <li key={question}>{question}</li>)}</ul>
              </details>
              <button className="sa-secondary" onClick={() => applyExample(example)} disabled={Boolean(applying)}>
                {applying === example.id ? <Loader2 size={13} className="sa-spin" /> : <Sparkles size={13} />}
                Load this example
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
