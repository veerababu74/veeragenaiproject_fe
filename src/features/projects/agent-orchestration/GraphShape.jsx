/* The shape of a graph, drawn small.
 *
 * The four orchestration modes are the whole idea of this project, and on a card
 * they were reduced to a coloured word. But the difference between them is
 * genuinely *shape* — a hub, a chain, a fan, a branch — and a picture says it
 * instantly where "sequential" only says it to someone who already knows.
 *
 * Supervisor and parallel share a topology and differ in behaviour, so they are
 * drawn differently on purpose: supervisor shows one chosen path bright and the
 * rest faded, because the lead picks; parallel shows every path equally lit,
 * because they all run. That distinction is the one people most often miss.
 */

const W = 168
const H = 92

function Node({ x, y, lead, dim, label }) {
  return (
    <g className={`gs-node ${lead ? 'lead' : ''} ${dim ? 'dim' : ''}`}>
      <circle cx={x} cy={y} r={lead ? 9 : 6.5} />
      {label && <text x={x} y={y + (lead ? 21 : 18)} textAnchor="middle">{label}</text>}
    </g>
  )
}

export default function GraphShape({ mode, workers = 3 }) {
  const count = Math.max(2, Math.min(4, workers))
  const leadX = 26
  const leadY = H / 2
  const workerX = W - 30
  // Spread the workers evenly down the right-hand side.
  const spread = count === 2 ? 26 : count === 3 ? 24 : 20
  const workerY = (index) => leadY + (index - (count - 1) / 2) * spread * 1.5

  const paths = Array.from({ length: count }, (_, index) => {
    const y = workerY(index)
    return `M ${leadX + 10} ${leadY} C ${leadX + 55} ${leadY}, ${workerX - 55} ${y}, ${workerX - 8} ${y}`
  })

  if (mode === 'sequential') {
    // A chain: every stage feeds the next, left to right.
    const stages = Math.max(3, Math.min(4, workers + 1))
    const gap = (W - 34) / (stages - 1)
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="gs" role="img" aria-label="a chain of agents">
        {Array.from({ length: stages - 1 }, (_, index) => (
          <line key={index} className="gs-edge lit"
                x1={17 + gap * index + 8} y1={leadY}
                x2={17 + gap * (index + 1) - 8} y2={leadY} />
        ))}
        {Array.from({ length: stages }, (_, index) => (
          <Node key={index} x={17 + gap * index} y={leadY} lead={index === 0} />
        ))}
        <text className="gs-caption" x={W / 2} y={H - 12} textAnchor="middle">
          each one feeds the next
        </text>
      </svg>
    )
  }

  if (mode === 'conditional') {
    // A branch: one route matches, the others do not fire.
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="gs" role="img" aria-label="a routing branch">
        {paths.map((d, index) => (
          <path key={index} d={d} className={`gs-edge ${index === 1 ? 'lit' : 'faint'}`} />
        ))}
        {paths.map((_, index) => (
          <text key={index} className={`gs-cond ${index === 1 ? 'lit' : ''}`}
                x={W / 2 + 4} y={workerY(index) - 4} textAnchor="middle">
            {index === 1 ? '✓' : 'if…'}
          </text>
        ))}
        <Node x={leadX} y={leadY} lead />
        {Array.from({ length: count }, (_, index) => (
          <Node key={index} x={workerX} y={workerY(index)} dim={index !== 1} />
        ))}
        <text className="gs-caption" x={W / 2} y={H - 6} textAnchor="middle">
          one route matches
        </text>
      </svg>
    )
  }

  // supervisor and parallel share this topology and differ in what lights up.
  const chosen = 1
  const supervisor = mode === 'supervisor'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="gs" role="img"
         aria-label={supervisor ? 'a lead choosing one specialist' : 'a lead asking everyone at once'}>
      {paths.map((d, index) => (
        <path key={index} d={d}
              className={`gs-edge ${supervisor ? (index === chosen ? 'lit' : 'faint') : 'lit'}`}
              style={supervisor ? undefined : { animationDelay: `${index * 120}ms` }} />
      ))}
      <Node x={leadX} y={leadY} lead />
      {Array.from({ length: count }, (_, index) => (
        <Node key={index} x={workerX} y={workerY(index)}
              dim={supervisor && index !== chosen} />
      ))}
      <text className="gs-caption" x={W / 2} y={H - 6} textAnchor="middle">
        {supervisor ? 'it picks who to ask' : 'all at once'}
      </text>
    </svg>
  )
}
