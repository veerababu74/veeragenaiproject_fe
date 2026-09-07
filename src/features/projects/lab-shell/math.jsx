/* Showing the working, for the labs.
 *
 * The same three registers the Inside an LLM walkthrough uses, in the labs'
 * own chrome: the equation in symbols, and the equation with the numbers the
 * page is currently displaying. A lab that shows a ranked list without the
 * arithmetic that produced the ranking is asking to be taken on trust, and in
 * every one of these labs the intermediates are already in hand.
 *
 * Kept here rather than in any one lab because the decoding and embedding labs
 * both need it and neither owns it.
 */

/** A formula, set on its own. Newlines are preserved. */
export function Equation({ children, label, note }) {
  return (
    <div className="lab-equation">
      {label && <span className="lab-equation-label">{label}</span>}
      <code>{children}</code>
      {note && <span className="lab-equation-note">{note}</span>}
    </div>
  )
}

/** What each symbol stands for. */
export function SymbolTable({ symbols }) {
  if (!symbols?.length) return null
  return (
    <dl className="lab-symbols">
      {symbols.map((entry) => (
        <div key={entry.symbol}>
          <dt><code>{entry.symbol}</code></dt>
          <dd>{entry.means}</dd>
        </div>
      ))}
    </dl>
  )
}

/* The chain of operations with real values in it.
 *
 * Rows are {label, expression, result, note}. A row whose `dropped` is true is
 * drawn struck through — in the decoding lab a candidate can be computed and
 * then discarded by truncation, and hiding that step would misrepresent what
 * top-k and top-p actually do. */
export function Substitution({ title, rows, footnote }) {
  if (!rows?.length) return null
  return (
    <div className="lab-substitution">
      {title && <h6 className="lab-substitution-title">{title}</h6>}
      <ol>
        {rows.map((row, index) => (
          <li key={index} className={row.dropped ? 'dropped' : ''}>
            <span className="lab-sub-label">{row.label}</span>
            <code className="lab-sub-expression">{row.expression}</code>
            {row.result !== undefined && <span className="lab-sub-result">= {row.result}</span>}
            {row.note && <span className="lab-sub-note">{row.note}</span>}
          </li>
        ))}
      </ol>
      {footnote && <p className="lab-note">{footnote}</p>}
    </div>
  )
}

export const fixed = (value, places = 3) =>
  Number.isFinite(value) ? value.toFixed(places) : '—'

/** Probabilities span many orders of magnitude here — a token cut by top-p can
 *  sit at 1e-7 — so small values switch to exponent notation rather than
 *  rounding to a row of zeroes. */
export const probability = (value) => {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  if (value < 0.0001) return value.toExponential(2)
  return `${(value * 100).toFixed(3)}%`
}
