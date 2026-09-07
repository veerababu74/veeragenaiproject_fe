import { useState } from 'react'
import { ArrowRight, ChevronDown, Lightbulb, Sigma, TriangleAlert } from 'lucide-react'
import { Heatmap, ProbabilityBars, VectorStrip, sequentialColor } from './viz'
import { Derivation, Equation, Substitution, SymbolTable, fixed, gelu, sumOfProducts, vector } from './math'
import { useInsideLLMStore } from './store'

const showSpace = (text) => (text ? text.replaceAll(' ', '␣') : text)

/* ── per-component data panels ─────────────────────────────────────────────
 * Each component in the curriculum gets a panel showing what that step did to
 * this particular sentence. The explanation is the same every time; the numbers
 * beside it are not.
 *
 * Every panel ends in a `Substitution` — the component's own equation with this
 * example's values in it. That is the part that makes the formula above it
 * checkable rather than decorative, so a panel without one is a panel that has
 * not finished explaining itself. */

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
          <div className="ill-symbols-row">
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
          <div className="ill-symbols-row">
            {active.final_symbols.map((symbol, index) => (
              <code key={index} className="ill-final">{symbol} <small>{active.token_ids[index]}</small></code>
            ))}
          </div>
        </div>
      </div>

      <Substitution
        title={`The merge rule, on “${showSpace(active.pre_token)}”`}
        rows={[
          { label: 'start', expression: `symbols = [${active.start_symbols.join(', ')}]`,
            result: `${active.start_symbols.length} symbols` },
          ...active.merges.map((merge, index) => ({
            label: `argmin rank`,
            expression: `rank(${merge.pair[0]}, ${merge.pair[1]}) = ${merge.rank}  →  ${merge.merged}`,
            note: index === 0 && active.merges.length > 1
              ? 'lowest rank available, so it goes first' : undefined,
          })),
          { label: 'look up', expression: `V[${active.final_symbols.join('], V[')}]`,
            result: active.token_ids.join(', ') },
        ]}
        footnote="Rank is training frequency, so the most common pair in the corpus always merges
                  first — whatever word it happens to appear in."
      />
    </>
  )
}

function Embeddings({ example }) {
  const [token, setToken] = useState(0)
  const { embeddings, tokens } = example
  const index = Math.min(token, tokens.length - 1)
  const neighbors = embeddings.neighbors[index]
  const closest = neighbors[0]

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

      <Substitution
        title="Why adding position does not destroy meaning"
        rows={[
          { label: 'token', expression: `‖W_E[${tokens[index].id}]‖`,
            result: embeddings.norms.token[index] },
          { label: 'position', expression: `‖W_P[${index}]‖`,
            result: embeddings.norms.position[index] },
          { label: 'sum', expression: `‖W_E[${tokens[index].id}] + W_P[${index}]‖`,
            result: embeddings.norms.sum[index] },
        ]}
        footnote="The two vectors are nearly perpendicular, which is why the sum's length is close to
                  the root of the sum of squares rather than to either part alone. In 768 dimensions
                  almost any two learned vectors are."
      />

      <h5 className="ill-subhead-plain">Nearest tokens in embedding space</h5>
      <div className="ill-neighbors">
        {neighbors.map((neighbor) => (
          <span key={neighbor.id}>
            <code>{showSpace(neighbor.token)}</code>
            <small>{neighbor.similarity.toFixed(2)}</small>
          </span>
        ))}
      </div>

      {closest?.dot !== undefined && (
        <Substitution
          title={`The cosine behind the closest one, ${showSpace(closest.token)}`}
          rows={[
            { label: 'dot', expression: `W_E[${tokens[index].id}] · W_E[${closest.id}]`,
              result: closest.dot },
            { label: 'lengths', expression: `‖e₁‖ ‖e₂‖ = ${closest.query_norm} × ${closest.norm}`,
              result: fixed(closest.query_norm * closest.norm, 2) },
            { label: 'divide', expression: `${closest.dot} / ${fixed(closest.query_norm * closest.norm, 2)}`,
              result: closest.similarity.toFixed(3) },
          ]}
          footnote="These come from the embedding table alone, with no context applied — this is what
                    the model knows about the token before it reads the sentence."
        />
      )}
    </>
  )
}

function Positional({ positional }) {
  if (!positional) return <p className="ill-note">Loading positional data…</p>
  const size = 16
  const matrix = positional.learned.similarity.slice(0, size).map((row) => row.slice(0, size))
  const labels = Array.from({ length: size }, (_, index) => String(index))

  // Recomputed here rather than read from the payload: the sinusoidal scheme is
  // a closed form with no learned parameters, so evaluating it in the browser is
  // exact, and showing the evaluation is the point of the panel.
  const position = 3
  const dimensions = 64
  const angle = (i) => position / 10000 ** ((2 * i) / dimensions)

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

      <Substitution
        title="The sinusoidal formula, evaluated at position 3"
        rows={[0, 1, 8].map((i) => ({
          label: `dims ${2 * i}, ${2 * i + 1}`,
          expression: `sin(3 / 10000^(${2 * i}/64)) = sin(${fixed(angle(i), 4)})`,
          result: `${fixed(Math.sin(angle(i)), 4)}, cos → ${fixed(Math.cos(angle(i)), 4)}`,
        }))}
        footnote="The divisor grows with the dimension index, so early pairs cycle quickly and later
                  pairs barely move across the whole sequence. That spread of wavelengths is what
                  lets a fixed formula encode any position distinguishably."
      />

      <Substitution
        title="Why rotary encodes distance rather than position"
        rows={[
          { label: 'rotate', expression: 'q at position m turns by mθ,  k at position n turns by nθ' },
          { label: 'dot', expression: 'R(mθ)q · R(nθ)k = q · R((n − m)θ) k',
            note: 'rotation is orthogonal, so it drops out of the product' },
          { label: 'result', expression: 'the score depends on (n − m) alone',
            result: 'relative distance' },
        ]}
        footnote="This is the reason RoPE extends past its trained context length far better than a
                  learned table: it never had to memorise position 4000 in the first place."
      />
    </>
  )
}

function LayerNormPanel({ example }) {
  const normalisation = example.layernorm
  if (!normalisation) return <p className="ill-note">Normalisation statistics are not in this payload.</p>

  const shown = normalisation.dims_shown
  const drift = normalisation.drift

  return (
    <>
      <p className="ill-note">
        Normalisation happens twice per block — before attention and before the feed-forward network
        — and it acts on each token independently, across that token's own {normalisation.d_model}{' '}
        dimensions. Below is the one at {normalisation.site}, on the token{' '}
        <code>{showSpace(normalisation.token)}</code>.
      </p>

      <div className="ill-lnrow">
        <VectorStrip values={normalisation.input} label="x"
                     note={`first ${shown} of ${normalisation.d_model} · length ${normalisation.input_norm}`} />
        <VectorStrip values={normalisation.centred} label="x − μ" note="mean removed" />
        <VectorStrip values={normalisation.normalised} label="x̂" note="divided by the deviation" />
        <VectorStrip values={normalisation.output} label="γx̂ + β"
                     note={`rescaled · length ${normalisation.output_norm}`} />
      </div>

      <Substitution
        rows={[
          { label: 'mean', expression: `μ = (1/${normalisation.d_model}) Σ xᵢ`,
            result: normalisation.mean },
          { label: 'variance', expression: `σ² = (1/${normalisation.d_model}) Σ (xᵢ − μ)²`,
            result: normalisation.variance },
          { label: 'deviation', expression: `√(${normalisation.variance} + ${normalisation.eps})`,
            result: normalisation.std },
          { label: 'first dim', expression: `(${normalisation.input[0]} − ${normalisation.mean}) / ${normalisation.std}`,
            result: normalisation.normalised[0], note: 'x̂₀' },
          { label: 'rescale', expression: `${normalisation.gamma[0]} × ${normalisation.normalised[0]} + ${normalisation.beta[0]}`,
            result: normalisation.output[0], note: 'γ₀x̂₀ + β₀' },
        ]}
        footnote={`Checked on the full vector, not the six dimensions shown: x̂ has mean
                   ${normalisation.checks.normalised_mean} and standard deviation
                   ${normalisation.checks.normalised_std}, which is what "normalised" is asserting.`}
      />

      <h5 className="ill-subhead-plain">Why it has to run before every block</h5>
      <div className="ill-table-scroll">
        <table className="ill-worked-table">
          <thead>
            <tr><th>layer</th><th>‖residual‖</th><th>σ before attention</th><th>σ before the MLP</th></tr>
          </thead>
          <tbody>
            {drift.map((entry) => (
              <tr key={entry.layer}>
                <td>{entry.layer}</td>
                <td><strong>{entry.residual_norm}</strong></td>
                <td>{entry.ln1_std}</td>
                <td>{entry.ln2_std}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ill-note">
        The residual stream grows from {drift[0].residual_norm} to{' '}
        <strong>{drift[drift.length - 1].residual_norm}</strong> over twelve layers — a factor of{' '}
        {(drift[drift.length - 1].residual_norm / drift[0].residual_norm).toFixed(0)}. Every block
        adds to it and nothing divides it down, so without a normalisation step in front, each block
        would receive inputs on a scale that nothing was trained for. This is the unglamorous,
        load-bearing part: remove it and the stack does not train at all.
      </p>
    </>
  )
}

function AttentionPanel({ example, onOpenExplorer }) {
  const worked = example.worked_example
  if (!worked) return null
  const visible = worked.keys.filter((key) => !key.masked)
  const winner = visible.reduce((best, key) => (key.probability > best.probability ? key : best), visible[0])
  const masked = worked.keys.length - visible.length

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
            <div className="ill-table-scroll">
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
            </div>
            <p className="ill-note">
              {masked > 0
                ? `The ${masked} position(s) after this one are masked out — they cannot be attended to.`
                : 'The causal mask has nothing to hide here: this is the last token.'}
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
                         note={`first ${worked.dims_shown} of ${worked.head_dim} dimensions`} />
            <p className="ill-note">
              That vector is what this head contributes. Twelve of them are concatenated and
              projected back to 768 dimensions, then added to the residual stream.
            </p>
          </div>
        </div>
      </div>

      {winner && (
        <Substitution
          title={`Every step, for the position this head chose — ${showSpace(winner.token)}`}
          rows={[
            ...(winner.products ? [{
              label: 'dot product',
              expression: sumOfProducts(winner.products, winner.partial_sum, worked.head_dim),
              note: `the first ${worked.dims_shown} of ${worked.head_dim} terms; all ${worked.head_dim} give ${winner.dot_product}`,
            }] : []),
            { label: 'scale', expression: `${winner.dot_product} / ${worked.scale_divisor}`,
              result: winner.scaled },
            { label: 'shift', expression: `exp(${winner.scaled} − ${Math.max(...visible.map((key) => key.scaled))})`,
              result: winner.exponential, note: 'the row maximum is subtracted first' },
            { label: 'normalise', expression: `${winner.exponential} / ${worked.exponential_sum}`,
              result: (winner.probability * 100).toFixed(2) + '%' },
            { label: 'mix', expression: `o = Σⱼ aⱼ vⱼ = ${vector(worked.output_vector)}`,
              note: `weighted average of ${visible.length} value vectors` },
          ]}
        />
      )}

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
  const { layers, heads, d_model: width, head_dim: headDim } = example.model

  return (
    <>
      <p className="ill-note">
        This input produces {layers * heads} attention patterns — {layers} layers × {heads} heads.
        Labelled by what each one is doing here:
      </p>
      <ProbabilityBars
        items={ordered.map(([pattern, count]) => ({ token: pattern, probability: count / (layers * heads) }))}
        max={Math.max(...ordered.map(([, count]) => count)) / (layers * heads)}
      />
      <p className="ill-note">
        The labels were inferred from the matrices, not assigned during training. The same head can
        show a different pattern on a different sentence — a head is not a fixed job title.
      </p>

      <Substitution
        title="What the split actually costs"
        rows={[
          { label: 'per head', expression: `d_k = ${width} / ${heads}`, result: headDim },
          { label: 'scaling', expression: `√d_k = √${headDim}`, result: Math.sqrt(headDim),
            note: 'the divisor in every score above' },
          { label: 'total width', expression: `${heads} × ${headDim}`, result: width,
            note: 'the same arithmetic as one head of 768, rearranged' },
          { label: 'patterns', expression: `${layers} layers × ${heads} heads`,
            result: layers * heads, note: 'all of them shown in the grid' },
        ]}
        footnote="Splitting is free. Twelve heads of 64 dimensions multiply out to exactly the same
                  cost as one head of 768 — what changes is that each head gets its own projection
                  weights, and so can attend to something different."
      />

      <button className="ill-secondary" onClick={onOpenExplorer}>
        Open the head grid <ArrowRight size={14} />
      </button>
    </>
  )
}

function FeedForwardPanel({ example }) {
  const [layer, setLayer] = useState(6)
  const active = example.mlp.layers[Math.min(layer, example.mlp.layers.length - 1)]
  const strongest = active.top_neurons[0]

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

      {strongest?.pre_activation !== undefined && (
        <>
          <Substitution
            title={`GELU, applied to the hardest-firing neuron (#${strongest.neuron})`}
            rows={[
              { label: 'before', expression: `h = (x W₁ + b₁)[${strongest.neuron}]`,
                result: strongest.pre_activation },
              { label: 'inner', expression: `√(2/π) (h + 0.044715 h³)`,
                result: fixed(Math.sqrt(2 / Math.PI) * (strongest.pre_activation + 0.044715 * strongest.pre_activation ** 3)) },
              { label: 'gelu', expression: `0.5 × ${strongest.pre_activation} × (1 + tanh(…))`,
                result: fixed(gelu(strongest.pre_activation)),
                note: `the payload records ${strongest.activation}` },
            ]}
          />

          <h5 className="ill-subhead-plain">What GELU does to each of the top neurons</h5>
          <div className="ill-table-scroll">
            <table className="ill-worked-table">
              <thead>
                <tr><th>neuron</th><th>h (before)</th><th>GELU(h)</th><th>change</th></tr>
              </thead>
              <tbody>
                {active.top_neurons.map((neuron) => {
                  const delta = neuron.activation - neuron.pre_activation
                  return (
                    <tr key={neuron.neuron}>
                      <td>#{neuron.neuron}</td>
                      <td>{neuron.pre_activation}</td>
                      <td>{neuron.activation}</td>
                      <td className={delta < 0 ? 'ill-down' : 'ill-up'}>
                        {delta >= 0 ? '+' : ''}{delta.toFixed(3)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="ill-note">
            Read the last column: large positive values are barely touched, while negative ones are
            pulled towards zero without ever quite reaching it. That gentle, non-zero treatment of
            negatives is the whole difference between GELU and ReLU, and it is why gradients keep
            flowing through neurons that are currently off.
          </p>
        </>
      )}
    </>
  )
}

function ResidualPanel({ example }) {
  const residual = example.residual

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

      {residual && (
        <>
          <Substitution
            title={`The addition itself, at layer 0 on ${showSpace(residual.token)}`}
            rows={[
              { label: 'x', expression: vector(residual.worked.x, 3, 6), note: 'the stream arriving' },
              { label: 'Attn(LN(x))', expression: vector(residual.worked.attention_out, 3, 6),
                note: 'what the block wrote' },
              { label: 'x + Attn', expression: vector(residual.worked.sum, 3, 6),
                note: 'element-wise, nothing replaced' },
            ]}
            footnote="Add the first entries by hand and they match. That is all a residual connection
                      is — the block's output is summed into its own input, not substituted for it."
          />

          <h5 className="ill-subhead-plain">How much each block contributes</h5>
          <div className="ill-table-scroll">
            <table className="ill-worked-table">
              <thead>
                <tr>
                  <th>layer</th><th>‖x‖ in</th><th>‖Attn‖</th><th>‖FFN‖</th>
                  <th>‖x‖ out</th><th>cos(in, out)</th>
                </tr>
              </thead>
              <tbody>
                {residual.layers.map((entry) => (
                  <tr key={entry.layer}>
                    <td>{entry.layer}</td>
                    <td>{entry.in_norm}</td>
                    <td>{entry.attention_norm}</td>
                    <td>{entry.mlp_norm}</td>
                    <td><strong>{entry.out_norm}</strong></td>
                    <td>
                      <span className="ill-prob-cell">
                        <i style={{ background: sequentialColor(Math.max(0, entry.direction_cosine)),
                                    width: `${Math.max(2, Math.abs(entry.direction_cosine) * 44)}px` }} />
                        {entry.direction_cosine}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ill-note">
            The last column is the cosine between the stream entering a block and the stream leaving
            it. Early blocks rewrite the direction almost completely; later ones leave it nearly
            unchanged and only adjust the magnitude. The stack is not twelve equal steps — the early
            layers decide roughly what the vector is about, and the late ones refine it.
          </p>
        </>
      )}
    </>
  )
}

function OutputPanel({ example }) {
  const { prediction } = example
  const top = prediction.top[0]
  const second = prediction.top[1]
  const unembedding = prediction.unembedding

  return (
    <>
      <p className="ill-note">
        The final vector is dotted against all {prediction.vocab?.toLocaleString() || '50,257'} token
        embeddings, and softmax turns those scores into probabilities. The top eight:
      </p>
      <ProbabilityBars items={prediction.top} />

      {unembedding && (
        <Substitution
          title={`The logit for the winner, ${showSpace(top.token)}`}
          rows={[
            { label: 'lengths', expression: `‖z‖ = ${unembedding.final_norm},  ‖W_E[${unembedding.id}]‖ = ${unembedding.embedding_norm}` },
            { label: 'angle', expression: `cos θ`, result: unembedding.cosine },
            { label: 'logit', expression: `${unembedding.final_norm} × ${unembedding.embedding_norm} × ${unembedding.cosine}`,
              result: unembedding.logit,
              note: 'the dot product of the final vector with this token’s input embedding' },
          ]}
          footnote="Because GPT-2 ties its output weights to the input table, a token wins exactly
                    when the final vector points the way that token's own embedding points. The
                    scores are large and negative here; only their differences matter, because
                    softmax subtracts the maximum before exponentiating."
        />
      )}

      {top.logit !== undefined && (
        <Substitution
          title="Softmax over the whole vocabulary"
          rows={[
            { label: 'shift', expression: `ℓ − max ℓ = ${top.logit} − ${prediction.max_logit}`,
              result: fixed(top.logit - prediction.max_logit) },
            { label: 'exponentiate', expression: `exp(${fixed(top.logit - prediction.max_logit)})`,
              result: top.exp_shifted },
            { label: 'partition', expression: `Z = Σ over ${prediction.vocab?.toLocaleString()} tokens`,
              result: prediction.partition,
              note: 'every token in the vocabulary contributes to this sum' },
            { label: 'divide', expression: `${top.exp_shifted} / ${prediction.partition}`,
              result: `${(top.probability * 100).toFixed(2)}%` },
            ...(second?.logit !== undefined ? [{
              label: 'runner-up',
              expression: `${second.exp_shifted} / ${prediction.partition}`,
              result: `${(second.probability * 100).toFixed(2)}%`,
              note: `${fixed(top.logit - second.logit, 2)} of logit separates first from second`,
            }] : []),
          ]}
        />
      )}

      <p className="ill-note">
        Entropy is <strong>{prediction.entropy}</strong> nats, against a maximum of{' '}
        {Math.log(prediction.vocab || 50257).toFixed(1)} if every token were equally likely. Low
        means the model is confident; high means it considers many continuations about equally so.
        The model stops here — choosing one of these is sampling, and that happens outside the
        network.
      </p>
    </>
  )
}

/* ── the walkthrough ──────────────────────────────────────────────────────── */

/* Which panel belongs to which component.
 *
 * Exported because the accordion renders only the panel that is open, so this
 * mapping is the only way to reach the other eight — for a deep link, or for a
 * check that every panel survives every example. */
export function buildPanels(example, positional, onOpenExplorer) {
  return {
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
}

export default function Walkthrough({ onOpenExplorer }) {
  const { components, example, positional } = useInsideLLMStore()
  const [open, setOpen] = useState('tokenization')

  if (!example) return null

  const panels = buildPanels(example, positional, onOpenExplorer)

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

                  <h5 className="ill-subhead-plain ill-math-head">
                    <Sigma size={13} /> The mathematics
                  </h5>
                  <Equation>{component.formula}</Equation>
                  <SymbolTable symbols={component.symbols} />
                  <Derivation steps={component.derivation} />

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
