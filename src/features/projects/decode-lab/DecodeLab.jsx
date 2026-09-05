import { useEffect, useMemo, useState } from 'react'
import { Dices, Loader2, RotateCcw, Sliders, Thermometer } from 'lucide-react'
import { createLabsApi } from '../../../lib/labsApi'
import LabShell from '../lab-shell/LabShell'
import { applySampling, drawSample } from './sampling'
import './DecodeLab.css'

const api = createLabsApi('decodelab').request

const DEFAULTS = { temperature: 1, top_k: 0, top_p: 1, repetition_penalty: 1 }
const SHOWN = 14

const showSpace = (text) => (text ? text.replaceAll(' ', '␣').replaceAll('\n', '⏎') : text)

export default function DecodeLab({ onBack }) {
  const [overview, setOverview] = useState(null)
  const [controls, setControls] = useState(null)
  const [index, setIndex] = useState([])
  const [promptId, setPromptId] = useState('cat')
  const [prompt, setPrompt] = useState(null)
  const [settings, setSettings] = useState(DEFAULTS)
  const [drawn, setDrawn] = useState(null)
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
                  <li key={candidate.id} className={candidate.kept ? '' : 'dl-dropped'}>
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
                or top-p.
              </p>
              {result.stats.tailMass > 0.25 && (
                <p className="lab-note dl-warn">
                  {(result.stats.tailMass * 100).toFixed(0)}% of the mass sits below the 200 tokens
                  shipped here — this distribution is far flatter than the bars alone suggest.
                </p>
              )}
            </section>
          </div>

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
