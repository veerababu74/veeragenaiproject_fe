import { useState } from 'react'

/* Colour scales.
 *
 * Attention weights and probabilities are magnitude, so they use one hue
 * light-to-dark. Embedding components and cosine similarities are signed, so
 * they use a diverging blue-red pair with a neutral grey midpoint — a hue at
 * the midpoint would make "zero" look like a value.
 */

const SEQUENTIAL = ['#eef5fe', '#cde2fb', '#9ec5f4', '#86b6ef', '#5598e7', '#3987e5',
                    '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#0d366b']

const NEGATIVE = ['#f0efec', '#cde2fb', '#9ec5f4', '#5598e7', '#2a78d6', '#184f95']
const POSITIVE = ['#f0efec', '#fbd9d7', '#f5aca9', '#ec817e', '#dc5a57', '#d03b3b']

export function sequentialColor(t) {
  if (!Number.isFinite(t) || t <= 0) return SEQUENTIAL[0]
  const index = Math.min(SEQUENTIAL.length - 1, Math.floor(t * (SEQUENTIAL.length - 1) + 0.5))
  return SEQUENTIAL[index]
}

export function divergingColor(value, max = 1) {
  const scaled = Math.min(1, Math.abs(value) / (max || 1))
  const arm = value >= 0 ? POSITIVE : NEGATIVE
  return arm[Math.min(arm.length - 1, Math.floor(scaled * (arm.length - 1) + 0.5))]
}

/* A matrix of cells. Used for attention (sequential) and for position
 * similarity (diverging). Every cell carries a hover tooltip because a heatmap
 * without one forces the reader to guess values off a colour ramp. */
export function Heatmap({ matrix, rowLabels, colLabels, diverging = false, max = 1,
                         cell = 26, caption, rowTitle, colTitle }) {
  const [hover, setHover] = useState(null)
  if (!matrix?.length) return null

  return (
    <div className="ill-heatmap-wrap">
      {caption && <p className="ill-viz-caption">{caption}</p>}
      <div className="ill-heatmap-scroll">
        <div className="ill-heatmap" style={{ '--cell': `${cell}px` }}>
          <div className="ill-heatmap-corner">{colTitle && <span>{colTitle} →</span>}</div>
          <div className="ill-heatmap-collabels">
            {colLabels.map((label, index) => (
              <span key={index} title={label}>{label}</span>
            ))}
          </div>
          <div className="ill-heatmap-rowlabels">
            {rowLabels.map((label, index) => (
              <span key={index} title={label}>{label}</span>
            ))}
          </div>
          <div className="ill-heatmap-grid"
               style={{ gridTemplateColumns: `repeat(${colLabels.length}, var(--cell))` }}>
            {matrix.map((row, rowIndex) => row.map((value, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                className={`ill-cell ${hover && hover.row === rowIndex && hover.col === colIndex ? 'active' : ''}`}
                style={{ background: diverging ? divergingColor(value, max) : sequentialColor(value / max) }}
                onMouseEnter={() => setHover({ row: rowIndex, col: colIndex, value })}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover({ row: rowIndex, col: colIndex, value })}
                onBlur={() => setHover(null)}
                aria-label={`${rowLabels[rowIndex]} to ${colLabels[colIndex]}: ${value}`}
              />
            )))}
          </div>
        </div>
      </div>
      {hover && (
        <div className="ill-tooltip" role="status">
          <strong>{rowTitle || 'row'}</strong> {rowLabels[hover.row]}
          <span className="ill-tooltip-arrow">→</span>
          <strong>{colTitle || 'col'}</strong> {colLabels[hover.col]}
          <em>{hover.value.toFixed(4)}</em>
        </div>
      )}
      <Legend diverging={diverging} max={max} />
    </div>
  )
}

function Legend({ diverging, max }) {
  const steps = diverging
    ? [-max, -max / 2, 0, max / 2, max]
    : [0, max * 0.25, max * 0.5, max * 0.75, max]
  return (
    <div className="ill-legend">
      {steps.map((value, index) => (
        <span key={index}>
          <i style={{ background: diverging ? divergingColor(value, max) : sequentialColor(value / max) }} />
          {value.toFixed(2)}
        </span>
      ))}
    </div>
  )
}

/* One vector, drawn as a strip of signed cells. This is how a 768-dimension
 * vector becomes something a reader can compare against another one. */
export function VectorStrip({ values, max, label, note }) {
  const [hover, setHover] = useState(null)
  const bound = max || Math.max(...values.map(Math.abs), 0.001)
  return (
    <div className="ill-vector">
      {label && <span className="ill-vector-label" title={label}>{label}</span>}
      <div className="ill-vector-cells">
        {values.map((value, index) => (
          <button key={index} style={{ background: divergingColor(value, bound) }}
                  className={hover === index ? 'active' : ''}
                  onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}
                  aria-label={`dimension ${index}: ${value}`} />
        ))}
      </div>
      {hover !== null
        ? <span className="ill-vector-note">dim {hover} = {values[hover].toFixed(3)}</span>
        : note && <span className="ill-vector-note">{note}</span>}
    </div>
  )
}

/* Horizontal bars for a probability distribution. Values are direct-labelled
 * because there are few enough of them that an axis would be busier than the
 * numbers themselves. */
export function ProbabilityBars({ items, max, valueKey = 'probability', labelKey = 'token' }) {
  const bound = max || Math.max(...items.map((item) => item[valueKey]), 0.0001)
  return (
    <ul className="ill-bars">
      {items.map((item, index) => (
        <li key={index}>
          <code className="ill-bar-label">{item[labelKey] === ' ' ? '␣' : item[labelKey]}</code>
          <div className="ill-bar-track">
            <div className="ill-bar-fill" style={{ width: `${(item[valueKey] / bound) * 100}%` }} />
          </div>
          <span className="ill-bar-value">{(item[valueKey] * 100).toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  )
}

/* The 12x12 grid of heads, each drawn as a thumbnail of its attention matrix.
 * Rendering 144 full heatmaps would be unreadable and slow; thumbnails make the
 * grid scannable and clicking opens the real thing. */
export function HeadGrid({ layers, patterns, selected, onSelect }) {
  return (
    <div className="ill-headgrid">
      <div className="ill-headgrid-corner" />
      {layers[0].map((_, head) => <div key={head} className="ill-headgrid-head">H{head}</div>)}
      {layers.map((heads, layer) => (
        <div className="ill-headgrid-row" key={layer} style={{ display: 'contents' }}>
          <div className="ill-headgrid-layer">L{layer}</div>
          {heads.map((matrix, head) => {
            const isSelected = selected?.layer === layer && selected?.head === head
            return (
              <button
                key={head}
                className={`ill-thumb ${isSelected ? 'selected' : ''}`}
                title={`Layer ${layer} head ${head} — ${patterns[layer][head]}`}
                onClick={() => onSelect({ layer, head })}
                style={{ gridTemplateColumns: `repeat(${matrix.length}, 1fr)` }}
              >
                {matrix.map((row, i) => row.map((value, j) => (
                  <i key={`${i}-${j}`} style={{ background: sequentialColor(value) }} />
                )))}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
