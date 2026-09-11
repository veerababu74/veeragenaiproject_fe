import { useMemo, useState } from 'react'
import { Dices, Flame, Scissors, Sparkles, Trophy } from 'lucide-react'
import LabStory from '../lab-shell/story'
import { applySampling, drawSample } from './sampling'

/* Decoding, for someone who has never heard the word.
 *
 * This lab's own controls are four sliders labelled temperature, top-k, top-p
 * and repetition penalty. To a newcomer that is four unexplained words and a
 * wall of bars, and the natural response is to drag something, see numbers
 * move, and learn nothing.
 *
 * The story fixes the order of discovery. First: a model does not choose a
 * word, it produces odds over every word — which is the single idea everything
 * else depends on and the one most people have never been told. Then
 * temperature, as the dial that reshapes those odds. Then the two cutters, and
 * why a fixed count is the wrong shape. Then the draw itself.
 *
 * Every number comes from the same precomputed GPT-2 logits the lab uses, run
 * through the same `applySampling` the sliders call, so nothing here is a
 * simplified re-implementation that could quietly disagree with the real thing.
 */

const showSpace = (text) => (text ? text.replaceAll(' ', '␣').replaceAll('\n', '⏎') : text)
const pct = (value) => `${(value * 100).toFixed(1)}%`

const SETTINGS = (temperature, extra = {}) => ({
  temperature, topK: 0, topP: 1, repetitionPenalty: 1, ...extra,
})

/** The distribution as bars, at whatever settings a scene wants to show. */
function Distribution({ prompt, settings, count = 6, highlightCut = false }) {
  const result = useMemo(
    () => applySampling(prompt.candidates, prompt.tail, {
      ...settings, promptTokenIds: prompt.prompt_tokens.map((t) => t.id),
    }), [prompt, settings])

  const shown = [...result.candidates]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, count)
  const bound = shown[0]?.probability || 1

  return (
    <>
      <ul className="lab-story-bars">
        {shown.map((candidate, index) => (
          <li key={candidate.id}
              className={`${index === 0 && !highlightCut ? 'top' : ''} ${
                highlightCut && !candidate.kept ? 'cut' : ''}`}
              style={{ animationDelay: `${index * 70}ms` }}>
            <code>{showSpace(candidate.token)}</code>
            <div><i style={{ width: `${(candidate.probability / bound) * 100}%` }} /></div>
            <em>{highlightCut && !candidate.kept ? 'cut' : pct(candidate.probability)}</em>
          </li>
        ))}
      </ul>
      <p className="lab-story-caption">
        {highlightCut
          ? <>{result.stats.keptCount} of {result.stats.totalCount} candidates survived, holding{' '}
            {pct(result.stats.keptMass)} of the original odds between them.</>
          : <>This is the model's actual opinion — {result.stats.effectiveChoices.toFixed(1)} effective
            choices, out of 50,257 words it could have picked.</>}
      </p>
    </>
  )
}

/** Two temperatures side by side. The comparison is the entire lesson. */
function TemperatureVersus({ prompt }) {
  const [temperature, setTemperature] = useState(1)
  const result = useMemo(
    () => applySampling(prompt.candidates, prompt.tail, {
      ...SETTINGS(temperature), promptTokenIds: prompt.prompt_tokens.map((t) => t.id),
    }), [prompt, temperature])

  const shown = [...result.candidates].sort((a, b) => b.probability - a.probability).slice(0, 7)
  const bound = shown[0]?.probability || 1

  return (
    <>
      <div className="dl-story-dial">
        <span>cold</span>
        <input type="range" min={0.1} max={2} step={0.05} value={temperature}
               onChange={(event) => setTemperature(Number(event.target.value))} />
        <span>hot</span>
        <strong>{temperature.toFixed(2)}</strong>
      </div>

      <ul className="lab-story-bars">
        {shown.map((candidate, index) => (
          <li key={candidate.id} className={index === 0 ? 'top' : ''}>
            <code>{showSpace(candidate.token)}</code>
            <div><i style={{ width: `${(candidate.probability / bound) * 100}%` }} /></div>
            <em>{pct(candidate.probability)}</em>
          </li>
        ))}
      </ul>

      <p className="lab-story-caption">
        {temperature < 0.6
          ? <>Cold. The favourite has taken almost everything — at this setting the model will say
            the same thing every single time.</>
          : temperature > 1.35
            ? <>Hot. The gaps have closed and unlikely words now have a real chance. This is where
              text starts to wander.</>
            : <>Around 1.0 you are seeing the model's own opinion, neither sharpened nor flattened.</>}
        {' '}Effective choices: <strong>{result.stats.effectiveChoices.toFixed(1)}</strong>.
      </p>
    </>
  )
}

/** Drawing from the distribution, repeatedly — randomness made concrete. */
function DrawRepeatedly({ prompt }) {
  const [draws, setDraws] = useState([])
  const [temperature, setTemperature] = useState(1)

  const result = useMemo(
    () => applySampling(prompt.candidates, prompt.tail, {
      ...SETTINGS(temperature), promptTokenIds: prompt.prompt_tokens.map((t) => t.id),
    }), [prompt, temperature])

  const roll = () => {
    const picked = drawSample(result.candidates)
    if (picked) setDraws((current) => [picked.token, ...current].slice(0, 14))
  }

  const counts = draws.reduce((acc, token) => ({ ...acc, [token]: (acc[token] || 0) + 1 }), {})
  const distinct = Object.keys(counts).length

  return (
    <>
      <div className="dl-story-dial">
        <span>cold</span>
        <input type="range" min={0.1} max={2} step={0.05} value={temperature}
               onChange={(event) => { setTemperature(Number(event.target.value)); setDraws([]) }} />
        <span>hot</span>
        <strong>{temperature.toFixed(2)}</strong>
      </div>

      <div className="dl-story-draws">
        <button className="lab-primary" onClick={roll}>
          <Dices size={14} /> Draw a word
        </button>
        <div className="dl-story-draw-list">
          {draws.length === 0
            ? <span className="lab-muted">Press it a few times. Then turn the dial and press again.</span>
            : draws.map((token, index) => (
              <code key={index} style={{ animationDelay: `${index * 20}ms` }}>{showSpace(token)}</code>
            ))}
        </div>
      </div>

      {draws.length > 2 && (
        <p className="lab-story-caption">
          {distinct} different word{distinct === 1 ? '' : 's'} in {draws.length} draws.{' '}
          {distinct === 1
            ? 'At this setting it is effectively deterministic — same prompt, same answer, forever.'
            : 'That variety is the whole reason the same question gives you a different answer twice.'}
        </p>
      )}
    </>
  )
}

export function buildDecodeScenes(prompt) {
  if (!prompt) return []
  const base = applySampling(prompt.candidates, prompt.tail, {
    ...SETTINGS(1), promptTokenIds: prompt.prompt_tokens.map((t) => t.id),
  })
  const favourite = base.stats.greedy
  const promptText = prompt.prompt_tokens.map((t) => t.text).join('')

  return [
    {
      id: 'odds', icon: Sparkles, chapter: 'The thing nobody tells you',
      title: 'A model never picks a word',
      lead: <>Given the text <code>{promptText.trim()}</code>, it does not decide what comes next.
        It produces a <strong>score for every single word it knows</strong> — all 50,257 of them —
        and hands you the odds.</>,
      visual: <Distribution prompt={prompt} settings={SETTINGS(1)} />,
      body: <>The favourite here is <code>{showSpace(favourite.token)}</code>, but look at the
        others: they are not zero. Something still has to choose one, and everything in this lab is
        about how that choice gets made. That part happens <em>outside</em> the model.</>,
      maths: {
        equation: 'P(word) = exp(score) / Σ exp(every score)',
        note: 'Softmax: exponentiate every score and divide by the total, so the odds sum to 1. '
            + 'The scores themselves are called logits.',
      },
    },
    {
      id: 'temperature', icon: Flame, chapter: 'The first dial',
      title: 'Temperature reshapes the odds',
      lead: <>One number decides whether the favourite runs away with it or the field stays open.
        Drag it and watch the bars — <strong>nothing is added or removed</strong>, the odds are just
        stretched or squashed.</>,
      visual: <TemperatureVersus prompt={prompt} />,
      body: <>This is why the same setting behaves differently on different questions. On a prompt
        the model is already sure about, turning the dial barely moves anything; on an open-ended
        one it changes everything. Temperature does not control creativity — it controls how much
        room the unlikely options get.</>,
      maths: {
        equation: 'P(word) = softmax(score / T)',
        note: 'Every score is divided by T before the softmax. The ratio between any two words is '
            + 'exp((a − b) / T), so halving T squares the gap between them.',
      },
    },
    {
      id: 'cut', icon: Scissors, chapter: 'The second idea',
      title: 'Most of those words are nonsense, so they get cut',
      lead: <>Of 50,257 candidates, the overwhelming majority are absurd here. Each is individually
        unlikely — but there are <strong>tens of thousands of them</strong>, and together they add
        up to a real chance of producing something baffling.</>,
      visual: <Distribution prompt={prompt} settings={SETTINGS(1, { topP: 0.9 })}
                           count={8} highlightCut />,
      body: <>Two ways to cut. <strong>Top-k</strong> keeps a fixed number — simple, but the right
        number depends on how certain the model is, and a fixed k cannot know that.{' '}
        <strong>Top-p</strong> keeps however many words it takes to cover a share of the odds, so
        it keeps one word when the model is sure and dozens when it is not. That is why top-p
        largely replaced top-k.</>,
      maths: {
        equation: 'top-k: keep the k highest\ntop-p: keep while the running total < p',
        note: 'Both then renormalise, so what survives adds back up to 1. Note this happens '
            + 'after the softmax — a cut word had a real probability first, and gave it up.',
      },
    },
    {
      id: 'draw', icon: Dices, chapter: 'The moment itself',
      title: 'Then it rolls a weighted die',
      lead: <>Whatever survived, one word is drawn — with the odds acting as weights. Press the
        button a few times, then move the dial and press again.</>,
      visual: <DrawRepeatedly prompt={prompt} />,
      body: <>That is the whole of it. Every word in every answer you have ever seen from a chatbot
        came out of this: score everything, reshape, cut, roll. Turn the dial cold and it becomes
        the same answer every time; turn it hot and the same question gives a different answer on
        every ask.</>,
      maths: {
        equation: 'draw r ∈ [0, 1), walk the sorted list until the running total ≥ r',
        note: 'A weighted random choice. Set temperature near zero and this collapses to always '
            + 'taking the favourite, which is called greedy decoding.',
      },
    },
    {
      id: 'why', icon: Trophy, chapter: 'Why you should care',
      title: 'These settings decide what your product feels like',
      lead: <>Not an academic detail — the difference between an assistant that contradicts itself
        and one that is dull is often just these numbers.</>,
      visual: (
        <div className="lab-story-versus">
          <div className="lab-story-versus-side good">
            <h6>cold · near 0</h6>
            <p className="lab-story-caption" style={{ textAlign: 'left', margin: 0 }}>
              Same input, same output, every time. What you want for extraction, classification and
              code. Costs you variety, and it cannot recover from a bad first word.
            </p>
          </div>
          <div className="lab-story-versus-mid">vs</div>
          <div className="lab-story-versus-side bad">
            <h6>hot · above 1.2</h6>
            <p className="lab-story-caption" style={{ textAlign: 'left', margin: 0 }}>
              Genuinely different answers each time. Useful for brainstorming. Push it far enough
              and the model starts choosing words almost at random.
            </p>
          </div>
        </div>
      ),
      body: <>You now know what every slider in this lab does. Open it and try the presets — the
        “chaotic” one is worth seeing at least once, because watching the distribution flatten
        tells you more than any description of it.</>,
    },
  ]
}

export default function DecodeStory({ prompt, onOpenLab }) {
  const scenes = useMemo(() => buildDecodeScenes(prompt), [prompt])
  if (!prompt) return null
  return (
    <LabStory
      scenes={scenes}
      finishLabel="Open the controls"
      onFinish={onOpenLab}
      footer="Every number here came from GPT-2's real next-word scores for this prompt, reshaped by
              the same code the sliders use."
    />
  )
}
