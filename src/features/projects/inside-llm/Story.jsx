import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, ChevronLeft, ChevronRight, Eye, Hash, Layers3,
  Lightbulb, RefreshCw, Sparkles, Type,
} from 'lucide-react'
import { useInsideLLMStore } from './store'

/* The beginner's way in.
 *
 * Every other view in this project assumes you already know what a transformer
 * is. They show real numbers, real equations and real vectors, which is exactly
 * right for someone checking the arithmetic and exactly wrong for someone who
 * has never heard the word "embedding". `γ (x − μ) / √(σ² + ε) + β` is not an
 * entry point.
 *
 * So this is the same forward pass told as a story: one idea per screen, plain
 * words, a picture that moves, and no Greek unless you ask for it. The maths is
 * never hidden — every scene has a "show the maths" toggle that reveals the
 * real equation and points at the view where it can be checked — but it is
 * never the first thing you meet either.
 *
 * The order is the order the model actually works in, so what a reader builds
 * here is a correct mental model rather than a friendly-but-wrong one.
 */

const showSpace = (text) => (text ? text.replaceAll(' ', '␣') : text)
const percent = (value) => `${(value * 100).toFixed(1)}%`

/* The clearest teaching example in the set: the model visibly does not know,
 * then finds the 4, then becomes certain of 5. A reader can watch it think. */
const BEST_FIRST = 'counting'

/* ── scene visuals ───────────────────────────────────────────────────────── */

function TokenChips({ example, reveal }) {
  return (
    <div className="st-chips">
      {example.tokens.map((token, index) => (
        <span className="st-chip" key={token.position}
              style={{ animationDelay: `${index * 90}ms` }}>
          <b>{showSpace(token.text)}</b>
          <i className={reveal ? 'shown' : ''}>{token.id}</i>
        </span>
      ))}
    </div>
  )
}

/** The vector as a colour bar — the first time a reader sees "meaning" as data. */
function MeaningBar({ values, label }) {
  const bound = Math.max(...values.map(Math.abs), 0.001)
  return (
    <div className="st-meaning">
      {label && <span className="st-meaning-label">{label}</span>}
      <div className="st-meaning-cells">
        {values.map((value, index) => (
          <i key={index}
             style={{
               animationDelay: `${index * 22}ms`,
               background: value >= 0
                 ? `rgba(208, 59, 59, ${0.15 + 0.85 * Math.min(1, Math.abs(value) / bound)})`
                 : `rgba(37, 106, 191, ${0.15 + 0.85 * Math.min(1, Math.abs(value) / bound)})`,
             }} />
        ))}
      </div>
    </div>
  )
}

/* The centrepiece: who looked at whom.
 *
 * Attention is the one idea that makes a transformer click, and it is almost
 * always explained with a matrix — which is precisely the wrong picture for a
 * beginner, because a grid of numbers hides the thing that matters. Arcs show
 * it directly: this word, reading back, pulled most of its information from
 * that word. */
function AttentionArcs({ example }) {
  const worked = example.worked_example
  if (!worked) return null

  const tokens = example.tokens
  const visible = worked.keys.filter((key) => !key.masked)
  const width = Math.max(420, tokens.length * 84)
  const height = 150
  const slot = width / tokens.length
  const x = (index) => slot * index + slot / 2
  const baseline = height - 34
  const winner = visible.reduce((best, key) => (key.probability > best.probability ? key : best), visible[0])

  return (
    <div className="st-arcs">
      <svg viewBox={`0 0 ${width} ${height}`} className="st-arcs-svg" role="img"
           aria-label="Which earlier words this word read from">
        {visible.map((key) => {
          if (key.position === worked.query_position) return null
          const from = x(worked.query_position)
          const to = x(key.position)
          const lift = Math.min(96, 26 + Math.abs(from - to) * 0.42)
          const strong = key.probability > 0.02
          return (
            <path
              key={key.position}
              d={`M ${from} ${baseline - 16} Q ${(from + to) / 2} ${baseline - 16 - lift} ${to} ${baseline - 16}`}
              className={`st-arc ${strong ? 'strong' : 'faint'}`}
              style={{
                strokeWidth: strong ? 3 + key.probability * 13 : 1.5,
                // Weak arcs still render: seeing that the model considered and
                // dismissed the others is half the lesson.
                opacity: strong ? 0.9 : 0.22,
              }}
            />
          )
        })}
        {tokens.map((token, index) => (
          <g key={token.position}>
            <circle cx={x(index)} cy={baseline - 16} r={index === worked.query_position ? 7 : 5}
                    className={index === worked.query_position ? 'st-node-query'
                      : index === winner.position ? 'st-node-source' : 'st-node'} />
            <text x={x(index)} y={baseline + 12} textAnchor="middle"
                  className={`st-node-text ${index === worked.query_position ? 'query'
                    : index === winner.position ? 'source' : ''}`}>
              {showSpace(token.text)}
            </text>
          </g>
        ))}
      </svg>

      <p className="st-arc-caption">
        Reading the word <code>{showSpace(worked.query_token)}</code>, this part of the model took{' '}
        <strong>{percent(winner.probability)}</strong> of what it needed from{' '}
        <code>{showSpace(winner.token)}</code>
        {visible.length > 2 && <> — and almost nothing from the {visible.length - 2} other words</>}.
      </p>
    </div>
  )
}

/* The payoff scene: the answer forming, layer by layer.
 *
 * This is the moment the project exists for. The model does not know the answer
 * at the start and does know it at the end, and you can watch the exact point
 * where it works it out. */
function GuessForming({ example, layer, setLayer }) {
  const lens = example.logit_lens
  const entry = lens[Math.min(layer, lens.length - 1)]
  const top = entry.top[0]
  const final = example.prediction.top[0]
  const settled = lens.findIndex((item) => item.top[0].token === final.token)

  return (
    <div className="st-forming">
      <div className="st-forming-guess">
        <span>after {entry.label === 'embeddings' ? 'no thinking at all' : entry.label}</span>
        <code className={top.token === final.token ? 'right' : ''}>{showSpace(top.token)}</code>
        <div className="st-forming-bar">
          <i style={{ width: `${top.probability * 100}%` }}
             className={top.token === final.token ? 'right' : ''} />
        </div>
        <em>{percent(top.probability)} sure</em>
      </div>

      <input type="range" min={0} max={lens.length - 1} value={layer}
             className="st-slider"
             onChange={(event) => setLayer(Number(event.target.value))} />

      <div className="st-forming-track">
        {lens.map((item, index) => (
          <button key={index}
                  className={`st-tick ${index === layer ? 'active' : ''} ${
                    item.top[0].token === final.token ? 'right' : ''}`}
                  title={`${item.label}: ${showSpace(item.top[0].token)}`}
                  onClick={() => setLayer(index)} />
        ))}
      </div>

      <p className="st-arc-caption">
        Drag the slider. The model starts with no idea, changes its mind a few times, and{' '}
        {settled > 0
          ? <>settles on <code>{showSpace(final.token)}</code> at <strong>layer {settled}</strong> — then spends the
            remaining layers becoming more sure of it.</>
          : <>arrives at <code>{showSpace(final.token)}</code>.</>}
      </p>
    </div>
  )
}

function VocabularyFunnel({ example }) {
  const top = example.prediction.top.slice(0, 6)
  const bound = top[0].probability
  return (
    <div className="st-funnel">
      <div className="st-funnel-top">
        <strong>50,257</strong>
        <span>possible next words, every one given a score</span>
      </div>
      <div className="st-funnel-neck" />
      <ul className="st-funnel-list">
        {top.map((item, index) => (
          <li key={item.id} style={{ animationDelay: `${index * 80}ms` }}>
            <code>{showSpace(item.token)}</code>
            <div><i style={{ width: `${(item.probability / bound) * 100}%` }} /></div>
            <em>{percent(item.probability)}</em>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── the scenes ──────────────────────────────────────────────────────────── */

/* Exported so a test can render all nine scenes for every example; the view
 * itself only ever shows one at a time. */
export function buildScenes(example, layer, setLayer) {
  const tokens = example.tokens
  const winner = example.prediction.top[0]
  const neighbours = example.embeddings.neighbors[0].slice(0, 5)
  const midLayer = example.mlp.layers[Math.min(6, example.mlp.layers.length - 1)]
  const worked = example.worked_example
  const workedWinner = worked
    ? worked.keys.filter((k) => !k.masked).reduce((a, b) => (b.probability > a.probability ? b : a))
    : null

  return [
    {
      id: 'hook', icon: Sparkles, chapter: 'The question',
      title: 'How does it know what comes next?',
      lead: <>You have seen a chatbot write. It produces <strong>one word at a time</strong>, and each
        time it has to pick the next one from scratch.</>,
      visual: (
        <div className="st-hook">
          <div className="st-sentence">
            {tokens.map((token) => <span key={token.position}>{showSpace(token.text)}</span>)}
            <span className="st-caret" />
          </div>
          <p className="st-hook-q">What comes next?</p>
        </div>
      ),
      body: <>You already know the answer. Over the next few screens you will watch a real model —
        GPT-2, with its actual trained numbers — work it out. Nothing here is a simulation.</>,
    },
    {
      id: 'tokens', icon: Type, chapter: 'Step 1',
      title: 'It cannot read letters, so the text is chopped up',
      lead: <>A model only handles numbers. So the sentence is first cut into pieces from a fixed
        list of <strong>50,257</strong> known pieces, and each piece is swapped for its position in
        that list.</>,
      visual: <TokenChips example={example} reveal />,
      body: <>These pieces are called <em>tokens</em>. They are not quite words — a common word is
        usually one token, a rare one gets split into several. The number under each is just its row
        in the list; it means nothing on its own.</>,
      maths: {
        equation: 't = V[piece]',
        note: 'A lookup in a fixed vocabulary. The full byte-pair merge trace is in Components → Tokenization.',
      },
    },
    {
      id: 'meaning', icon: Hash, chapter: 'Step 2',
      title: 'Each number is swapped for a list of 768 numbers',
      lead: <>That list is the model's idea of what the piece <strong>means</strong>. Here is the
        one for <code>{showSpace(tokens[0].text)}</code>, drawn as colour — red is positive, blue is
        negative.</>,
      visual: (
        <>
          <MeaningBar values={example.embeddings.token[0]}
                      label={`what “${showSpace(tokens[0].text)}” means to the model`} />
          <div className="st-neighbours">
            <span>closest in meaning:</span>
            {neighbours.map((n) => <code key={n.id}>{showSpace(n.token)}</code>)}
          </div>
        </>
      ),
      body: <>Nobody wrote those numbers by hand. The model learned them by reading text, and pieces
        used in similar ways ended up with similar lists — which is why the closest neighbours above
        make sense to you.</>,
      maths: {
        equation: 'e = W_E[t]',
        note: 'A row of a learned 50257 × 768 table. Closeness is cosine similarity — see Components → Token embeddings.',
      },
    },
    {
      id: 'order', icon: ArrowRight, chapter: 'Step 3',
      title: 'It is also told where each word sits',
      lead: <>On its own, the machinery that comes next has <strong>no sense of order</strong> — it
        would read “the cat sat” and “sat the cat” identically.</>,
      visual: (
        <div className="st-order">
          {tokens.slice(0, 6).map((token, index) => (
            <div className="st-order-row" key={token.position}>
              <span className="st-order-pos">position {index}</span>
              <span className="st-order-tok">{showSpace(token.text)}</span>
              <span className="st-order-plus">+</span>
              <MeaningBar values={example.embeddings.position[index].slice(0, 16)} />
            </div>
          ))}
        </div>
      ),
      body: <>So a second list — one per position — is added on top. It is much smaller than the
        meaning list, so it nudges rather than overwrites.</>,
      maths: {
        equation: 'x = W_E[token] + W_P[position]',
        note: 'Plain addition. Components → Positional encoding compares this with the sinusoidal and rotary schemes.',
      },
    },
    {
      id: 'attention', icon: Eye, chapter: 'Step 4 — the important one',
      title: 'Now the words look at each other',
      lead: <>This is the idea the whole thing is built on. Each word looks back at the words before
        it and <strong>pulls in what it needs</strong>. It is the only step where information moves
        between words.</>,
      visual: <AttentionArcs example={example} />,
      body: workedWinner ? (
        <>Thicker line, stronger look. The model was not told to do this — which word to read from
          is something it worked out during training, and it does this{' '}
          <strong>144 times over</strong> in parallel, each looking for something different.</>
      ) : <>Each word reads from the words before it.</>,
      maths: {
        equation: 'attention = softmax(q · k / √d) v',
        note: 'Every dot product, scaling step and softmax is worked through in Components → Self-attention.',
      },
    },
    {
      id: 'think', icon: Lightbulb, chapter: 'Step 5',
      title: 'Then each word thinks on its own',
      lead: <>After looking around, every word is passed through a bank of{' '}
        <strong>{midLayer.expanded_dim.toLocaleString()}</strong> tiny detectors. Most stay quiet.
        Only <strong>{(midLayer.fraction_active * 100).toFixed(0)}%</strong> respond at all.</>,
      visual: (
        <div className="st-neurons">
          {Array.from({ length: 120 }, (_, index) => {
            const active = index / 120 < midLayer.fraction_active
            return <i key={index} className={active ? 'on' : ''}
                      style={{ animationDelay: `${(index % 24) * 30}ms` }} />
          })}
          <p className="st-arc-caption">
            120 of {midLayer.expanded_dim.toLocaleString()} shown, in proportion. The loudest one
            here is detector #{midLayer.top_neurons[0].neuron}.
          </p>
        </div>
      ),
      body: <>Because so few fire at once, individual detectors end up standing for specific
        things — this is where a lot of what the model "knows" appears to be stored.</>,
      maths: {
        equation: 'FFN(x) = GELU(x W₁ + b₁) W₂ + b₂',
        note: 'Two thirds of the model’s parameters live here. See Components → Feed-forward network.',
      },
    },
    {
      id: 'stack', icon: Layers3, chapter: 'Step 6',
      title: 'Now do all of that twelve times',
      lead: <>Look, think, look, think — twelve rounds of it. And because the model keeps a running
        answer the whole way, <strong>you can watch it work the answer out</strong>.</>,
      visual: <GuessForming example={example} layer={layer} setLayer={setLayer} />,
      body: <>That is as close as you can get to watching a model think. Early rounds are noise;
        somewhere in the middle it commits; the last rounds mostly build confidence.</>,
      maths: {
        equation: 'xₙ₊₁ = xₙ + Block(xₙ)',
        note: 'Each block adds to a running vector rather than replacing it — which is why it can be decoded at every depth. Components → Residual stream.',
      },
    },
    {
      id: 'pick', icon: Hash, chapter: 'Step 7',
      title: 'Finally, it scores every word it knows',
      lead: <>All <strong>50,257</strong> of them get a score, and the scores are turned into
        percentages that add up to 100.</>,
      visual: <VocabularyFunnel example={example} />,
      body: <>And there it is — <code>{showSpace(winner.token)}</code> at {percent(winner.probability)}.
        Notice the model does not <em>choose</em>. It produces this whole list of odds; picking one
        happens outside the model, and that choice is what a “temperature” setting controls.</>,
      maths: {
        equation: 'P(word) = exp(score) / Σ exp(all scores)',
        note: 'The softmax, with real logits and the partition function, is in Components → Unembedding.',
      },
    },
    {
      id: 'loop', icon: RefreshCw, chapter: 'And that is the whole thing',
      title: 'Then it does it all again',
      lead: <>The chosen word is stuck on the end of the sentence, and every step you just watched
        runs again from the top.</>,
      visual: (
        <div className="st-loop">
          <div className="st-sentence">
            {tokens.map((token) => <span key={token.position}>{showSpace(token.text)}</span>)}
            <span className="st-sentence-new">{showSpace(winner.token)}</span>
          </div>
          <div className="st-loop-arrow"><RefreshCw size={20} /> and again…</div>
        </div>
      ),
      body: <>Word by word, that is all text generation is. Everything else — chat, code, an essay —
        is this loop running fast enough that it looks like thinking.</>,
    },
  ]
}

/* ── the view ────────────────────────────────────────────────────────────── */

export default function Story({ onOpenComponents }) {
  const { example, exampleId, setExampleId, examplesIndex } = useInsideLLMStore()
  const [index, setIndex] = useState(0)
  const [layer, setLayer] = useState(0)
  const [showMaths, setShowMaths] = useState(false)

  const scenes = useMemo(
    () => (example ? buildScenes(example, layer, setLayer) : []), [example, layer])

  // A different sentence is a different story, so start it from the top.
  useEffect(() => { setIndex(0); setLayer(0) }, [exampleId])

  if (!example || scenes.length === 0) return null

  const scene = scenes[Math.min(index, scenes.length - 1)]
  const Icon = scene.icon
  const last = index === scenes.length - 1
  const friendly = examplesIndex.find((item) => item.id === BEST_FIRST)

  return (
    <div className="st-story">
      <div className="st-progress">
        {scenes.map((item, position) => (
          <button key={item.id}
                  className={`st-dot ${position === index ? 'active' : ''} ${position < index ? 'done' : ''}`}
                  title={item.title}
                  onClick={() => setIndex(position)} />
        ))}
      </div>

      <article className="st-scene" key={scene.id}>
        <span className="st-chapter"><Icon size={13} /> {scene.chapter}</span>
        <h2>{scene.title}</h2>
        <p className="st-lead">{scene.lead}</p>

        <div className="st-visual">{scene.visual}</div>

        <p className="st-body">{scene.body}</p>

        {scene.maths && (
          <div className="st-maths">
            <button onClick={() => setShowMaths(!showMaths)}>
              {showMaths ? 'Hide the maths' : 'Show me the maths'}
            </button>
            {showMaths && (
              <div className="st-maths-body">
                <code>{scene.maths.equation}</code>
                <p>{scene.maths.note}</p>
              </div>
            )}
          </div>
        )}
      </article>

      <div className="st-nav">
        <button className="st-back" onClick={() => setIndex(Math.max(0, index - 1))}
                disabled={index === 0}>
          <ChevronLeft size={16} /> Back
        </button>
        <span className="st-count">{index + 1} of {scenes.length}</span>
        {last ? (
          <button className="st-next" onClick={onOpenComponents}>
            See the real numbers <ArrowRight size={16} />
          </button>
        ) : (
          <button className="st-next" onClick={() => setIndex(index + 1)}>
            Next <ChevronRight size={16} />
          </button>
        )}
      </div>

      {exampleId !== BEST_FIRST && friendly && (
        <p className="st-nudge">
          New to this? <button onClick={() => setExampleId(BEST_FIRST)}>
            Try “{friendly.text}”
          </button> — it is the clearest one to learn from, because you can see the model change
          its mind.
        </p>
      )}
    </div>
  )
}
