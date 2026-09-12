import { useEffect, useState } from 'react'
import {
  ArrowRight, Check, KeyRound, Layers, Loader2, Play, Sparkles, Trash2, Users, Wrench,
} from 'lucide-react'
import { agentApi } from '../../../lib/agentApi'
import GraphShape from './GraphShape'
import { PROVIDERS } from './providers'
import { useAgentStore } from './store'

/* Start from a working graph instead of an empty canvas.
 *
 * Building one by hand is four agents, four system prompts, the connections
 * between them, an orchestration mode and any tools — twenty-odd interactions
 * before the first run. That is a lot to ask of someone who has not yet seen
 * what this project does, and the empty canvas is where most people stop.
 *
 * There is one example per orchestration mode on purpose, because the four
 * modes are the whole idea here and the difference between them is invisible in
 * a description: supervisor, sequential, parallel and conditional produce
 * genuinely different traces from the same question. Loading two and comparing
 * their traces is the fastest way to understand why the setting exists, so the
 * mode is the most prominent thing on every card.
 */

const MODE_COPY = {
  supervisor: { label: 'Supervisor', hint: 'the lead decides who to ask, and when' },
  sequential: { label: 'Sequential', hint: 'everyone runs, in a fixed order' },
  parallel: { label: 'Parallel', hint: 'everyone runs at once, then it reconciles' },
  conditional: { label: 'Conditional', hint: 'routes on written, auditable conditions' },
}

export default function ExamplesPanel() {
  const { setActiveTab, agents, reloadGraph } = useAgentStore()
  const [catalogue, setCatalogue] = useState(null)
  const [expanded, setExpanded] = useState('')
  const [provider, setProvider] = useState('openai')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [savedProviders, setSavedProviders] = useState([])
  const [replace, setReplace] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [loadingId, setLoadingId] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    agentApi('/examples').then(setCatalogue).catch((requestError) => {
      // The frontend can ship ahead of the backend — this panel went live in the
      // same release as the endpoint it calls, and the two deploy separately. A
      // 404 here is that skew, not a fault the reader can do anything about, so
      // say which half is behind instead of showing them a raw error string.
      if (/404|not found/i.test(requestError.message)) setUnsupported(true)
      else setError(requestError.message)
    })
    agentApi('/settings/llm-configs')
      .then((rows) => setSavedProviders(rows.map((row) => row.provider)))
      .catch(() => {})
  }, [])

  const hasKey = savedProviders.includes(provider)
  const models = PROVIDERS.find((item) => item.id === provider)?.models || []

  const load = async (example) => {
    setLoadingId(example.id)
    setError('')
    setResult(null)
    try {
      const response = await agentApi(`/examples/${example.id}/load`, {
        method: 'POST',
        body: JSON.stringify({ provider, model: model.trim(), api_key: apiKey.trim(), replace }),
      })
      setResult(response)
      if (apiKey.trim() && !savedProviders.includes(provider)) {
        setSavedProviders((current) => [...current, provider])
      }
      setApiKey('')
      // Without this the canvas keeps showing whatever it had before, and the
      // agents only appear after the project is remounted.
      await reloadGraph()
    } catch (requestError) {
      setError(requestError.message)
    }
    setLoadingId('')
  }

  if (unsupported) {
    return (
      <div className="agent-panel">
        <header className="agent-panel-header">
          <h1>Examples</h1>
          <p>Ready-made graphs, once this workspace's backend has them</p>
        </header>
        <div className="agent-panel-scroll"><div className="agent-panel-content">
          <div className="ao-example-key">
            <strong>The backend here does not serve examples yet.</strong>
            <p className="agent-muted" style={{ marginTop: 8, lineHeight: 1.65 }}>
              This panel and the endpoint it calls shipped together, but the frontend and the API
              deploy separately — so the API is simply a release behind. Nothing is broken and
              nothing you built is affected; everything else in the project works normally.
              Redeploy the orchestration backend and the examples appear here.
            </p>
            <button className="agent-primary-button" style={{ marginTop: 12 }}
                    onClick={() => setActiveTab('graph')}>
              Build a graph by hand instead <ArrowRight size={15} />
            </button>
          </div>
        </div></div>
      </div>
    )
  }
  const clearWorkspace = async () => {
    setClearing(true)
    setError('')
    try {
      await agentApi('/examples/clear', { method: 'POST' })
      await reloadGraph()
      setResult(null)
    } catch (requestError) {
      setError(requestError.message)
    }
    setClearing(false)
  }

  if (error && !catalogue) {
    return <div className="agent-panel"><div className="agent-panel-content"><p className="agent-error">{error}</p></div></div>
  }
  if (!catalogue) {
    return (
      <div className="agent-panel">
        <div className="agent-panel-content">
          <p className="agent-muted"><Loader2 size={14} className="agent-spin" /> Loading examples…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="agent-panel">
      <header className="agent-panel-header">
        <h1>Start from a working graph</h1>
        <p>Complete multi-agent setups, already wired. Pick one, add your key, press run.</p>
      </header>
      <div className="agent-panel-scroll"><div className="agent-panel-content ao-examples">

      {/* The key, once, for whichever example gets loaded. */}
      <div className="ao-example-key">
        <div className="ao-key-row">
          <label>
            <span>Provider</span>
            <select value={provider} onChange={(event) => { setProvider(event.target.value); setModel('') }}>
              {PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Model</span>
            <input list="ao-models" value={model} placeholder={models[0] || 'default'}
                   onChange={(event) => setModel(event.target.value)} />
            <datalist id="ao-models">
              {models.map((item) => <option key={item} value={item} />)}
            </datalist>
          </label>
          <label>
            <span>API key {hasKey && <em className="ao-key-saved"><Check size={11} /> saved</em>}</span>
            <input type="password" autoComplete="off" value={apiKey}
                   placeholder={hasKey ? 'already saved — leave blank' : 'paste your key'}
                   onChange={(event) => setApiKey(event.target.value)} />
          </label>
        </div>
        <div className="ao-key-foot">
          <label className="ao-replace">
            <input type="checkbox" checked={replace}
                   onChange={(event) => setReplace(event.target.checked)} />
            <span>
              Replace what is already there
              <em>
                {replace
                  ? 'loading an example clears the workspace first — one at a time'
                  : 'careful: the new example will be merged into the existing graph'}
              </em>
            </span>
          </label>
          {!hasKey && !apiKey.trim() && (
            <span className="ao-key-warn">
              <KeyRound size={12} /> Loads without a key — it just will not run until one is saved
            </span>
          )}
        </div>
      </div>

      {agents.length > 0 && (
        <div className="ao-workspace-state">
          <span className="ao-workspace-count">{agents.length}</span>
          <div>
            <strong>You already have agents loaded</strong>
            <p>
              {replace
                ? 'Loading another example will clear these first.'
                : 'Loading another example will add to these, leaving two graphs side by side.'}
            </p>
          </div>
          <button className="ao-ghost-button" onClick={clearWorkspace} disabled={clearing}>
            {clearing
              ? <><Loader2 size={13} className="agent-spin" /> Clearing…</>
              : <><Trash2 size={13} /> Clear workspace</>}
          </button>
        </div>
      )}

      {result && (
        <div className="ao-example-result">
          <div>
            <strong>{result.title} loaded</strong>
            <p>{result.note}</p>
            <p className="ao-look-for"><Sparkles size={12} /> {result.look_for}</p>
            <span className="agent-muted">Try: “{result.sample_tasks[0]}”</span>
          </div>
          <button className="agent-primary-button" onClick={() => setActiveTab('graph')}>
            Open the graph <ArrowRight size={15} />
          </button>
        </div>
      )}

      {error && <p className="agent-error">{error}</p>}

      <div className="ao-example-grid">
        {catalogue.examples.map((example) => {
          const mode = MODE_COPY[example.mode] || { label: example.mode, hint: '' }
          const open = expanded === example.id
          return (
            <article className={`ao-example ao-example-${example.mode} ${open ? 'open' : ''}`}
                     key={example.id}>
              <div className="ao-example-banner">
                <GraphShape mode={example.mode} workers={example.agents.length - 1} />
                <div>
                  <span className={`ao-mode ao-mode-${example.mode}`}>{mode.label}</span>
                  <p className="ao-mode-hint">{mode.hint}</p>
                </div>
              </div>

              <h3>{example.title}</h3>
              <p className="ao-example-tagline">{example.tagline}</p>

              <div className="ao-example-roster">
                {example.agents.map((agent) => (
                  <span key={agent.name} className={agent.is_lead ? 'lead' : ''}>{agent.name}</span>
                ))}
              </div>

              <div className="ao-example-agents">
                <span className="ao-example-stat"><Users size={12} /> {example.agents.length}</span>
                <span className="ao-example-stat"><Layers size={12} /> {example.connections}</span>
                {example.tools.length > 0 && (
                  <span className="ao-example-stat"><Wrench size={12} /> {example.tools.join(', ')}</span>
                )}
              </div>

              <div className="ao-example-actions">
                <button className="agent-primary-button" disabled={Boolean(loadingId)}
                        onClick={() => load(example)}>
                  {loadingId === example.id
                    ? <><Loader2 size={13} className="agent-spin" /> Loading…</>
                    : <><Play size={13} /> Load this</>}
                </button>
                <button className="ao-ghost-button" onClick={() => setExpanded(open ? '' : example.id)}>
                  {open ? 'Hide details' : 'What it shows'}
                </button>
              </div>

              {open && (
                <div className="ao-example-detail">
                  <p>{example.what_it_shows}</p>
                  <p className="ao-look-for"><Sparkles size={12} /> {example.look_for}</p>
                  <span className="ao-detail-label">try asking the lead</span>
                  <ul>
                    {example.sample_tasks.map((task) => <li key={task}>“{task}”</li>)}
                  </ul>
                  {example.optional_tools?.length > 0 && (
                    <p className="agent-muted">
                      Works better with {example.optional_tools
                        .map((id) => catalogue.optional_tool_info[id]?.name || id).join(' and ')},
                      which need their own key — the graph runs fine without them.
                    </p>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
      </div></div>
    </div>
  )
}
