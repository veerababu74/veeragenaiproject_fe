import { useEffect, useState } from 'react'
import { ChevronDown, Loader2, TriangleAlert, Wrench } from 'lucide-react'
import { marketingApi } from './api'

/* The graph explained node by node, and the failures that shaped it.
 *
 * Same three registers the rest of the platform uses — the formula, the symbols
 * in it, and the operations it decomposes into — because a system that will not
 * say how it decided is asking to be trusted, and this one is trying to earn it
 * instead.
 */

export default function HowItWorks({ overview }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState('route')
  const [error, setError] = useState('')

  useEffect(() => {
    marketingApi('/explain').then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="mc-error">{error}</p>
  if (!data) return <div className="mc-loading"><Loader2 size={18} className="mc-spin" /> Loading…</div>

  return (
    <div className="mc-explain">
      {overview && (
        <div className="mc-card">
          <div className="mc-card-head"><h3>The problem</h3></div>
          <p className="mc-lede">{overview.problem}</p>
          <h5 className="mc-sublabel">Why it needs an agent</h5>
          <p className="mc-note">{overview.why_it_needs_an_agent}</p>
          <h5 className="mc-sublabel">And why most of it does not</h5>
          <p className="mc-note">{overview.what_stays_dumb}</p>
        </div>
      )}

      <div className="mc-card">
        <div className="mc-card-head"><h3>The graph</h3></div>
        <pre className="mc-diagram">{`  route ──► retrieve ──► grade ──► rewrite ──┐
        ├─► sql          │        ▲──────────┘ (bounded at 2)
        ├─► hybrid ──────┘
        └─► generate
                 └──► synthesise ──► compliance ──► answer`}</pre>

        {data.nodes.map((node) => {
          const isOpen = open === node.id
          return (
            <article className={`mc-node ${isOpen ? 'open' : ''}`} key={node.id}>
              <button onClick={() => setOpen(isOpen ? '' : node.id)}>
                <span className="mc-node-order">{node.order}</span>
                <div>
                  <h4>{node.name}</h4>
                  <p>{node.tagline}</p>
                </div>
                <ChevronDown size={15} className="mc-chevron" />
              </button>
              {isOpen && (
                <div className="mc-node-body">
                  <code className="mc-equation">{node.formula}</code>

                  <dl className="mc-symbols">
                    {node.symbols.map((symbol) => (
                      <div key={symbol.symbol}>
                        <dt><code>{symbol.symbol}</code></dt>
                        <dd>{symbol.means}</dd>
                      </div>
                    ))}
                  </dl>

                  <ol className="mc-derivation">
                    {node.derivation.map((step, index) => (
                      <li key={index}>
                        <div className="mc-derivation-head">
                          <span>{index + 1}</span>
                          <h6>{step.label}</h6>
                        </div>
                        <code>{step.expression}</code>
                        {step.note && <p>{step.note}</p>}
                      </li>
                    ))}
                  </ol>

                  <p className="mc-note"><strong>Why:</strong> {node.why}</p>
                </div>
              )}
            </article>
          )
        })}
      </div>

      <div className="mc-card">
        <div className="mc-card-head">
          <h3><Wrench size={15} /> What went wrong, and what fixed it</h3>
        </div>
        <p className="mc-note">
          Every one of these produced a plausible answer rather than an error, which is what makes
          them worth writing down. A system that fails loudly is easy; these failed quietly.
        </p>
        {data.failure_modes.map((failure) => (
          <div className="mc-failure" key={failure.title}>
            <h4><TriangleAlert size={13} /> {failure.title}</h4>
            <dl>
              <div><dt>symptom</dt><dd>{failure.symptom}</dd></div>
              <div><dt>cause</dt><dd>{failure.cause}</dd></div>
              <div><dt>fix</dt><dd>{failure.fix}</dd></div>
            </dl>
            <p className="mc-lesson">{failure.lesson}</p>
          </div>
        ))}
      </div>

      {overview?.stack && (
        <div className="mc-card">
          <div className="mc-card-head"><h3>The stack, and why each piece</h3></div>
          {overview.stack.map((item) => (
            <div className="mc-stack-row" key={item.name}>
              <strong>{item.name}</strong>
              <span>{item.role}</span>
              <p>{item.why}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
