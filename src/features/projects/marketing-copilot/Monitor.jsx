import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { marketingApi } from './api'

/* The dashboard, and the argument for why these are the numbers on it.
 *
 * The point worth making here: bad RAG does not throw exceptions. It returns
 * confident nonsense with a 200, so error rate — the metric most services are
 * monitored on — is exactly the metric that will not catch it. The three below
 * will: a falling retrieval score means the corpus or the embedding drifted, a
 * rising loop-exhaustion count means the agent is failing and spending money to
 * do it, and the thumbs-down queue joined to citations is where the next fix
 * comes from.
 */

export default function Monitor() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = () => marketingApi('/monitor').then(setData).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  if (error) return <p className="mc-error">{error}</p>
  if (!data) return <div className="mc-loading"><Loader2 size={18} className="mc-spin" /> Loading…</div>

  const { totals } = data

  return (
    <div className="mc-monitor">
      <div className="mc-card">
        <div className="mc-card-head">
          <h3><Activity size={15} /> This workspace</h3>
          <button className="mc-ghost" onClick={load}><RefreshCw size={12} /> Refresh</button>
        </div>

        {totals.answers === 0 ? (
          <p className="mc-note">
            Nothing to show yet — ask the copilot a few questions and every one of them lands
            here with its route, its latency and the retrieval score behind it.
          </p>
        ) : (
          <>
            <dl className="mc-stats mc-stats-wide">
              <div><dt>answers</dt><dd>{totals.answers}</dd></div>
              <div><dt>p50 latency</dt><dd>{(totals.p50_latency_ms / 1000).toFixed(1)}s</dd></div>
              <div><dt>p95 latency</dt><dd>{(totals.p95_latency_ms / 1000).toFixed(1)}s</dd></div>
              <div><dt>avg top score</dt><dd>{totals.avg_top_score}</dd></div>
              <div><dt>avg attempts</dt><dd>{totals.avg_attempts}</dd></div>
              <div><dt>loop exhausted</dt><dd>{totals.loop_exhausted}</dd></div>
            </dl>
            <p className="mc-note">
              p95 rather than p50 is the one to read: the median is not the experience, the slow
              requests are.
            </p>
          </>
        )}
      </div>

      {data.by_route.length > 0 && (
        <div className="mc-card">
          <div className="mc-card-head"><h3>By route</h3></div>
          <div className="mc-table-scroll">
            <table className="mc-table">
              <thead>
                <tr><th>route</th><th>answers</th><th>avg latency</th><th>avg top score</th></tr>
              </thead>
              <tbody>
                {data.by_route.map((row) => (
                  <tr key={row.route}>
                    <td><span className="mc-route mc-route-blue">{row.route}</span></td>
                    <td>{row.n}</td>
                    <td>{(row.avg_latency / 1000).toFixed(1)}s</td>
                    <td>{row.avg_top_score ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mc-note">
            Latency split by route is how you find out that “it’s slow” means one path is slow.
            Hybrid questions do retrieval and SQL and are legitimately the slowest.
          </p>
        </div>
      )}

      <div className="mc-card">
        <div className="mc-card-head"><h3><AlertTriangle size={15} /> What to alert on</h3></div>
        {data.alerts.map((alert) => (
          <div className="mc-alert" key={alert.metric}>
            <code>{alert.metric}</code>
            <div>
              <strong>{alert.watch}</strong>
              <p>{alert.why}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mc-card">
        <div className="mc-card-head">
          <h3>Feedback</h3>
          <span className="mc-muted">
            {(data.feedback.positive || 0)} up · {(data.feedback.negative || 0)} down
          </span>
        </div>
        {data.negatives.length === 0 ? (
          <p className="mc-note">
            No negative ratings yet. When there are, each one appears here with the chunks it
            cited — that join is how a complaint becomes a fix rather than a guess.
          </p>
        ) : (
          data.negatives.map((row) => (
            <div className="mc-negative" key={row.id}>
              <div className="mc-negative-head">
                <span className="mc-route mc-route-amber">{row.route}</span>
                <span className="mc-muted">top score {row.top_score} · {row.attempts} attempt(s)</span>
              </div>
              <p>{row.content}</p>
              <div className="mc-citations">
                {row.citations.map((citation) => (
                  <span className="mc-citation" key={citation.chunk_id}>{citation.title}</span>
                ))}
                {row.citations.length === 0 && <span className="mc-muted">no citations</span>}
              </div>
            </div>
          ))
        )}
        <p className="mc-note">
          Triaging this queue weekly is the roadmap. A retrieval miss means fixing chunking or
          metadata; a generation issue means fixing the prompt and re-running the evaluation; a
          missing document means ingesting it. And a question that genuinely has no answer, which
          the copilot refused, is a pass rather than a failure.
        </p>
      </div>
    </div>
  )
}
