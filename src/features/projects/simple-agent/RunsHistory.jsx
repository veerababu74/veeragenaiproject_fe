import { useEffect, useState } from 'react'
import { ArrowLeft, History, Loader2 } from 'lucide-react'
import { simpleAgentApi } from '../../../lib/simpleAgentApi'
import TraceTimeline from './TraceTimeline'

const formatMs = (ms) => (!ms ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)

export default function RunsHistory() {
  const [runs, setRuns] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    simpleAgentApi('/runs').then((data) => setRuns(data.runs)).catch(() => setRuns([])).finally(() => setLoading(false))
  }, [])

  const open = async (runId) => {
    setSelected({ loading: true })
    try {
      setSelected(await simpleAgentApi(`/runs/${runId}`))
    } catch (error) {
      setSelected({ error: error.message })
    }
  }

  if (selected && !selected.error) {
    if (selected.loading) return <div className="sa-empty-state"><Loader2 size={22} className="sa-spin" /><p>Loading run…</p></div>
    return (
      <div className="sa-card sa-run-detail">
        <header className="sa-card-head">
          <button className="sa-ghost" onClick={() => setSelected(null)}><ArrowLeft size={13} /> All runs</button>
          <span className="sa-muted">
            {selected.summary.rounds} rounds · {selected.summary.tool_calls} tool calls ·
            {' '}{formatMs(selected.run.duration_ms)}
          </span>
        </header>
        {selected.summary.tool_sequence.length > 0 && (
          <div className="sa-sequence">
            <span>Tool order</span>
            {selected.summary.tool_sequence.map((item) => (
              <span key={item.order} className="sa-sequence-item">
                <b>{item.order}</b> {item.tool} <small>r{item.round}</small>
              </span>
            ))}
          </div>
        )}
        <TraceTimeline
          steps={selected.steps}
          isRunning={false}
          result={{ duration_ms: selected.run.duration_ms,
                    tokens: { in: selected.run.tokens_in, out: selected.run.tokens_out } }}
        />
      </div>
    )
  }

  return (
    <div className="sa-card">
      <header className="sa-card-head">
        <h3><History size={16} /> Recent runs</h3>
        <span className="sa-muted">Kept for 48 hours, then deleted with everything else.</span>
      </header>
      {selected?.error && <p className="sa-error">{selected.error}</p>}
      {loading && <p className="sa-muted"><Loader2 size={13} className="sa-spin" /> Loading…</p>}
      {!loading && runs.length === 0 && <p className="sa-muted">No runs yet.</p>}
      <ul className="sa-run-rows">
        {runs.map((run) => (
          <li key={run.id}>
            <button onClick={() => open(run.id)}>
              <div>
                <strong>{run.question}</strong>
                <small>
                  {new Date(run.created_at + 'Z').toLocaleString()} · {run.rounds} rounds ·
                  {' '}{run.tool_calls} tools · {formatMs(run.duration_ms)}
                </small>
              </div>
              <span className={`sa-status ${run.status}`}>{run.status}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
