import { useEffect, useMemo, useState } from 'react'
import { Dices, Loader2, RotateCcw, Sigma, Sliders, Thermometer } from 'lucide-react'
import { createLabsApi } from '../../../lib/labsApi'
import LabShell from '../lab-shell/LabShell'
import { Equation, Substitution, SymbolTable, probability } from '../lab-shell/math'
import { applySampling, drawSample } from './sampling'
import './DecodeLab.css'

const api = createLabsApi('decodelab').request

const DEFAULTS = { temperature: 1, top_k: 0, top_p: 1, repetition_penalty: 1 }
const SHOWN = 14

const showSpace = (text) => (text ? text.replaceAll(' ', '␣').replaceAll('\n', '⏎') : text)

const SYMBOLS = [
  { symbol: 'ℓ', means: 'the raw logit GPT-2 produced for this token — an unbounded score' },
  { symbol: 'T', means: 'temperature, the number every logit is divided by' },
  { symbol: 'Z', means: 'the partition function: the sum of every exponential, tail included' },
  { symbol: 'p', means: 'the probability before truncation' },
  { symbol: 'p′', means: 'the probability after the survivors are renormalised — what is sampled' },
]

/* One token, all the way through.
 *
 * The bars show where a token ended up; this shows how it got there. Every value
 * is taken from the same computation that drew the bars, so moving a slider
 * moves these numbers too — which is the only way to see that temperature acts
 * before the exponential and truncation acts after it. */
function WorkedToken({ result, settings, prompt, candidate }) {
  if (!candidate) return null

  const { stats } = result
  const penalised = candidate.penalised !== candidate.logit
  const repeated = prompt.prompt_tokens.some((token) => token.id === candidate.id)
  const survivors = result.candidates.filter((item) => item.kept).length

  const rows = [
    { label: 'logit', expression: `ℓ = ${candidate.logit.toFixed(3)}`,
      note: 'what the model actually produced, before any control touched it' },
    ...(penalised ? [{
      label: 'penalty',
      expression: candidate.logit > 0
        ? `${candidate.logit.toFixed(3)} / ${settings.repetition_penalty}`
        : `${candidate.logit.toFixed(3)} × ${settings.repetition_penalty}`,
      result: candidate.penalised.toFixed(3),
      note: 'this token is already in the prompt, so it is pushed down',
    }] : []),
    { label: 'temperature', expression: `${candidate.penalised.toFixed(3)} / ${stats.temperature}`,
      result: candidate.scaled.toFixed(3) },
    { label: 'exponentiate', expression: `exp(${candidate.scaled.toFixed(3)} − ${stats.shift.toFixed(3)})`,
      result: candidate.exponential.toExponential(3),
      note: 'the largest scaled logit is subtracted first, which cancels in the division below' },
    { label: 'normalise', expression: `${candidate.exponential.toExponential(3)} / ${stats.partition.toFixed(4)}`,
      result: probability(candidate.probability),
      note: `Z covers all ${prompt.vocab_size.toLocaleString()} tokens, not just the ${
        stats.totalCount} drawn above — the ones below the top ${
        stats.totalCount} enter through the histogram the server ships with them` },
  ]

  if (!candidate.kept) {
    rows.push({
      label: 'truncate', dropped: true,
      expression: settings.top_k > 0 && settings.top_p < 1
        ? `cut by top-k = ${settings.top_k} or top-p = ${settings.top_p}`
        : settings.top_k > 0 ? `outside the top ${settings.top_k}` : `outside the nucleus p = ${settings.top_p}`,
      result: '0',
      note: 'computed in full, then discarded — truncation happens after the softmax, not before',
    })
  } else {
    rows.push({
      label: 'renormalise',
      expression: `${candidate.probability.toExponential(3)} / ${stats.keptMass.toFixed(4)}`,
      result: probability(candidate.finalProbability),
      note: `${survivors} candidates survived and share the mass the cut ones gave up`,
    })
  }

  return (
    <div className="lab-card">
      <div className="lab-card-head">
        <h3><Sigma size={15} /> The arithmetic, for one token</h3>
        <span className="lab-muted">recomputed as you move the sliders</span>
      </div>

      <Equation label="what the controls compose into">
        {'p′(token) = renormalise( truncate( exp((ℓ / T) − max) / Z ) )'}
      </Equation>
      <SymbolTable symbols={SYMBOLS} />

      <Substitution
        title={`Every step for ${candidate.token === ' ' ? '␣' : JSON.stringify(candidate.token)}`}
        rows={rows}
        footnote={repeated
          ? 'This token appears in the prompt, so the repetition penalty applies to it. Set the penalty to 1.0 and the first row below the logit disappears.'
          : 'This token is not in the prompt, so the repetition penalty leaves it alone whatever it is set to.'}
      />

      <Substitution
        title="And the distribution as a whole"
        rows={[
          { label: 'kept', expression: `${stats.keptCount} of ${stats.totalCount} shipped candidates`,
            result: `${(stats.keptMass * 100).toFixed(1)}% of the mass` },
          { label: 'entropy', expression: 'H = − Σ p log p', result: `${stats.entropy.toFixed(3)} nats`,
            note: 'over the survivors, after renormalising' },
          { label: 'effective', expression: `e^H = e^${stats.entropy.toFixed(3)}`,
            result: stats.effectiveChoices.toFixed(1),
            note: 'how many equally-likely options this distribution is worth — 1.0 means decided' },
          { label: 'unshown tail', expression: 'mass below the shipped top 200',
            result: `${(stats.tailMass * 100).toFixed(1)}%` },
        ]}
      />
    </div>
  )
}

export default function DecodeLab({ onBack }) {
  const [overview, setOverview] = useState(null)
  const [controls, setControls] = useState(null)
  const [index, setIndex] = useState([])
  const [promptId, setPromptId] = useState('cat')
  const [prompt, setPrompt] = useState(null)
  const [settings, setSettings] = useState(DEFAULTS)
  const [drawn, setDrawn] = useState(null)
  // Which candidate the worked arithmetic below is about. Null means "whichever
  // is currently on top", so the panel is never empty and never stale.
  const [focusId, setFocusId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api('/overview'), api('/controls'), api('/prompts')])
      .then(([overviewData, controlData, indexData]) => {
        setOverview(overviewData)
        setControls(controlData)
        setIndex(indexData.prompts)
      })
      .catch((requestError) => setError(requestError.message))
  }, [])

  useEffect(() => {
    setLoading(true)
    setDrawn(null)
    setFocusId(null)
    api(`/prompts/${promptId}`)
      .then(setPrompt)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [promptId])

  // Recomputed on every slider move. This is the whole interaction, and it
  // happens locally — there is no request behind it.
  const result = useMemo(() => {
    if (!prompt) return null
    return applySampling(prompt.candidates, prompt.tail, {
      temperature: settings.temperature,
      topK: settings.top_k,
      topP: settings.top_p,
      repetitionPenalty: settings.repetition_penalty,
      promptTokenIds: prompt.prompt_tokens.map((token) => token.id),
    })
  }, [prompt, settings])

  const visible = useMemo(() => {
    if (!result) return []
    return [...result.candidates]
      .sort((a, b) => b.probability - a.probability)
      .slice(0, SHOWN)
  }, [result])

  const active = index.find((item) => item.id === promptId)
  const maxProbability = visible[0]?.probability || 1
  const focused = result
    ? result.candidates.find((candidate) => candidate.id === focusId) || visible[0]
    : null

  const setControl = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }))
    setDrawn(null)
  }

  const applyPreset = (preset) => {
    setSettings({
      temperature: preset.temperature, top_k: preset.top_k,
      top_p: preset.top_p, repetition_penalty: preset.repetition_penalty,
    })
    setDrawn(null)
  }

  return (
    <LabShell
      onBack={onBack}
      eyebrow="SAMPLING, MADE VISIBLE"
      title="Decoding Lab"
      icon={Sliders}
      meta={[
        { label: 'GPT-2 small · real logits' },
        { label: 'computed in your browser', ghost: true },
      ]}
      footer={overview?.method}
    >
      {error && <p className="lab-error">{error}</p>}

      <div className="dl-promptbar">
        <label htmlFor="dl-prompt">Prompt</label>
        <select id="dl-prompt" value={promptId} onChange={(event) => setPromptId(event.target.value)}>
          {index.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} — “{item.text.replaceAll('\n', ' ')}”
            </option>
          ))}
        </select>
        {active && (
          <span className="lab-muted">
            entropy {active.entropy} · top token <code>{showSpace(active.top1)}</code> at{' '}
            {(active.top1_probability * 100).toFixed(1)}%
          </span>
        )}
      </div>

      {loading && !prompt && (
        <div className="lab-loading"><Loader2 size={20} className="lab-spin" /> Loading the distribution…</div>
      )}

      {prompt && result && (
        <>
          <div className="dl-teaches">
            <div>
              <span>WHAT THIS PROMPT SHOWS</span>
              <h3>{prompt.title}</h3>
              <p>{prompt.teaches}</p>
            </div>
            <p className="dl-lookfor">{prompt.look_for}</p>
          </div>

          <div className="dl-grid">
            <aside className="lab-card dl-controls">
              <div className="lab-card-head">
                <h3><Thermometer size={15} /> Settings</h3>
                <button className="lab-ghost" onClick={() => { setSettings(DEFAULTS); setDrawn(null) }}>
                  <RotateCcw size={12} /> Reset
                </button>
              </div>

              <div className="dl-presets">
                {(controls?.presets || []).map((preset) => (
                  <button key={preset.id} className="dl-preset" title={preset.note}
                          onClick={() => applyPreset(preset)}>
                    {preset.label}
                  </button>
                ))}
              </div>

              {(controls?.controls || []).map((control) => {
                const key = control.id === 'top_k' ? 'top_k'
                  : control.id === 'top_p' ? 'top_p'
                  : control.id === 'repetition_penalty' ? 'repetition_penalty' : 'temperature'
                return (
                  <label className="lab-field dl-slider" key={control.id}>
                    <span>
                      {control.name}
                      <em>{settings[key]}{control.id === 'top_k' && settings.top_k === 0 ? ' (off)' : ''}</em>
                    </span>
                    <input type="range"
                           min={control.range.min} max={control.range.max} step={control.range.step}
                           value={settings[key]}
                           onChange={(event) => setControl(key, Number(event.target.value))} />
                    <small>{control.tagline}</small>
                  </label>
                )
              })}

              <div className="dl-stats">
                <div><strong>{result.stats.keptCount}</strong><span>candidates kept</span></div>
                <div><strong>{result.stats.effectiveChoices.toFixed(1)}</strong><span>effective choices</span></div>
                <div><strong>{result.stats.entropyFull.toFixed(2)}</strong><span>entropy (nats)</span></div>
                <div><strong>{(result.stats.tailMass * 100).toFixed(1)}%</strong><span>mass below top 200</span></div>
              </div>

              <button className="lab-primary dl-draw"
                      onClick={() => setDrawn(drawSample(result.candidates))}>
                <Dices size={14} /> Draw a sample
              </button>
              {drawn && (
                <p className="dl-drawn">
                  Sampled <code>{showSpace(drawn.token)}</code> — greedy would have picked{' '}
                  <code>{showSpace(result.stats.greedy.token)}</code>
                </p>
              )}
            </aside>

            <section className="lab-card dl-dist">
              <div className="lab-card-head">
                <h3>Next-token distribution</h3>
                <span className="lab-muted">
                  showing {SHOWN} of {result.stats.totalCount} shipped
                </span>
              </div>

              <ul className="lab-bars">
                {visible.map((candidate) => (
                  <li key={candidate.id}
                      className={`${candidate.kept ? '' : 'dl-dropped'} ${
                        focused?.id === candidate.id ? 'dl-focused' : ''}`}
                      onClick={() => setFocusId(candidate.id)}
                      title="Show the arithmetic for this token">
                    <code className="lab-bar-label">{showSpace(candidate.token)}</code>
                    <div className="lab-bar-track">
                      <div className={`lab-bar-fill ${candidate.kept ? '' : 'dropped'}`}
                           style={{ width: `${(candidate.probability / maxProbability) * 100}%` }} />
                    </div>
                    <span className="lab-bar-value">
                      {candidate.kept
                        ? `${(candidate.finalProbability * 100).toFixed(2)}%`
                        : 'cut'}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="lab-note">
                Bar length is the probability <em>before</em> truncation; the number is what you would
                actually sample after the survivors are renormalised. Grey bars were removed by top-k
                or top-p. <strong>Click any bar</strong> to see its arithmetic worked out below.
              </p>
              {result.stats.tailMass > 0.25 && (
                <p className="lab-note dl-warn">
                  {(result.stats.tailMass * 100).toFixed(0)}% of the mass sits below the 200 tokens
                  shipped here — this distribution is far flatter than the bars alone suggest.
                </p>
              )}
            </section>
          </div>

          <WorkedToken result={result} settings={settings} prompt={prompt} candidate={focused} />

          <div className="lab-card">
            <div className="lab-card-head"><h3>What each control does</h3></div>
            <div className="dl-explain">
              {(controls?.controls || []).map((control) => (
                <article key={control.id}>
                  <h4>{control.name}</h4>
                  <code className="dl-formula">{control.formula}</code>
                  <p>{control.summary}</p>
                  <p className="lab-muted"><strong>Why:</strong> {control.why}</p>
                  <p className="dl-misconception">{control.misconception}</p>
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </LabShell>
  )
}
