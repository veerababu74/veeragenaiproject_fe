import { useEffect, useRef, useState } from 'react'
import {
  Database, FileText, Loader2, Route, Send, ShieldCheck, ShieldAlert,
  ThumbsDown, ThumbsUp, Sparkles,
} from 'lucide-react'
import { marketingApi } from './api'

/* Asking the copilot something, and seeing how it answered.
 *
 * The answer is the least interesting part of this panel. What makes the system
 * explicable is the path: which route the question took, what it searched for,
 * whether the grader sent it back for another attempt, what SQL it wrote, and
 * which chunks the claims came from. All of that is returned with every answer
 * and rendered underneath it, because a number nobody can check is a number
 * nobody should use.
 */

const ROUTE_STYLE = {
  rag: { label: 'documents', icon: FileText, tone: 'blue' },
  sql: { label: 'campaign data', icon: Database, tone: 'green' },
  hybrid: { label: 'documents + data', icon: Route, tone: 'violet' },
  generate: { label: 'drafted an asset', icon: Sparkles, tone: 'amber' },
}

function StepTrail({ steps }) {
  if (!steps?.length) return null
  return (
    <ol className="mc-steps">
      {steps.map((step, index) => (
        <li key={index} className={`mc-step mc-step-${step.node}`}>
          <span className="mc-step-node">{step.node}</span>
          <span className="mc-step-detail">{step.detail}</span>
          {step.relevant === false && <span className="mc-step-flag">sent back</span>}
        </li>
      ))}
    </ol>
  )
}

function Answer({ message, onFeedback }) {
  const [rated, setRated] = useState(0)
  const route = ROUTE_STYLE[message.route] || ROUTE_STYLE.rag
  const RouteIcon = route.icon
  const violations = message.compliance?.violations || []

  const rate = async (rating) => {
    setRated(rating)
    try {
      await marketingApi('/feedback', {
        method: 'POST',
        body: JSON.stringify({ message_id: message.message_id, rating }),
      })
      onFeedback?.()
    } catch { /* a failed rating should never break the conversation */ }
  }

  return (
    <div className="mc-answer">
      <div className="mc-answer-head">
        <span className={`mc-route mc-route-${route.tone}`}>
          <RouteIcon size={12} /> {route.label}
        </span>
        {message.attempts > 0 && (
          <span className="mc-pill-warn">{message.attempts} retrieval retry</span>
        )}
        {message.abstained && <span className="mc-pill-warn">refused to answer</span>}
        <span className="mc-muted">{(message.latency_ms / 1000).toFixed(1)}s</span>
        <div className="mc-rate">
          <button className={rated === 1 ? 'up' : ''} onClick={() => rate(1)} title="Helpful">
            <ThumbsUp size={13} />
          </button>
          <button className={rated === -1 ? 'down' : ''} onClick={() => rate(-1)} title="Not helpful">
            <ThumbsDown size={13} />
          </button>
        </div>
      </div>

      <div className="mc-answer-body">{message.answer}</div>

      {message.sql_query && (
        <div className="mc-sql">
          <span className="mc-sublabel">
            <Database size={11} /> the query it ran — check it
          </span>
          <code>{message.sql_query}</code>
          {message.sql_rows?.length > 0 && (
            <div className="mc-table-scroll">
              <table className="mc-table">
                <thead>
                  <tr>{Object.keys(message.sql_rows[0]).map((key) => <th key={key}>{key}</th>)}</tr>
                </thead>
                <tbody>
                  {message.sql_rows.slice(0, 8).map((row, index) => (
                    <tr key={index}>
                      {Object.values(row).map((value, position) => (
                        <td key={position}>{String(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {message.compliance?.checked && (
        <div className={`mc-compliance ${violations.length ? 'bad' : 'good'}`}>
          {violations.length ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
          <div>
            <strong>
              {violations.length
                ? `${violations.length} compliance issue${violations.length > 1 ? 's' : ''}`
                : 'No compliance issues found'}
            </strong>
            {violations.map((violation) => (
              <p key={violation.code}>
                <code>{violation.code}</code> matched “{violation.matched}” — {violation.rule}
              </p>
            ))}
            <small>{message.compliance.note}</small>
          </div>
        </div>
      )}

      {message.citations?.length > 0 && (
        <div className="mc-citations">
          <span className="mc-sublabel"><FileText size={11} /> sources</span>
          {message.citations.map((citation) => (
            <span className="mc-citation" key={citation.chunk_id}>
              <em>[{citation.n}]</em> {citation.title}
              {citation.section && <small>{citation.section}</small>}
            </span>
          ))}
        </div>
      )}

      <details className="mc-trace">
        <summary>How it got there — {message.steps?.length || 0} steps</summary>
        <StepTrail steps={message.steps} />
      </details>
    </div>
  )
}

export default function Ask({ configured, onNeedSetup }) {
  const [suggestions, setSuggestions] = useState([])
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState([])
  const [conversationId, setConversationId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    marketingApi('/suggestions').then((data) => setSuggestions(data.suggestions)).catch(() => {})
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, busy])

  const ask = async (text) => {
    const message = (text ?? question).trim()
    if (!message || busy) return
    if (!configured) { onNeedSetup(); return }

    setQuestion('')
    setError('')
    setTurns((current) => [...current, { role: 'user', content: message }])
    setBusy(true)
    try {
      const result = await marketingApi('/chat', {
        method: 'POST',
        body: JSON.stringify({ message, conversation_id: conversationId }),
      })
      setConversationId(result.conversation_id)
      setTurns((current) => [...current, { role: 'assistant', ...result }])
    } catch (requestError) {
      setError(requestError.message)
      setTurns((current) => current.slice(0, -1))
      setQuestion(message)
    }
    setBusy(false)
  }

  return (
    <div className="mc-ask">
      {turns.length === 0 && (
        <div className="mc-empty">
          <h3>Ask it something</h3>
          <p>
            Each of these takes a different path through the agent. The route it chose, and why,
            is shown with every answer.
          </p>
          <div className="mc-suggestions">
            {suggestions.map((item) => (
              <button key={item.text} onClick={() => ask(item.text)} disabled={busy}>
                <span className={`mc-route mc-route-${ROUTE_STYLE[item.route]?.tone || 'blue'}`}>
                  {item.route}
                </span>
                <strong>{item.text}</strong>
                <small>{item.note}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mc-thread">
        {turns.map((turn, index) => (
          turn.role === 'user'
            ? <div className="mc-question" key={index}>{turn.content}</div>
            : <Answer key={index} message={turn} />
        ))}
        {busy && (
          <div className="mc-thinking">
            <Loader2 size={15} className="mc-spin" />
            routing, retrieving, and checking what came back…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="mc-error">{error}</p>}

      <form className="mc-composer" onSubmit={(event) => { event.preventDefault(); ask() }}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={configured
            ? 'Ask about campaigns, brand voice, performance — or ask it to draft something'
            : 'Add your API key in Setup first'}
          disabled={busy}
        />
        <button className="mc-primary" type="submit" disabled={busy || !question.trim()}>
          {busy ? <Loader2 size={14} className="mc-spin" /> : <Send size={14} />}
        </button>
      </form>
    </div>
  )
}
