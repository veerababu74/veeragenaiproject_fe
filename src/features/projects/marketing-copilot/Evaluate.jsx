import { useEffect, useState } from 'react'
import { CheckCircle2, FlaskConical, Loader2, Play, XCircle } from 'lucide-react'
import { marketingApi } from './api'

/* Running the golden set, and reading the result the way it should be read.
 *
 * The metrics are grouped into families and shown in that order — retrieval,
 * then generation, then agent — because that grouping is the whole point.
 * A single end-to-end score cannot tell you whether you fetched the wrong
 * context or wrote a bad answer from good context, and those need different
 * fixes. Recall@k is listed first because it is the ceiling on everything
 * downstream: if the document was never retrieved, no prompt change can help.
 */

const FAMILY_ORDER = ['retrieval', 'generation', 'agent', 'end-to-end']

const percent = (value) => (value === null || value === undefined ? '—' : `${(value * 100).toFixed(0)}%`)

function MetricGrid({ metrics, glossary }) {
  const byFamily = FAMILY_ORDER.map((family) => ({
    family,
    entries: glossary.filter((entry) => entry.family === family),
  })).filter((group) => group.entries.length)

  return (
    <>
      {byFamily.map((group) => (
        <div key={group.family} className="mc-metric-family">
          <h5 className="mc-sublabel">{group.family}</h5>
          <div className="mc-metric-row">
            {group.entries.map((entry) => {
              const value = metrics[entry.id]
              const isRate = entry.id !== 'mean_attempts'
              return (
                <div className="mc-metric" key={entry.id} title={entry.means}>
                  <strong>{isRate ? percent(value) : (value ?? '—')}</strong>
                  <span>{entry.name}</span>
                  <code>{entry.formula}</code>
                  <p>{entry.means}</p>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}

export default function Evaluate({ configured, onNeedSetup }) {
  const [dataset, setDataset] = useState(null)
  const [runs, setRuns] = useState([])
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadRuns = () => marketingApi('/eval/runs')
    .then((data) => setRuns(data.runs)).catch(() => {})

  useEffect(() => {
    marketingApi('/eval/dataset').then(setDataset).catch((e) => setError(e.message))
    loadRuns()
  }, [])

  const run = async () => {
    if (!configured) { onNeedSetup(); return }
    setBusy(true); setError(''); setResult(null)
    try {
      setResult(await marketingApi('/eval/run', {
        method: 'POST', body: JSON.stringify({ limit: 0 }),
        signal: AbortSignal.timeout(300000),
      }))
      loadRuns()
    } catch (requestError) {
      setError(requestError.message)
    }
    setBusy(false)
  }

  return (
    <div className="mc-evaluate">
      <div className="mc-card">
        <div className="mc-card-head">
          <h3><FlaskConical size={15} /> The golden set</h3>
          <span className="mc-muted">{dataset?.cases?.length || 0} cases</span>
        </div>
        <p className="mc-note">{dataset?.note}</p>

        <div className="mc-slices">
          {['factual', 'analytical', 'hybrid', 'unanswerable'].map((name) => {
            const count = (dataset?.cases || []).filter((c) => c.slice === name).length
            return count ? (
              <span key={name} className={`mc-slice mc-slice-${name}`}>
                {name} · {count}
              </span>
            ) : null
          })}
        </div>
        <p className="mc-note">
          The <strong>unanswerable</strong> slice is the one worth watching. Those questions have
          no answer in the corpus, and the pass condition is that the copilot refuses them. A
          system that never says “I don’t know” is not accurate, only confident.
        </p>

        <button className="mc-primary" onClick={run} disabled={busy}>
          {busy ? <Loader2 size={14} className="mc-spin" /> : <Play size={14} />}
          {busy ? 'Running every case…' : 'Run evaluation'}
        </button>
        <p className="mc-note mc-muted">
          Each case is a real agent run against your key, so this costs tokens and takes a minute.
        </p>
        {error && <p className="mc-error">{error}</p>}
      </div>

      {result && (
        <>
          <div className="mc-card">
            <div className="mc-card-head"><h3>Results</h3></div>
            <MetricGrid metrics={result.metrics} glossary={dataset?.metrics || []} />
          </div>

          <div className="mc-card">
            <div className="mc-card-head"><h3>By slice</h3></div>
            <div className="mc-table-scroll">
              <table className="mc-table">
                <thead>
                  <tr><th>slice</th><th>cases</th><th>pass rate</th><th>recall@k</th><th>routing</th></tr>
                </thead>
                <tbody>
                  {Object.entries(result.slices).map(([name, row]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{row.cases}</td>
                      <td>{percent(row.pass_rate)}</td>
                      <td>{percent(row.recall_at_k)}</td>
                      <td>{percent(row.routing_accuracy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mc-card">
            <div className="mc-card-head"><h3>Every case</h3></div>
            {result.results.map((row) => (
              <details className={`mc-case ${row.passed ? 'pass' : 'fail'}`} key={row.id}>
                <summary>
                  {row.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  <span className="mc-case-q">{row.question}</span>
                  <span className={`mc-route mc-route-${row.routed_correctly ? 'green' : 'amber'}`}>
                    {row.actual_route}
                    {!row.routed_correctly && ` (expected ${row.expected_route})`}
                  </span>
                </summary>
                <dl className="mc-stats">
                  <div><dt>recall@k</dt><dd>{row.recall_at_k === null ? 'n/a' : percent(row.recall_at_k)}</dd></div>
                  <div><dt>MRR</dt><dd>{row.mrr === null ? 'n/a' : row.mrr?.toFixed(2)}</dd></div>
                  <div><dt>attempts</dt><dd>{row.attempts}</dd></div>
                  <div><dt>latency</dt><dd>{(row.latency_ms / 1000).toFixed(1)}s</dd></div>
                </dl>
                {row.expected_documents?.length > 0 && (
                  <p className="mc-note">
                    <strong>expected:</strong> {row.expected_documents.join(', ')}<br />
                    <strong>retrieved:</strong> {row.retrieved.join(', ') || 'nothing'}
                  </p>
                )}
                {row.sql_query && <code className="mc-inline-sql">{row.sql_query}</code>}
                <p className="mc-note">{row.reason}</p>
                <p className="mc-answer-preview">{row.answer}</p>
              </details>
            ))}
          </div>
        </>
      )}

      {runs.length > 0 && (
        <div className="mc-card">
          <div className="mc-card-head"><h3>Previous runs</h3></div>
          <p className="mc-note">
            Stored rather than printed, because the value of an evaluation is the comparison
            between runs. One score tells you nothing; a score next to last week’s tells you
            whether the change you shipped helped.
          </p>
          <div className="mc-table-scroll">
            <table className="mc-table">
              <thead>
                <tr><th>when</th><th>pass rate</th><th>recall@k</th><th>routing</th><th>abstention</th></tr>
              </thead>
              <tbody>
                {runs.map((row) => (
                  <tr key={row.id}>
                    <td>{row.created_at}</td>
                    <td>{percent(row.metrics.pass_rate)}</td>
                    <td>{percent(row.metrics.recall_at_k)}</td>
                    <td>{percent(row.metrics.routing_accuracy)}</td>
                    <td>{percent(row.metrics.abstention_correct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
