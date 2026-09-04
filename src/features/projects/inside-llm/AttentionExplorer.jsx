import { HeadGrid, Heatmap } from './viz'
import { useInsideLLMStore } from './store'

const showSpace = (text) => (text ? text.replaceAll(' ', '␣') : text)

export default function AttentionExplorer() {
  const { example, head, setHead } = useInsideLLMStore()
  if (!example) return null

  const { layers, patterns, entropy } = example.attention
  const matrix = layers[head.layer][head.head]
  const labels = example.tokens.map((token) => showSpace(token.text))

  // The strongest link this head makes, which is usually the whole story of
  // what it is for.
  let strongest = { from: 0, to: 0, value: 0 }
  matrix.forEach((row, from) => row.forEach((value, to) => {
    if (from > 0 && to > 0 && value > strongest.value) strongest = { from, to, value }
  }))

  return (
    <div className="ill-explorer">
      <aside className="ill-explorer-grid">
        <h4>All 144 heads</h4>
        <p className="ill-note">
          12 layers down, 12 heads across. Each thumbnail is that head's attention matrix on this
          sentence — brighter means more weight.
        </p>
        <HeadGrid layers={layers} patterns={patterns} selected={head} onSelect={setHead} />
      </aside>

      <section className="ill-explorer-detail">
        <header>
          <div>
            <h4>Layer {head.layer}, head {head.head}</h4>
            <p>
              <span className="ill-pattern-tag">{patterns[head.layer][head.head]}</span>
              <span className="ill-muted">entropy {entropy[head.layer][head.head]}</span>
            </p>
          </div>
        </header>

        <Heatmap
          matrix={matrix}
          rowLabels={labels}
          colLabels={labels}
          max={1}
          cell={Math.max(20, Math.min(44, Math.floor(340 / labels.length)))}
          rowTitle="query"
          colTitle="key"
          caption="Row = the token doing the looking. Column = the token being looked at. Rows sum to 1."
        />

        <div className="ill-explorer-read">
          <h5>Reading this head</h5>
          <p>
            The strongest link is <code>{labels[strongest.from]}</code> attending to{' '}
            <code>{labels[strongest.to]}</code> at{' '}
            <strong>{(strongest.value * 100).toFixed(1)}%</strong>
            {strongest.to === strongest.from - 1 && ' — that is the immediately preceding token.'}
            {strongest.to < strongest.from - 1 && strongest.to > 0 &&
              ` — reaching back ${strongest.from - strongest.to} positions rather than to its neighbour.`}
          </p>
          <p className="ill-note">
            The upper-right triangle is always empty. That is the causal mask: a token predicting
            what comes next is not allowed to see it. Heavy weight on the first column usually means
            the head is idling — dumping attention on the first token when it has nothing to do is a
            well-documented habit, sometimes called an attention sink.
          </p>
        </div>
      </section>
    </div>
  )
}
