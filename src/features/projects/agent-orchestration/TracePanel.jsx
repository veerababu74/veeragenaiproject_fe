import { useEffect, useState } from 'react'
import {
  Activity, MessageSquare, Brain, Wrench, CornerDownRight, CheckCircle2,
  AlertTriangle, Workflow, Clock, RefreshCw,
} from 'lucide-react'
import { agentApi } from '../../../lib/agentApi'

const EVENT_META = {
  question: { icon: MessageSquare, label: 'Question' },
  reasoning: { icon: Brain, label: 'Decision' },
  tool_call: { icon: Wrench, label: 'Tool call' },
  tool_result: { icon: CornerDownRight, label: 'Result' },
  tool_error: { icon: AlertTriangle, label: 'Tool failed' },
  answer: { icon: CheckCircle2, label: 'Answer' },
  error: { icon: AlertTriangle, label: 'Run failed' },
}

const ms = (value) => (value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value || 0}ms`)

function TraceStep({ event }) {
  const meta = EVENT_META[event.event_type] || { icon: Activity, label: event.event_type }
  const Icon = meta.icon
  const isDelegation = event.data?.delegation
  const chose = event.data?.chose || []
  return (
    <div className={`trace-step ${event.event_type}`} style={{ marginLeft: `${(event.depth || 0) * 18}px` }}>
      <span className="trace-step-icon"><Icon size={13} /></span>
      <div className="trace-step-body">
        <div className="trace-step-head">
          <strong>{isDelegation ? 'Delegation' : meta.label}</strong>
          {event.name && <span className="badge outline">{event.name}</span>}
          {event.agent && <span className="trace-agent">{event.agent}</span>}
          {event.duration_ms > 0 && <span className="trace-ms">{ms(event.duration_ms)}</span>}
        </div>
        {chose.length > 0 && (
          <p className="trace-chose">chose {chose.map((name) => <span key={name} className="badge">{name}</span>)}</p>
        )}
        {event.content
          ? <pre className="trace-content">{event.content}</pre>
          : event.data?.no_text && <p className="agent-muted">Called the tool without explaining why.</p>}
      </div>
    </div>
  )
}

export default function TracePanel() {
  const [metrics, setMetrics] = useState(null)
  const [runs, setRuns] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  const load = () => {
    agentApi('/execute/metrics').then(setMetrics).catch(() => {})
    agentApi('/execute/history?limit=40').then(setRuns).catch(() => {})
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!selected) { setDetail(null); return }
    setDetail(null)
    agentApi(`/execute/runs/${selected}`).then(setDetail).catch((e) => setError(e.message))
  }, [selected])

  const tiles = metrics ? [
    { label: 'Runs', value: metrics.runs },
    { label: 'Success', value: `${metrics.success_rate}%` },
    { label: 'Avg', value: ms(metrics.avg_duration_ms) },
    { label: 'p95', value: ms(metrics.p95_duration_ms) },
    { label: 'Tokens', value: metrics.total_tokens },
    { label: 'Errors', value: metrics.errors },
  ] : []

  return (
    <div className="agent-panel">
      <header className="agent-panel-header agent-panel-header-row">
        <div><h1>Observability</h1><p>Every run, step by step: what was asked, what the agent decided, which tools it ran, and what it answered</p></div>
        <div className="agent-panel-header-actions">
          <button onClick={load} title="Refresh"><RefreshCw size={14} /> Refresh</button>
        </div>
      </header>
      <div className="agent-panel-scroll"><div className="agent-panel-content">
        {error && <p className="agent-error">{error}</p>}

        <section className="agent-card">
          <h2><Activity size={16} /> Metrics</h2>
          {!metrics ? <p className="agent-muted center">Loading…</p> : (
            <div className="agent-stats-grid">
              {tiles.map((tile) => <div key={tile.label} className="agent-stat-tile"><strong>{tile.value}</strong><span>{tile.label}</span></div>)}
            </div>
          )}
        </section>

        {metrics?.by_tool?.length > 0 && (
          <section className="agent-card">
            <h2><Wrench size={16} /> Tool usage</h2>
            <div className="agent-list">
              {metrics.by_tool.map((tool) => (
                <div className="agent-list-row" key={tool.name}>
                  <div className="agent-list-row-main"><div>
                    <p>{tool.name}</p>
                    <small>{tool.calls} call{tool.calls === 1 ? '' : 's'} · avg {ms(Math.round(tool.avg_ms || 0))}</small>
                  </div></div>
                  <div className="agent-list-row-actions">
                    {tool.errors > 0 && <span className="badge destructive">{tool.errors} failed</span>}
                    {tool.name.startsWith('ask_') && <span className="badge outline">delegation</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="agent-card">
          <h2><Clock size={16} /> Runs</h2>
          {runs.length === 0 ? <p className="agent-muted center">No runs yet — chat with an agent to record one</p> : (
            <div className="agent-list">
              {runs.map((run) => (
                <button type="button" key={run.id}
                  className={`agent-list-row trace-run ${selected === run.id ? 'active' : ''}`}
                  onClick={() => setSelected(selected === run.id ? null : run.id)}>
                  <div className="agent-list-row-main"><div>
                    <p>{run.agent_name || 'Deleted agent'}</p>
                    <small>{run.input_text?.slice(0, 100) || '(no input)'}</small>
                  </div></div>
                  <div className="agent-list-row-actions">
                    {run.tokens_used > 0 && <small className="agent-muted">{run.tokens_used} tok</small>}
                    <small className="agent-muted">{ms(run.duration_ms)}</small>
                    <span className={`badge ${run.status === 'error' ? 'destructive' : run.status === 'completed' ? '' : 'outline'}`}>{run.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {selected && (
          <section className="agent-card">
            <h2><Workflow size={16} /> Trace</h2>
            {!detail ? <p className="agent-muted center">Loading trace…</p> : (
              <>
                <div className="trace-summary">
                  <span className="badge outline">{detail.summary.steps} steps</span>
                  <span className="badge outline">{detail.summary.tool_calls} tool calls</span>
                  {detail.summary.delegations > 0 && <span className="badge">{detail.summary.delegations} delegation{detail.summary.delegations === 1 ? '' : 's'}</span>}
                  {detail.summary.agents_involved.length > 1 && <span className="badge">{detail.summary.agents_involved.length} agents</span>}
                  {detail.summary.errors > 0 && <span className="badge destructive">{detail.summary.errors} error{detail.summary.errors === 1 ? '' : 's'}</span>}
                </div>
                {detail.trace.length === 0
                  ? <p className="agent-muted center">This run has no recorded steps.</p>
                  : <div className="trace-timeline">{detail.trace.map((event) => <TraceStep key={event.id || event.seq} event={event} />)}</div>}
              </>
            )}
          </section>
        )}
      </div></div>
    </div>
  )
}
