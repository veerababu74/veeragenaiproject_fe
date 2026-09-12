import { useEffect, useState } from 'react'
import { Database, Eye, FileText, Loader2, Play, Route, Sparkles } from 'lucide-react'
import { marketingApi } from './api'

/* The scenarios, as a place you can actually find.
 *
 * These used to live only in the chat's empty state, which meant they were
 * invisible until you had already added a key, built the index and opened the
 * Ask tab — and they vanished the moment you asked anything. That is the wrong
 * place for the part that explains what the system is for.
 *
 * So they get a tab. It needs no key to read, which matters: someone deciding
 * whether this project is worth setting up should be able to see what it does
 * before they go and find an API key.
 */

const ROUTE_STYLE = {
  rag: { label: 'searches documents', icon: FileText, tone: 'blue' },
  sql: { label: 'queries the database', icon: Database, tone: 'green' },
  hybrid: { label: 'uses both', icon: Route, tone: 'violet' },
  generate: { label: 'writes an asset', icon: Sparkles, tone: 'amber' },
}

export default function Examples({ configured, onRun, onNeedSetup }) {
  const [examples, setExamples] = useState([])
  const [expanded, setExpanded] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    marketingApi('/examples')
      .then((data) => setExamples(data.examples))
      .catch((requestError) => setError(requestError.message))
  }, [])

  if (error) return <p className="mc-error">{error}</p>
  if (examples.length === 0) {
    return <div className="mc-loading"><Loader2 size={18} className="mc-spin" /> Loading…</div>
  }

  return (
    <div className="mc-examples">
      <div className="mc-card">
        <div className="mc-card-head">
          <h3><Sparkles size={15} /> Five things to try</h3>
          <span className="mc-muted">no key needed to read these</span>
        </div>
        <p className="mc-note">
          Each takes a different path through the agent and makes a different point. Run them in
          order and the picture builds: a lookup, a database query, the question that needs both, a
          draft that gets checked, and one it should refuse. The route each will take is named on
          the card — so you can check whether it chose what you expected.
        </p>
        {!configured && (
          <p className="mc-note">
            You can read all of this now. Running one needs your model key —{' '}
            <button className="mc-inline-link" onClick={onNeedSetup}>add it in Setup</button>.
          </p>
        )}
      </div>

      {examples.map((example) => {
        const route = ROUTE_STYLE[example.route] || ROUTE_STYLE.rag
        const RouteIcon = route.icon
        const open = expanded === example.id
        return (
          <article className={`mc-card mc-example ${open ? 'open' : ''}`} key={example.id}>
            <div className="mc-example-head">
              <span className="mc-example-order">{example.order}</span>
              <div>
                <h3>{example.title}</h3>
                <p>{example.tagline}</p>
              </div>
              <span className={`mc-route mc-route-${route.tone}`}>
                <RouteIcon size={12} /> {route.label}
              </span>
            </div>

            <p className="mc-example-shows">{example.what_it_shows}</p>

            <div className="mc-example-question">
              <span className="mc-sublabel">the question</span>
              <p>“{example.question}”</p>
            </div>

            <div className="mc-example-actions">
              <button className="mc-primary"
                      onClick={() => (configured ? onRun(example) : onNeedSetup())}>
                <Play size={13} /> {configured ? 'Run it' : 'Add a key to run'}
              </button>
              <button className="mc-ghost" onClick={() => setExpanded(open ? '' : example.id)}>
                {open ? 'Hide' : 'What to look for'}
              </button>
              <span className="mc-example-tag">{example.difficulty}</span>
            </div>

            {open && (
              <div className="mc-example-detail">
                <p><Eye size={12} /> {example.look_for}</p>
                {example.follow_ups?.length > 0 && (
                  <>
                    <span className="mc-sublabel">then try</span>
                    <ul>{example.follow_ups.map((q) => <li key={q}>“{q}”</li>)}</ul>
                    <p className="mc-muted">
                      These are worth running: each one only makes sense in the context of the
                      answer before it, so they exercise the step that rewrites a question before
                      it can be searched for.
                    </p>
                  </>
                )}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
