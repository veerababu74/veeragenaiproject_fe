/* How the arithmetic is shown.
 *
 * Every component in the walkthrough makes the same three claims, and they are
 * separate claims: here is the equation, here is what each symbol in it stands
 * for, and here is that equation evaluated on the sentence currently loaded.
 * The third is the one that was missing — a formula printed on its own asks the
 * reader to take it on trust, and the numbers are already in the payload.
 *
 * So `Equation` states it, `SymbolTable` defines the terms, `Derivation` breaks
 * it into the operations actually performed, and `Substitution` puts this
 * example's values through those operations with the result of each one.
 */

/** A formula, set on its own. Newlines in `children` are preserved, so a scheme
 *  with a sine and a cosine line can be written as one expression. */
export function Equation({ children, label, note }) {
  return (
    <div className="ill-equation">
      {label && <span className="ill-equation-label">{label}</span>}
      <code>{children}</code>
      {note && <span className="ill-equation-note">{note}</span>}
    </div>
  )
}

/** What each symbol in the equation means, and how big it is. The shape column
 *  matters more than it looks: most confusion about a transformer is confusion
 *  about which axis something is summed over. */
export function SymbolTable({ symbols }) {
  if (!symbols?.length) return null
  return (
    <dl className="ill-symbols">
      {symbols.map((entry) => (
        <div key={entry.symbol}>
          <dt><code>{entry.symbol}</code></dt>
          <dd>
            {entry.means}
            {entry.shape && <span className="ill-symbol-shape">{entry.shape}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** The equation decomposed into the operations it is actually made of, in the
 *  order a machine would perform them. */
export function Derivation({ steps }) {
  if (!steps?.length) return null
  return (
    <ol className="ill-derivation">
      {steps.map((step, index) => (
        <li key={index}>
          <div className="ill-derivation-head">
            <span className="ill-derivation-index">{index + 1}</span>
            <h6>{step.label}</h6>
          </div>
          <code className="ill-derivation-expression">{step.expression}</code>
          {step.note && <p>{step.note}</p>}
        </li>
      ))}
    </ol>
  )
}

/* The same equation with this sentence's numbers in it.
 *
 * Rows are {label, expression, result, note}. `expression` is the substituted
 * arithmetic — the numbers, not the symbols — and `result` is what it comes to.
 * A row with no result is a statement rather than a step. */
export function Substitution({ title = 'With this example’s numbers', rows, footnote }) {
  if (!rows?.length) return null
  return (
    <div className="ill-substitution">
      <h6 className="ill-substitution-title">{title}</h6>
      <ol>
        {rows.map((row, index) => (
          <li key={index}>
            <span className="ill-sub-label">{row.label}</span>
            <code className="ill-sub-expression">{row.expression}</code>
            {row.result !== undefined && (
              <span className="ill-sub-result">= {row.result}</span>
            )}
            {row.note && <span className="ill-sub-note">{row.note}</span>}
          </li>
        ))}
      </ol>
      {footnote && <p className="ill-note">{footnote}</p>}
    </div>
  )
}

/* ── formatting helpers ──────────────────────────────────────────────────────
 * Numbers in these substitutions are read as arithmetic, so they are formatted
 * to a fixed width rather than to significant figures — a column of values that
 * change length is much harder to compare down the page. */

export const fixed = (value, places = 3) =>
  Number.isFinite(value) ? value.toFixed(places) : '—'

/** A short vector, written the way it would be typed. */
export const vector = (values, places = 2, limit = 4) => {
  if (!values?.length) return '[]'
  const shown = values.slice(0, limit).map((value) => value.toFixed(places))
  return `[${shown.join(', ')}${values.length > limit ? ', …' : ''}]`
}

/** Element-wise products written out as a sum, for showing a dot product as the
 *  addition it is. Truncated, with the remaining terms named rather than hidden. */
export const sumOfProducts = (products, total, totalTerms, places = 2) => {
  const shown = products.map((value) => value.toFixed(places)).join(' + ')
  const remaining = totalTerms - products.length
  return remaining > 0
    ? `${shown} + … (${remaining} more) = ${total.toFixed(places)}`
    : `${shown} = ${total.toFixed(places)}`
}

/** GPT-2's GELU — the tanh approximation the weights were trained against.
 *  Recomputed here so the activation panel can show the curve the number came
 *  from rather than asserting the number. */
export const gelu = (x) =>
  0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)))
