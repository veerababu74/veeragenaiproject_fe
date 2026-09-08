import { useEffect, useState } from 'react'
import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { marketingApi } from './api'

/* The compliance guardrail, on its own, with your own text.
 *
 * Exposed separately because seeing the rulebook applied to a sentence you wrote
 * is the fastest way to understand what it covers — and, more usefully, what it
 * does not. It runs no model: five regexes over the draft. Deterministic on
 * purpose, because a model asked to judge its own output for compliance is both
 * slower and less predictable than a pattern, and the violations that matter
 * here have precise shapes.
 */

const SAMPLES = [
  {
    label: 'trips two rules',
    text: 'Our platform guarantees compliance and is the fastest solution on the market.',
  },
  {
    label: 'names a customer',
    text: 'Trusted by Barclays and Monzo to automate their control testing.',
  },
  {
    label: 'unqualified figure',
    text: 'Teams see a 40% reduction in review effort after switching.',
  },
  {
    label: 'clean',
    text: 'Compliance teams spend weeks on manual control testing. We cut that to days at a '
        + 'tier-one UK bank, measured over a 12-month deployment.',
  },
]

export default function Compliance() {
  const [text, setText] = useState(SAMPLES[0].text)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const check = async (value) => {
    const draft = (value ?? text).trim()
    if (!draft) return
    setBusy(true); setError('')
    try {
      setResult(await marketingApi('/compliance/check', {
        method: 'POST', body: JSON.stringify({ text: draft }),
      }))
    } catch (requestError) { setError(requestError.message) }
    setBusy(false)
  }

  useEffect(() => { check(SAMPLES[0].text) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mc-compliance-panel">
      <div className="mc-card">
        <div className="mc-card-head">
          <h3><ShieldCheck size={15} /> Check some copy</h3>
          <span className="mc-muted">no model call — five patterns</span>
        </div>
        <p className="mc-note">
          This is the node that runs over anything the copilot drafts, before you see it. Paste
          your own text and it applies the same rules.
        </p>

        <div className="mc-samples">
          {SAMPLES.map((sample) => (
            <button key={sample.label} onClick={() => { setText(sample.text); check(sample.text) }}>
              {sample.label}
            </button>
          ))}
        </div>

        <textarea value={text} rows={4} onChange={(event) => setText(event.target.value)}
                  placeholder="Paste marketing copy to check…" />
        <button className="mc-primary" onClick={() => check()} disabled={busy || !text.trim()}>
          {busy ? <Loader2 size={14} className="mc-spin" /> : <ShieldCheck size={14} />} Check
        </button>
        {error && <p className="mc-error">{error}</p>}
      </div>

      {result && (
        <div className="mc-card">
          <div className={`mc-verdict ${result.passed ? 'good' : 'bad'}`}>
            {result.passed ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
            <strong>
              {result.passed
                ? 'No rules tripped'
                : `${result.violations.length} violation${result.violations.length > 1 ? 's' : ''}`}
            </strong>
          </div>

          {result.violations.map((violation) => (
            <div className={`mc-violation mc-rule-${violation.severity}`} key={violation.code}>
              <span className="mc-rule-code">{violation.code}</span>
              <div>
                <p><strong>matched “{violation.matched}”</strong></p>
                <p>{violation.rule}</p>
              </div>
              <span className="mc-severity">{violation.severity}</span>
            </div>
          ))}

          <p className="mc-note mc-muted">
            {result.note} It reduces what reaches a human reviewer; it does not replace one, and
            nothing here can make a claim legally safe. Rephrasings that mean the same thing in
            ordinary words will pass — which is the honest limit of pattern matching, and the
            reason the node escalates rather than silently rewriting.
          </p>
        </div>
      )}
    </div>
  )
}
