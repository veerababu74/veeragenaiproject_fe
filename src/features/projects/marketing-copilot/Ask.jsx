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

export default function Ask({ configured, onNeedSetup, pending, onPendingHandled }) {
  const [suggestions, setSuggestions] = useState([])
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState([])
  const [conversationId, setConversationId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState('')
  const [active, setActive] = useState(null)
  const endRef = useRef(null)

  useEffect(() => {
    marketingApi('/examples').then((data) => setSuggestions(data.examples)).catch(() => {})
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, busy])

  // A scenario chosen on the Examples tab arrives here and runs itself once.
  useEffect(() => {
    if (!pending || busy) return
    setActive(pending)
    ask(pending.question)
    onPendingHandled?.()
  }, [pending]) // eslint-disable-line react-hooks/exhaustive-deps

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
          <h3>Pick a scenario</h3>
          <p>
            Each one takes a different path through the agent and makes a different point. Run them
            in order and the picture builds: a lookup, a database query, the question that needs
            both, a draft that gets checked, and one it should refuse.
          </p>
          <div className="mc-scenarios">
            {suggestions.map((item) => {
              const tone = ROUTE_STYLE[item.route]?.tone || 'blue'
              const open = expanded === item.id
              return (
                <article className={`mc-scenario ${open ? 'open' : ''}`} key={item.id}>
                  <div className="mc-scenario-head">
                    <span className={`mc-route mc-route-${tone}`}>{item.route}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.tagline}</small>
                    </div>
                    <span className="mc-scenario-tag">{item.difficulty}</span>
                  </div>
                  <p className="mc-scenario-shows">{item.what_it_shows}</p>
                  <div className="mc-scenario-actions">
                    <button className="mc-primary" disabled={busy}
                            onClick={() => { setActive(item); ask(item.question) }}>
                      Run this <Send size={13} />
                    </button>
                    <button className="mc-ghost"
                            onClick={() => setExpanded(open ? '' : item.id)}>
                      {open ? 'Hide' : 'What to look for'}
                    </button>
                  </div>
                  {open && (
                    <div className="mc-scenario-detail">
                      <p><strong>The question:</strong> “{item.question}”</p>
                      <p><Eye size={12} /> {item.look_for}</p>
                      {item.follow_ups?.length > 0 && (
                        <>
                          <span className="mc-sublabel">then try</span>
                          <ul>{item.follow_ups.map((q) => <li key={q}>“{q}”</li>)}</ul>
                        </>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
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

      {active?.follow_ups?.length > 0 && turns.length > 0 && !busy && (
        <div className="mc-followups">
          <span className="mc-sublabel">try next</span>
          {active.follow_ups.map((question) => (
            <button key={question} onClick={() => ask(question)}>{question}</button>
          ))}
        </div>
      )}

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
