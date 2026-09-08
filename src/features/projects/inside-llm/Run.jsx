import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { VectorStrip } from './viz'
import { Equation } from './math'
import { useInsideLLMStore } from './store'

/* The forward pass as one continuous run.
 *
 * The component walkthrough answers "what does attention do?" nine times over,
 * each time with a different slice of a different thing. It never answers the
 * question a reader actually starts with: what happened to this vector, and
 * then what happened next?
 *
 * So this is the same numbers arranged as a sequence. Seventy-six steps from a
 * token ID to a probability distribution, and the output vector of every step is
 * the input vector of the next one — which is the property that makes it a chain
 * rather than a gallery. Play walks it; the arrows step it; the rail jumps it.
 */

const showSpace = (text) => (text ? text.replaceAll(' ', '␣') : text)

/* ── turning the payload into a sequence ─────────────────────────────────── */

function buildSteps(trace) {
  const steps = []
  const { embedding, layers, final_norm: finalNorm, output } = trace

  steps.push({
    id: 'lookup',
    phase: 'in',
    title: 'Look up the token',
    subtitle: `token ${showSpace(trace.token)} at position ${trace.position}`,
    equation: 'e = W_E[t]',
    input: { label: 'token ID', scalar: trace.token_id },
    output: { label: 'e — the token embedding', values: embedding.token, norm: embedding.token_norm },
    facts: [
      { key: 'table', value: '50257 × 768' },
      { key: 'operation', value: 'row lookup, no arithmetic' },
    ],
    note: 'One row of the embedding table, copied out. The same vector every time this token '
        + 'appears, whatever the sentence around it says.',
  })

  steps.push({
    id: 'position',
    phase: 'in',
    title: 'Add the position',
    subtitle: `position ${trace.position}`,
    equation: 'x₀ = W_E[t] + W_P[pos]',
    input: { label: 'e', values: embedding.token, norm: embedding.token_norm },
    added: { label: 'W_P[pos]', values: embedding.position, norm: embedding.position_norm },
    output: { label: 'x₀ — what enters layer 0', values: embedding.sum, norm: embedding.sum_norm },
    facts: [
      { key: '‖token‖', value: embedding.token_norm },
      { key: '‖position‖', value: embedding.position_norm },
      { key: '‖sum‖', value: embedding.sum_norm },
    ],
    prediction: embedding.prediction,
    note: 'Element-wise addition. The position vector is the shorter of the two, so it nudges the '
        + 'meaning rather than replacing it.',
  })

  layers.forEach((layer) => {
    const tag = `layer ${layer.layer}`

    steps.push({
      id: `l${layer.layer}-ln1`,
      phase: 'layer', layer: layer.layer, stage: 'ln1',
      title: 'Normalise',
      subtitle: `${tag} · before attention`,
      equation: 'x̂ = γ (x − μ) / √(σ² + ε) + β',
      input: { label: 'x — the residual stream', values: layer.in, norm: layer.in_norm },
      output: { label: 'x̂ — normalised', values: layer.ln1.output, norm: layer.ln1.output_norm },
      facts: [
        { key: 'μ', value: layer.ln1.mean },
        { key: 'σ', value: layer.ln1.std },
        { key: '‖in‖ → ‖out‖', value: `${layer.in_norm} → ${layer.ln1.output_norm}` },
      ],
      note: 'Computed across this token’s own 768 features. Note that the stream itself is not '
          + 'changed — the block reads a normalised copy and the original carries on.',
    })

    steps.push({
      id: `l${layer.layer}-attn`,
      phase: 'layer', layer: layer.layer, stage: 'attn',
      title: 'Attention reads from other positions',
      subtitle: `${tag} · head ${layer.attention.head} was the most focused`,
      equation: 'oᵢ = Σⱼ softmax(qᵢ·kⱼ / √d_k + mask)ⱼ vⱼ',
      input: { label: 'x̂', values: layer.ln1.output, norm: layer.ln1.output_norm },
      output: {
        label: 'what attention wrote', values: layer.attention.output,
        norm: layer.attention.output_norm,
      },
      facts: [
        { key: 'reads from', value: `${showSpace(layer.attention.source_token)} @ ${layer.attention.source_position}` },
        { key: 'weight', value: `${(layer.attention.weight * 100).toFixed(1)}%` },
        { key: 'head entropy', value: `${layer.attention.entropy} nats` },
      ],
      note: `Of the 12 heads in this layer, head ${layer.attention.head} put the most weight on a `
          + `single position: ${(layer.attention.weight * 100).toFixed(1)}% on `
          + `${showSpace(layer.attention.source_token)}. This is the only step where information `
          + 'crosses between tokens.',
    })

    steps.push({
      id: `l${layer.layer}-add1`,
      phase: 'layer', layer: layer.layer, stage: 'add1',
      title: 'Add it back to the stream',
      subtitle: `${tag} · residual connection`,
      equation: 'x′ = x + Attn(x̂)',
      input: { label: 'x', values: layer.in, norm: layer.in_norm },
      added: {
        label: 'Attn(x̂)', values: layer.attention.output, norm: layer.attention.output_norm,
      },
      output: {
        label: 'x′', values: layer.after_attention, norm: layer.after_attention_norm,
      },
      facts: [
        { key: '‖stream‖', value: `${layer.in_norm} → ${layer.after_attention_norm}` },
        { key: '‖written‖', value: layer.attention.output_norm },
      ],
      note: 'Added, not substituted. Add the first few numbers of the two rows above and you get '
          + 'the third — that is the whole of what a residual connection is.',
    })

    steps.push({
      id: `l${layer.layer}-ln2`,
      phase: 'layer', layer: layer.layer, stage: 'ln2',
      title: 'Normalise again',
      subtitle: `${tag} · before the feed-forward block`,
      equation: 'x̂′ = γ₂ (x′ − μ) / √(σ² + ε) + β₂',
      input: { label: 'x′', values: layer.after_attention, norm: layer.after_attention_norm },
      output: { label: 'x̂′', values: layer.ln2.output, norm: layer.ln2.output_norm },
      facts: [
        { key: 'μ', value: layer.ln2.mean },
        { key: 'σ', value: layer.ln2.std },
      ],
      note: 'The second of the two normalisations in every block, with its own learned γ and β.',
    })

    steps.push({
      id: `l${layer.layer}-mlp`,
      phase: 'layer', layer: layer.layer, stage: 'mlp',
      title: 'The feed-forward block thinks',
      subtitle: `${tag} · 768 → ${layer.mlp.expanded_dim} → 768`,
      equation: 'FFN(x) = GELU(x W₁ + b₁) W₂ + b₂',
      input: { label: 'x̂′', values: layer.ln2.output, norm: layer.ln2.output_norm },
      output: { label: 'what the MLP wrote', values: layer.mlp.output, norm: layer.mlp.output_norm },
      facts: [
        { key: 'loudest neuron', value: `#${layer.mlp.neuron}` },
        { key: 'GELU', value: `${layer.mlp.pre_activation} → ${layer.mlp.activation}` },
        { key: 'active', value: `${(layer.mlp.fraction_active * 100).toFixed(0)}% of ${layer.mlp.expanded_dim}` },
      ],
      note: `Widened to ${layer.mlp.expanded_dim}, passed through GELU, and projected back. Only `
          + `${(layer.mlp.fraction_active * 100).toFixed(0)}% of the neurons are active at all, `
          + 'which is part of why single neurons can end up standing for specific things.',
    })

    steps.push({
      id: `l${layer.layer}-add2`,
      phase: 'layer', layer: layer.layer, stage: 'add2',
      title: 'Add that back too',
      subtitle: `${tag} · leaving the block`,
      equation: 'xₙ₊₁ = x′ + FFN(x̂′)',
      input: { label: 'x′', values: layer.after_attention, norm: layer.after_attention_norm },
      added: { label: 'FFN(x̂′)', values: layer.mlp.output, norm: layer.mlp.output_norm },
      output: { label: `x — into layer ${layer.layer + 1}`, values: layer.out, norm: layer.out_norm },
      facts: [
        { key: '‖stream‖', value: `${layer.in_norm} → ${layer.out_norm}` },
        { key: 'best guess now', value: showSpace(layer.prediction.token) },
      ],
      prediction: layer.prediction,
      note: 'The block is finished. The stream leaves longer than it arrived, which is why the '
          + 'next block normalises before reading it.',
    })
  })

  steps.push({
    id: 'final-norm',
    phase: 'out',
    title: 'One last normalisation',
    subtitle: 'after all twelve layers',
    equation: 'z = LN_f(x₁₂)',
    input: {
      label: 'x₁₂', values: layers[layers.length - 1].out,
      norm: layers[layers.length - 1].out_norm,
    },
    output: { label: 'z', values: finalNorm.output, norm: finalNorm.output_norm },
    facts: [
      { key: 'μ', value: finalNorm.mean },
      { key: 'σ', value: finalNorm.std },
    ],
    note: 'The stream grew from a length of a few units to several hundred across the stack. This '
        + 'brings it back to a scale the output projection was trained for.',
  })

  steps.push({
    id: 'unembed',
    phase: 'out',
    title: 'Score every token, then softmax',
    subtitle: '50,257 dot products',
    equation: 'ℓᵥ = z · W_E[v],   P(v) = exp(ℓᵥ − max ℓ) / Z',
    input: { label: 'z', values: finalNorm.output, norm: finalNorm.output_norm },
    output: { label: 'a distribution over the vocabulary', predictions: output.top },
    facts: [
      { key: 'max logit', value: output.max_logit },
      { key: 'Z', value: output.partition },
      { key: 'winner', value: showSpace(output.top[0].token) },
    ],
    note: 'The same embedding table used at the input, transposed. A token scores highly exactly '
        + 'when the final vector points the way that token’s own embedding points. The model stops '
        + 'here — picking one of these is sampling, and that happens outside the network.',
  })

  return steps
}

/* ── the view ────────────────────────────────────────────────────────────── */

const SPEEDS = [
  { label: '1×', ms: 1400 },
  { label: '2×', ms: 700 },
  { label: '4×', ms: 350 },
]

export default function Run() {
  const { example } = useInsideLLMStore()
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const currentRef = useRef(null)

  const steps = useMemo(
    () => (example?.trace ? buildSteps(example.trace) : []), [example])

  // A new example is a new run, so start it from the beginning rather than
  // dropping the reader into the middle of a different sentence.
  useEffect(() => { setIndex(0); setPlaying(false) }, [example?.id])

  useEffect(() => {
    if (!playing || steps.length === 0) return undefined
    const timer = setTimeout(() => {
      setIndex((current) => {
        if (current >= steps.length - 1) { setPlaying(false); return current }
        return current + 1
      })
    }, SPEEDS[speed].ms)
    return () => clearTimeout(timer)
  }, [playing, index, speed, steps.length])

  // Keep the rail's active marker in view as the run advances past it.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [index])

  if (!example) return null
  if (!example.trace) {
    return <p className="ill-note">This example was built before the run view existed. Rebuild the
                                   precomputed data to see it.</p>
  }

  const step = steps[index]
  const atEnd = index >= steps.length - 1
  const bound = Math.max(
    ...[step.input?.values, step.added?.values, step.output?.values]
      .filter(Boolean).flat().map(Math.abs), 0.001)

  return (
    <div className="ill-run">
      <div className="ill-run-bar">
        <button className="ill-run-play" onClick={() => {
          if (atEnd) { setIndex(0); setPlaying(true) } else setPlaying(!playing)
        }}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
          {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
        </button>
        <button className="ill-run-step" onClick={() => { setPlaying(false); setIndex(Math.max(0, index - 1)) }}
                disabled={index === 0}>
          <ChevronLeft size={15} />
        </button>
        <button className="ill-run-step" onClick={() => { setPlaying(false); setIndex(Math.min(steps.length - 1, index + 1)) }}
                disabled={atEnd}>
          <ChevronRight size={15} />
        </button>
        <button className="ill-run-step" onClick={() => { setPlaying(false); setIndex(0) }}>
          <RotateCcw size={13} />
        </button>

        <div className="ill-run-speeds">
          {SPEEDS.map((option, position) => (
            <button key={option.label} className={speed === position ? 'active' : ''}
                    onClick={() => setSpeed(position)}>{option.label}</button>
          ))}
        </div>

        <span className="ill-run-count">
          step <strong>{index + 1}</strong> of {steps.length}
        </span>
      </div>

      <div className="ill-run-progress">
        <div className="ill-run-progress-fill"
             style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>

      <div className="ill-run-rail">
        {steps.map((item, position) => (
          <button
            key={item.id}
            ref={position === index ? currentRef : null}
            className={`ill-rail-tick ${item.phase} ${position === index ? 'active' : ''} ${
              position < index ? 'done' : ''}`}
            title={`${item.title} — ${item.subtitle}`}
            onClick={() => { setPlaying(false); setIndex(position) }}
          />
        ))}
      </div>

      <article className="ill-run-step-card">
        <header>
          <div>
            <span className="ill-run-phase">{step.subtitle}</span>
            <h3>{step.title}</h3>
          </div>
          {step.prediction && (
            <div className="ill-run-guess">
              <span>best guess here</span>
              <code>{showSpace(step.prediction.token)}</code>
              <em>{(step.prediction.probability * 100).toFixed(1)}%</em>
            </div>
          )}
        </header>

        <Equation>{step.equation}</Equation>

        <div className="ill-run-flow">
          {step.input?.values && (
            <div className="ill-run-row">
              <span className="ill-run-role in">in</span>
              <VectorStrip values={step.input.values} max={bound} label={step.input.label}
                           note={`‖·‖ = ${step.input.norm}`} />
            </div>
          )}
          {step.input?.scalar !== undefined && (
            <div className="ill-run-row">
              <span className="ill-run-role in">in</span>
              <div className="ill-run-scalar">
                <span>{step.input.label}</span><code>{step.input.scalar}</code>
              </div>
            </div>
          )}
          {step.added && (
            <div className="ill-run-row">
              <span className="ill-run-role add">+</span>
              <VectorStrip values={step.added.values} max={bound} label={step.added.label}
                           note={`‖·‖ = ${step.added.norm}`} />
            </div>
          )}
          {step.output?.values && (
            <div className="ill-run-row out">
              <span className="ill-run-role out">out</span>
              <VectorStrip values={step.output.values} max={bound} label={step.output.label}
                           note={`‖·‖ = ${step.output.norm}`} />
            </div>
          )}
          {step.output?.predictions && (
            <div className="ill-run-row out">
              <span className="ill-run-role out">out</span>
              <ul className="ill-run-predictions">
                {step.output.predictions.map((prediction) => (
                  <li key={prediction.id}>
                    <code>{showSpace(prediction.token)}</code>
                    <div className="ill-run-predbar">
                      <i style={{ width: `${prediction.probability * 100}%` }} />
                    </div>
                    <em>{(prediction.probability * 100).toFixed(1)}%</em>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <dl className="ill-run-facts">
          {step.facts.map((fact) => (
            <div key={fact.key}><dt>{fact.key}</dt><dd>{fact.value}</dd></div>
          ))}
        </dl>

        <p className="ill-note">{step.note}</p>
      </article>

      <p className="ill-note ill-run-footnote">
        Every vector shows the first {example.trace.dims_shown} of {example.trace.d_model}{' '}
        dimensions, at position {example.trace.position} — the token the prediction is made from.
        Colour is signed: blue is negative, red positive, and the scale is shared across the rows of
        a single step so they can be compared to each other. The output of each step is the input of
        the next, all the way from a token ID to a distribution over the vocabulary.
      </p>
    </div>
  )
}

export { buildSteps }
