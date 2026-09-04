import { useState } from 'react'
import { ArrowRight, ChevronDown, Lightbulb, TriangleAlert } from 'lucide-react'
import { Heatmap, ProbabilityBars, VectorStrip, sequentialColor } from './viz'
import { useInsideLLMStore } from './store'

const showSpace = (text) => (text ? text.replaceAll(' ', '␣') : text)

/* ── per-component data panels ─────────────────────────────────────────────
 * Each component in the curriculum gets a panel showing what that step did to
 * this particular sentence. The explanation is the same every time; the numbers
 * beside it are not. */

function Tokenization({ example }) {
  const [piece, setPiece] = useState(0)
  const pieces = example.tokenization.pieces
  const active = pieces[Math.min(piece, pieces.length - 1)]

  return (
    <>
      <div className="ill-tokens">
        {example.tokens.map((token) => (
          <span className="ill-token" key={token.position}>
            <code>{showSpace(token.text)}</code>
            <small>{token.id}</small>
          </span>
        ))}
      </div>
      <p className="ill-note">
        {example.tokenization.total_characters} characters became{' '}
        <strong>{example.tokenization.total_tokens} tokens</strong>. The number under each token is
        its row in the 50,257-entry vocabulary.
      </p>

      <div className="ill-subhead">
        <h5>How one fragment was built</h5>
        <select value={piece} onChange={(event) => setPiece(Number(event.target.value))}>
          {pieces.map((item, index) => (
            <option key={index} value={index}>{showSpace(item.pre_token)}</option>
          ))}
        </select>
      </div>

      <div className="ill-merge">
        <div className="ill-merge-row">
          <span className="ill-merge-stage">bytes</span>
          <code>{active.bytes.join(' ')}</code>
        </div>
        <div className="ill-merge-row">
          <span className="ill-merge-stage">as symbols</span>
          <div className="ill-symbols">
            {active.start_symbols.map((symbol, index) => <code key={index}>{symbol}</code>)}
          </div>
        </div>
        {active.merges.length === 0 && (
          <p className="ill-note">No merges were needed — this fragment is already a single token.</p>
        )}
        {active.merges.map((merge, index) => (
          <div className="ill-merge-row" key={index}>
            <span className="ill-merge-stage">merge {index + 1}</span>
            <div className="ill-merge-detail">
              <code className="ill-pair">{merge.pair[0]}</code>
              <span>+</span>
              <code className="ill-pair">{merge.pair[1]}</code>
              <ArrowRight size={12} />
              <code className="ill-merged">{merge.merged}</code>
              <small>rank {merge.rank}</small>
            </div>
          </div>
        ))}
        <div className="ill-merge-row result">
          <span className="ill-merge-stage">tokens</span>
          <div className="ill-symbols">
            {active.final_symbols.map((symbol, index) => (
              <code key={index} className="ill-final">{symbol} <small>{active.token_ids[index]}</small></code>
            ))}
          </div>
        </div>
      </div>
      <p className="ill-note">
        Merges are applied strictly in rank order, and rank is training frequency — so the most
        common pair in the corpus always merges first, whatever word it appears in.
      </p>
    </>
  )
}

function Embeddings({ example }) {
  const [token, setToken] = useState(0)
  const { embeddings, tokens } = example
  const index = Math.min(token, tokens.length - 1)

  return (
    <>
      <div className="ill-subhead">
        <h5>The vector for one token</h5>
        <select value={index} onChange={(event) => setToken(Number(event.target.value))}>
          {tokens.map((item) => (
            <option key={item.position} value={item.position}>{showSpace(item.text)}</option>
          ))}
        </select>
      </div>

      <VectorStrip values={embeddings.token[index]}
                   label="token"
                   note={`first ${embeddings.dims_shown} of ${embeddings.d_model} dimensions · length ${embeddings.norms.token[index]}`} />
      <VectorStrip values={embeddings.position[index]}
                   label="position"
                   note={`position ${index} · length ${embeddings.norms.position[index]}`} />
      <VectorStrip values={embeddings.sum[index]}
                   label="sum"
                   note={`what actually enters layer 1 · length ${embeddings.norms.sum[index]}`} />

      <p className="ill-note">
        The position vector is much shorter than the token vector, so adding it nudges the meaning
        rather than overwriting it.
      </p>

      <h5 className="ill-subhead-plain">Nearest tokens in embedding space</h5>
      <div className="ill-neighbors">
        {embeddings.neighbors[index].map((neighbor) => (
          <span key={neighbor.id}>
            <code>{showSpace(neighbor.token)}</code>
            <small>{neighbor.similarity.toFixed(2)}</small>
          </span>
        ))}
      </div>
      <p className="ill-note">
        These come from the embedding table alone, with no context applied — this is what the model
        knows about the token before it reads the sentence.
      </p>
    </>
  )
}

function Positional({ positional }) {
  if (!positional) return <p className="ill-note">Loading positional data…</p>
  const size = 16
  const matrix = positional.learned.similarity.slice(0, size).map((row) => row.slice(0, size))
  const labels = Array.from({ length: size }, (_, index) => String(index))

  return (
    <>
      <Heatmap
        matrix={matrix} rowLabels={labels} colLabels={labels}
        diverging max={1} cell={22}
        rowTitle="position" colTitle="position"
        caption="Cosine similarity between GPT-2's learned position vectors, positions 0–15"
      />
      <p className="ill-note">
        Nobody specified that nearby positions should have similar vectors. The bright band along the
        diagonal is structure the model discovered on its own, because it was useful for predicting
        text.
      </p>

      <h5 className="ill-subhead-plain">The three schemes</h5>
      <div className="ill-scheme-grid">
        <div>
          <h6>Learned <small>GPT-2, BERT</small></h6>
          <VectorStrip values={positional.learned.vectors[3]} note="position 3" />
          <p>A trained table, one row per position, added to the token embedding. Simple, and cannot
             extend past the longest position it was trained on.</p>
        </div>
        <div>
          <h6>Sinusoidal <small>original Transformer</small></h6>
          <VectorStrip values={positional.sinusoidal.vectors[3]} note="position 3" />
          <p>Fixed sine and cosine waves of different frequencies. No parameters, and defined for any
             position — but the model has to learn to read it.</p>
        </div>
        <div>
          <h6>Rotary <small>LLaMA, most recent models</small></h6>
          <VectorStrip values={positional.rotary.angles[3]} note="rotation angle per dimension pair" />
          <p>Rotates pairs of dimensions by an angle proportional to position, inside attention. What
             survives the dot product is the <em>relative</em> distance between two tokens.</p>
        </div>
      </div>
    </>
  )
}

function LayerNormPanel({ example }) {
  const rows = example.mlp.layers.slice(0, 6)
  return (
    <>
      <p className="ill-note">
        Normalisation happens twice per block — before attention and before the feed-forward network
        — and it acts on each token independently, across that token's own 768 dimensions.
      </p>
      <div className="ill-formula-block">
        <code>LN(x) = γ · (x − μ) / √(σ² + ε) + β</code>
        <span>μ and σ are computed across the 768 features of one token, not across tokens.</span>
      </div>
      <p className="ill-note">
        Without it, the residual stream — which every block <em>adds</em> to — would grow without
        bound over twelve layers, and the later blocks would receive inputs on a scale nothing was
        trained for. It is unglamorous and load-bearing: {rows.length > 0 ? 'remove it and the stack does not train at all.' : ''}
      </p>
    </>
  )
}

function AttentionPanel({ example, onOpenExplorer }) {
  const worked = example.worked_example
  if (!worked) return null
  const visible = worked.keys.filter((key) => !key.masked)

  return (
    <>
      <p className="ill-note">
        Below is one head's complete computation, with the real numbers — layer {worked.layer},
        head {worked.head}, at the token <code>{showSpace(worked.query_token)}</code>.
        This head was picked automatically as the most decisive one at this position.
      </p>

      <div className="ill-worked">
        <div className="ill-worked-step">
          <span className="ill-step-number">1</span>
          <div>
            <h6>The query vector</h6>
            <VectorStrip values={worked.query_vector}
                         note={`first ${worked.dims_shown} of ${worked.head_dim} dimensions`} />
          </div>
        </div>

        <div className="ill-worked-step">
          <span className="ill-step-number">2</span>
          <div>
            <h6>Dot product against every key, then divide by √{worked.head_dim} = {worked.scale_divisor}</h6>
            <table className="ill-worked-table">
              <thead>
                <tr>
                  <th>position</th><th>token</th><th>q · k</th>
                  <th>÷ {worked.scale_divisor}</th><th>exp</th><th>probability</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((key) => (
                  <tr key={key.position} className={key.probability > 0.5 ? 'winner' : ''}>
                    <td>{key.position}</td>
                    <td><code>{showSpace(key.token)}</code></td>
                    <td>{key.dot_product.toFixed(2)}</td>
                    <td>{key.scaled.toFixed(3)}</td>
                    <td>{key.exponential.toFixed(6)}</td>
                    <td>
                      <span className="ill-prob-cell">
                        <i style={{ background: sequentialColor(key.probability), width: `${Math.max(2, key.probability * 44)}px` }} />
                        {(key.probability * 100).toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="ill-note">
              The {worked.keys.length - visible.length > 0
                ? `${worked.keys.length - visible.length} position(s) after this one are masked out — they cannot be attended to.`
                : 'causal mask has nothing to hide here: this is the last token.'}
              {' '}Dividing by √{worked.head_dim} keeps the scores from growing with dimension, which
              would push softmax into picking exactly one position every time.
            </p>
          </div>
        </div>

        <div className="ill-worked-step">
          <span className="ill-step-number">3</span>
          <div>
            <h6>Softmax: divide each exponential by their sum ({worked.exponential_sum})</h6>
            <p className="ill-note">
              The largest exponential is exactly 1 because the highest score is subtracted from every
              score before exponentiating. That shift keeps <code>exp</code> from overflowing and
              cancels out in the division, so it changes nothing about the result.
            </p>
            <p className="ill-note">
              The probabilities sum to {worked.checks.probabilities_sum.toFixed(4)}, and every masked
              position is exactly zero — both checked when this page was built.
            </p>
          </div>
        </div>

        <div className="ill-worked-step">
          <span className="ill-step-number">4</span>
          <div>
            <h6>The output: values, weighted by those probabilities</h6>
            <VectorStrip values={worked.output_vector}
                         note={`first ${worked.dims_shown} of ${worked.head_dim} dimensions` } />
            <p className="ill-note">
              That vector is what this head contributes. Twelve of them are concatenated and
              projected back to 768 dimensions, then added to the residual stream.
            </p>
          </div>
        </div>
      </div>

      <button className="ill-secondary" onClick={onOpenExplorer}>
        Explore all 144 heads <ArrowRight size={14} />
      </button>
    </>
  )
}

function MultiHeadPanel({ example, onOpenExplorer }) {
  const counts = {}
  example.attention.patterns.flat().forEach((pattern) => {
    counts[pattern] = (counts[pattern] || 0) + 1
  })
  const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1])

  return (
    <>
      <p className="ill-note">
        This input produces 144 attention patterns — 12 layers × 12 heads. Labelled by what each one
        is doing here:
      </p>
      <ProbabilityBars
        items={ordered.map(([pattern, count]) => ({ token: pattern, probability: count / 144 }))}
        max={Math.max(...ordered.map(([, count]) => count)) / 144}
      />
      <p className="ill-note">
        The labels were inferred from the matrices, not assigned during training. The same head can
        show a different pattern on a different sentence — a head is not a fixed job title.
      </p>
      <button className="ill-secondary" onClick={onOpenExplorer}>
        Open the head grid <ArrowRight size={14} />
      </button>
    </>
  )
}

function FeedForwardPanel({ example }) {
  const [layer, setLayer] = useState(6)
  const active = example.mlp.layers[Math.min(layer, example.mlp.layers.length - 1)]
  return (
    <>
      <div className="ill-subhead">
        <h5>Neuron activations at the final token</h5>
        <select value={layer} onChange={(event) => setLayer(Number(event.target.value))}>
          {example.mlp.layers.map((item) => (
            <option key={item.layer} value={item.layer}>layer {item.layer}</option>
          ))}
        </select>
      </div>
      <ProbabilityBars
        items={active.top_neurons.map((neuron) => ({
          token: `#${neuron.neuron}`, probability: Math.abs(neuron.activation),
        }))}
        max={Math.max(...active.top_neurons.map((neuron) => Math.abs(neuron.activation)))}
      />
      <p className="ill-note">
        The strongest of {active.expanded_dim} neurons. Only{' '}
        <strong>{(active.fraction_active * 100).toFixed(0)}%</strong> are active at all — the layer
        is sparse, which is part of why individual neurons can end up standing for specific things.
      </p>
    </>
  )
}

function ResidualPanel({ example }) {
  return (
    <>
      <p className="ill-note">
        Because every block only adds to the residual stream, the stream can be decoded at any depth.
        This is the model's running guess after each layer:
      </p>
      <ol className="ill-lens">
        {example.logit_lens.map((entry) => (
          <li key={entry.layer}>
            <span className="ill-lens-label">{entry.label}</span>
            <div className="ill-lens-tokens">
              {entry.top.map((prediction, index) => (
                <code key={prediction.id} className={index === 0 ? 'top' : ''}>
                  {showSpace(prediction.token)}
                  <small>{(prediction.probability * 100).toFixed(1)}%</small>
                </code>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <p className="ill-note">
        Watch where the answer appears. Early layers produce noise; the prediction usually resolves in
        the upper half of the stack and then sharpens rather than changing.
      </p>
    </>
  )
}

function OutputPanel({ example }) {
  return (
    <>
      <p className="ill-note">
        The final vector is dotted against all 50,257 token embeddings, and softmax turns those
        scores into probabilities. The top eight:
      </p>
      <ProbabilityBars items={example.prediction.top} />
      <p className="ill-note">
        Entropy is <strong>{example.prediction.entropy}</strong> nats. Low means the model is
        confident; high means it considers many continuations about equally likely. The model stops
        here — choosing one of these is sampling, and that happens outside the network.
      </p>
    </>
  )
}

/* ── the walkthrough ──────────────────────────────────────────────────────── */

export default function Walkthrough({ onOpenExplorer }) {
  const { components, example, positional } = useInsideLLMStore()
  const [open, setOpen] = useState('tokenization')

  if (!example) return null

  const panels = {
    tokenization: <Tokenization example={example} />,
    embeddings: <Embeddings example={example} />,
    positional: <Positional positional={positional} />,
    layernorm: <LayerNormPanel example={example} />,
    attention: <AttentionPanel example={example} onOpenExplorer={onOpenExplorer} />,
    multihead: <MultiHeadPanel example={example} onOpenExplorer={onOpenExplorer} />,
    feedforward: <FeedForwardPanel example={example} />,
    residual: <ResidualPanel example={example} />,
    output: <OutputPanel example={example} />,
  }

  return (
    <div className="ill-walkthrough">
      <div className="ill-example-banner">
        <div>
          <span>WHAT THIS EXAMPLE SHOWS</span>
          <h3>{example.title}</h3>
          <p>{example.teaches}</p>
        </div>
        <div className="ill-look-for">
          <Lightbulb size={14} />
          <p>{example.look_for}</p>
        </div>
      </div>

      {components.map((component) => {
        const isOpen = open === component.id
        return (
          <section className={`ill-component ${isOpen ? 'open' : ''}`} key={component.id}>
            <button className="ill-component-head" onClick={() => setOpen(isOpen ? '' : component.id)}>
              <span className="ill-component-order">{component.order}</span>
              <div>
                <h4>{component.name}</h4>
                <p>{component.tagline}</p>
              </div>
              <ChevronDown size={16} className="ill-chevron" />
            </button>

            {isOpen && (
              <div className="ill-component-body">
                <div className="ill-explain">
                  <p className="ill-summary">{component.summary}</p>

                  <h5 className="ill-subhead-plain">What happens</h5>
                  <ol className="ill-steps">
                    {component.how.map((step, index) => <li key={index}>{step}</li>)}
                  </ol>

                  <div className="ill-formula-block">
                    <code>{component.formula}</code>
                  </div>

                  <h5 className="ill-subhead-plain">Why it exists</h5>
                  <p>{component.why}</p>

                  <div className="ill-misconception">
                    <TriangleAlert size={14} />
                    <div>
                      <strong>Commonly misunderstood</strong>
                      <p>{component.misconception}</p>
                    </div>
                  </div>
                </div>

                <div className="ill-data">
                  <div className="ill-data-head">
                    <h5>On this sentence</h5>
                    <p>{component.look_at}</p>
                  </div>
                  {panels[component.id]}
                </div>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
