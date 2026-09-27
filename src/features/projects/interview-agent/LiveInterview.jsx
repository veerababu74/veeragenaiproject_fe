import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, CheckCircle2, Flag, Loader2, Mic, Pause, SkipForward, Square, Volume2,
} from 'lucide-react'
import { interviewApi, patientSignal } from './api'
import { useVoice } from './useVoice'

/* The interview itself.
 *
 * Three decisions shape this screen.
 *
 * **The transcript is editable.** Speech recognition mishears technical words —
 * every provider does, the free one badly — and being marked down for the
 * transcriber's mistake would make the score meaningless. So what was heard is
 * shown, and can be corrected, before it is submitted.
 *
 * **Feedback interrupts.** After each answer the grade appears and the next
 * question waits behind a Continue button. Feedback that scrolled past while
 * the next question was already being read aloud would not be read, and the
 * feedback is the entire point of practising.
 *
 * **Nothing here is streamed.** An interview is turn-based: the agent speaks,
 * you speak, it grades. There is no partial state worth showing mid-turn, so
 * the complexity of a stream would buy nothing.
 */

const clock = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

export default function LiveInterview({ state, setup, tips, onState, onFinished }) {
  const voice = useVoice({ sttProvider: setup.stt_provider, ttsProvider: setup.tts_provider })
  const [draft, setDraft] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const startedAt = useRef(0)
  const spokenId = useRef('')

  const current = state.current
  const progress = state.progress

  // Read the question aloud once, when it becomes the current one. Keyed on the
  // id rather than on a render, or a re-render mid-answer would start it again
  // over the top of itself.
  useEffect(() => {
    if (!current || feedback || !autoSpeak) return
    if (spokenId.current === current.id) return
    spokenId.current = current.id
    voice.speak(current.spoken_text)
  }, [current, feedback, autoSpeak, voice])

  useEffect(() => {
    if (!voice.recording) return undefined
    const timer = setInterval(() => setElapsed(Date.now() - startedAt.current), 250)
    return () => clearInterval(timer)
  }, [voice.recording])

  const record = async () => {
    setError('')
    startedAt.current = Date.now()
    setElapsed(0)
    await voice.startRecording()
  }

  const stop = async () => {
    const heard = await voice.stopRecording()
    if (heard) setDraft((existing) => (existing ? `${existing} ${heard}` : heard).trim())
  }

  const submit = async () => {
    if (!draft.trim()) { setError('Say or type something first — or skip the question.'); return }
    setBusy('answer'); setError('')
    voice.stopSpeaking()
    try {
      const result = await interviewApi(`/sessions/${state.session.id}/answer`, {
        method: 'POST',
        signal: patientSignal(),
        body: JSON.stringify({
          question_id: current.id,
          transcript: draft.trim(),
          duration_ms: elapsed,
          spoken_via: setup.stt_provider,
        }),
      })
      setFeedback({ ...result.grade, follow_up_added: result.follow_up_added })
      onState(result)
      setDraft('')
      setElapsed(0)
    } catch (requestError) {
      setError(requestError.message)
    }
    setBusy('')
  }

  const skip = async () => {
    setBusy('skip'); setError('')
    voice.stopSpeaking()
    try {
      onState(await interviewApi(`/sessions/${state.session.id}/skip`, {
        method: 'POST',
        body: JSON.stringify({ question_id: current.id, transcript: '' }),
      }))
      setDraft('')
    } catch (requestError) { setError(requestError.message) }
    setBusy('')
  }

  const finish = async () => {
    setBusy('finish'); setError('')
    voice.stopSpeaking()
    try {
      onFinished(await interviewApi(`/sessions/${state.session.id}/finish`, {
        method: 'POST', signal: patientSignal(),
      }))
    } catch (requestError) { setError(requestError.message) }
    setBusy('')
  }

  const percent = Math.round((progress.answered / Math.max(progress.asked, 1)) * 100)

  if (!current && !feedback) {
    return (
      <div className="ia-pane ia-done">
        <CheckCircle2 size={34} />
        <h2>Every question answered</h2>
        <p>{progress.answered} answers, running average {progress.running_average}/10.</p>
        <button className="ia-primary ia-big" onClick={finish} disabled={busy === 'finish'}>
          {busy === 'finish' ? <><Loader2 size={15} className="ia-spin" /> Writing your report…</> : 'See the full report'}
        </button>
      </div>)
  }

  return (
    <div className="ia-pane ia-live">
      <div className="ia-progress">
        <div className="ia-progress-bar"><span style={{ width: `${percent}%` }} /></div>
        <div className="ia-progress-meta">
          <span>Question <strong>{progress.position}</strong> of {progress.planned}</span>
          {progress.follow_ups > 0 && <span className="ia-pill">+{progress.follow_ups} follow-ups</span>}
          <span className="ia-muted">running average {progress.running_average}/10</span>
          <button className="ia-ghost ia-small" onClick={finish} disabled={busy === 'finish'}>
            <Flag size={12} /> Finish early
          </button>
        </div>
      </div>

      {feedback ? (
        <section className={`ia-card ia-feedback score-${Math.round(feedback.score / 2)}`}>
          <header className="ia-card-head">
            <h3>{feedback.score >= 7 ? 'Strong answer' : feedback.score >= 5 ? 'Reasonable answer' : 'Needs work'}</h3>
            <span className="ia-score">{feedback.score}<em>/10</em></span>
          </header>
          <p className="ia-verdict">{feedback.verdict}</p>
          <div className="ia-feedback-grid">
            {feedback.strengths?.length > 0 && (
              <div><span className="ia-sublabel">What worked</span>
                <ul>{feedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>)}
            {feedback.gaps?.length > 0 && (
              <div><span className="ia-sublabel">What was missing</span>
                <ul className="ia-gaps">{feedback.gaps.map((item) => <li key={item}>{item}</li>)}</ul></div>)}
          </div>
          {feedback.ideal_answer && (
            <div className="ia-ideal">
              <span className="ia-sublabel">What a strong answer sounds like</span>
              <p>{feedback.ideal_answer}</p>
            </div>)}
          {feedback.follow_up_added && (
            <p className="ia-notice">Your answer earned a follow-up. It does not count towards your total.</p>)}
          <div className="ia-actions">
            <button className="ia-primary" onClick={() => setFeedback(null)}>
              {state.current ? <>Next question <ArrowRight size={14} /></> : 'Finish up'} 
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="ia-card ia-question">
            <header className="ia-question-head">
              <span className="ia-tag">{current.kind_label}</span>
              <span className="ia-tag ghost">{current.difficulty}</span>
              {current.topic && <span className="ia-tag ghost">{current.topic}</span>}
              {current.is_follow_up && <span className="ia-tag follow">follow-up</span>}
              <button className="ia-icon-button" onClick={() => voice.speak(current.spoken_text)}
                      disabled={voice.speaking} aria-label="Read the question again">
                {voice.speaking ? <Pause size={15} /> : <Volume2 size={15} />}
              </button>
            </header>
            <p className="ia-question-text">{current.text}</p>
          </section>

          <section className="ia-card ia-answer">
            <div className="ia-record-row">
              {voice.recording ? (
                <button className="ia-record recording" onClick={stop}>
                  <Square size={18} /> Stop · {clock(elapsed)}
                </button>
              ) : (
                <button className="ia-record" onClick={record} disabled={voice.transcribing}>
                  {voice.transcribing
                    ? <><Loader2 size={18} className="ia-spin" /> Transcribing…</>
                    : <><Mic size={18} /> {draft ? 'Record more' : 'Record your answer'}</>}
                </button>)}
              <label className="ia-toggle small">
                <input type="checkbox" checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} />
                <span>Read questions aloud</span>
              </label>
              <span className="ia-muted">
                hearing: {setup.stt_provider} · voice: {setup.tts_provider}
              </span>
            </div>

            {voice.interim && <p className="ia-interim">{voice.interim}</p>}
            {voice.error && <p className="ia-error">{voice.error}</p>}

            <textarea rows={7} value={draft} onChange={(event) => setDraft(event.target.value)}
                      placeholder="Your answer appears here as you speak. Correct anything the transcriber misheard — you are graded on this text, not on the audio." />
            <div className="ia-answer-meta">
              <span className="ia-muted">{draft.trim() ? draft.trim().split(/\s+/).length : 0} words</span>
              <span className="ia-muted">{tips?.[progress.position % (tips?.length || 1)]}</span>
            </div>

            {error && <p className="ia-error">{error}</p>}

            <div className="ia-actions">
              <button className="ia-primary" onClick={submit} disabled={busy === 'answer' || voice.recording}>
                {busy === 'answer' ? <><Loader2 size={14} className="ia-spin" /> Grading…</> : <>Submit answer <ArrowRight size={14} /></>}
              </button>
              <button className="ia-ghost" onClick={skip} disabled={busy === 'skip' || voice.recording}>
                <SkipForward size={13} /> Skip
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
