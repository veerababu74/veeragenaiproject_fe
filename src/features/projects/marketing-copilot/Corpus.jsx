import { useEffect, useState } from 'react'
import { Database, FileText, Loader2, ShieldCheck } from 'lucide-react'
import { marketingApi } from './api'

/* What the copilot is actually searching.
 *
 * Shown because a retrieval system is opaque until you can see its corpus, and
 * most "why did it say that?" questions are answered by looking at what was
 * available to say. The three tables are deliberately separate: documents go to
 * the vector store, campaign rows go to SQL and are never embedded, and the
 * rules are loaded whole rather than retrieved. That split is the architecture.
 */

const money = (value) => `£${Number(value).toLocaleString()}`

export default function Corpus() {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(null)
  const [document, setDocument] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    marketingApi('/corpus').then(setData).catch((e) => setError(e.message))
  }, [])

  const openDocument = async (id) => {
    if (open === id) { setOpen(null); setDocument(null); return }
    setOpen(id); setDocument(null)
    try {
      setDocument(await marketingApi(`/corpus/${id}`))
    } catch (requestError) { setError(requestError.message) }
  }

  if (error) return <p className="mc-error">{error}</p>
  if (!data) return <div className="mc-loading"><Loader2 size={18} className="mc-spin" /> Loading…</div>

  return (
    <div className="mc-corpus">
      <div className="mc-card">
        <div className="mc-card-head">
          <h3><FileText size={15} /> Documents</h3>
          <span className="mc-muted">{data.documents.length} · embedded and searched</span>
        </div>
        <p className="mc-note">
          Chunked on their headings rather than by character count. A brief’s headings are its
          semantics — the “Audience” section of one campaign must never be merged with the
          “Budget” of the next, which is exactly what a fixed window would do.
        </p>
        {data.documents.map((entry) => (
          <div className="mc-doc" key={entry.id}>
            <button onClick={() => openDocument(entry.id)}>
              <span className={`mc-doctype mc-doctype-${entry.doc_type}`}>{entry.doc_type}</span>
              <strong>{entry.title}</strong>
              <span className="mc-doc-meta">
                {[entry.quarter, entry.channel, entry.segment].filter(Boolean).join(' · ')}
              </span>
              <span className="mc-muted">{entry.chunk_count || 0} chunks</span>
            </button>
            {open === entry.id && (
              <div className="mc-doc-body">
                {!document ? <Loader2 size={14} className="mc-spin" /> : (
                  <>
                    <p className="mc-note">
                      Split into {document.chunks.length} chunks. The metadata below is applied as a
                      filter <em>before</em> similarity is consulted — asking about Q3 and getting
                      the Q1 brief is the failure this prevents.
                    </p>
                    {document.chunks.map((chunk) => (
                      <div className="mc-chunk" key={chunk.id}>
                        <span className="mc-chunk-section">{chunk.section || 'preamble'}</span>
                        <p>{chunk.text}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mc-card">
        <div className="mc-card-head">
          <h3><Database size={15} /> Campaign data</h3>
          <span className="mc-muted">{data.campaigns.length} rows · queried, never embedded</span>
        </div>
        <p className="mc-note">
          These numbers are deliberately kept out of the vector store. Embedding them would be a
          category error: similarity search cannot aggregate, compare or divide, and a system that
          tries produces a fluent wrong number instead of an error.
        </p>
        <div className="mc-table-scroll">
          <table className="mc-table">
            <thead>
              <tr>
                <th>campaign</th><th>channel</th><th>segment</th><th>quarter</th>
                <th>spend</th><th>conversions</th><th>CAC</th><th>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((row, index) => (
                <tr key={index}>
                  <td>{row.name}</td>
                  <td>{row.channel}</td>
                  <td>{row.segment}</td>
                  <td>{row.quarter}</td>
                  <td>{money(row.spend)}</td>
                  <td>{row.conversions}</td>
                  <td>{row.conversions ? money((row.spend / row.conversions).toFixed(0)) : '—'}</td>
                  <td>{(row.pipeline_value / row.spend).toFixed(1)}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mc-note mc-muted">
          CAC and ROAS are computed here for display only. When the copilot reports them it
          computes them in SQL and shows you the query.
        </p>
      </div>

      <div className="mc-card">
        <div className="mc-card-head">
          <h3><ShieldCheck size={15} /> Compliance rules</h3>
          <span className="mc-muted">{data.rules.length} · loaded whole</span>
        </div>
        <p className="mc-note">
          Never retrieved by similarity. There are five of them, and fetching the “three most
          relevant” means the two it skipped are the two that would have caught the violation.
        </p>
        {data.rules.map((rule) => (
          <div className={`mc-rule mc-rule-${rule.severity}`} key={rule.code}>
            <span className="mc-rule-code">{rule.code}</span>
            <div>
              <p>{rule.rule}</p>
              <code>{rule.pattern}</code>
            </div>
            <span className="mc-severity">{rule.severity}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
