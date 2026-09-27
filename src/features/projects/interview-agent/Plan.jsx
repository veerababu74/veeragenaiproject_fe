import { useEffect, useState } from 'react'
import { CalendarClock, Loader2, Play, Plus, Shuffle, Trash2, X } from 'lucide-react'
import { interviewApi, patientSignal } from './api'

/* Choosing the shape of the interview.
 *
 * The distribution preview under the type picker is computed here with the same
 * largest-remainder split the server uses, so the promise it makes — "20
 * questions: 5 conceptual, 5 scenario, 5 deep-dive, 5 behavioural" — is the
 * plan that actually gets built. Showing a guess that the server then quietly
 * contradicts would undermine the one guarantee this project is built around.
 */

function allocate(count, types) {
  if (types.length === 0) return {}
  const base = Math.floor(count / types.length)
  const extra = count % types.length
  return Object.fromEntries(types.map((kind, index) => [kind, base + (index < extra ? 1 : 0)]))
}

export default function Plan({ ready, briefReady, sessions, onStarted, onResume, onDelete }) {
  const [options, setOptions] = useState(null)
  const [role, setRole] = useState('')
  const [topics, setTopics] = useState([])
  const [topicDraft, setTopicDraft] = useState('')
  const [types, setTypes] = useState([])
  const [count, setCount] = useState(20)
  const [difficulty, setDifficulty] = useState('mixed')
  const [followUps, setFollowUps] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    interviewApi('/options').then((data) => {
      setOptions(data)
      setTypes(data.default_types)
      setCount(data.default_questions)
      setRole(data.suggested_roles?.[0] || '')
    }).catch((requestError) => setError(requestError.message))
  }, [briefReady])

  if (!options) return <div className="ia-loading"><Loader2 size={18} className="ia-spin" /> Loading…</div>

  const addTopic = (value) => {
    const topic = value.trim()
    if (topic && !topics.includes(topic)) setTopics([...topics, topic])
    setTopicDraft('')
  }
  const toggleType = (id) => setTypes((current) =>
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const split = allocate(count, types)
  const blocked = !ready ? 'Add a chat model key in Setup first.'
    : !briefReady ? 'Build your candidate brief on the Profile tab first — the questions come from it.'
    : types.length === 0 ? 'Pick at least one question type.' : ''

  const start = async () => {
    setStarting(true); setError('')
    try {
      const state = await interviewApi('/sessions', {
        method: 'POST',
        signal: patientSignal(),
        body: JSON.stringify({ role, topics, types, difficulty, question_count: count, follow_ups: followUps }),
      })
      onStarted(state)
    } catch (requestError) {
      setError(requestError.message)
    }
    setStarting(false)
  }

  return (
    <div className="ia-pane">
      <section className="ia-card">
        <header className="ia-card-head"><h3>The role</h3></header>
        <input value={role} placeholder="Senior Backend Engineer"
               onChange={(event) => setRole(event.target.value)} />
        {(options.suggested_roles || []).length > 0 && (
          <div className="ia-chips">
            {options.suggested_roles.map((item) => (
              <button key={item} type="button" className="ia-chip button" onClick={() => setRole(item)}>{item}</button>))}
          </div>)}
      </section>

      <section className="ia-card">
        <header className="ia-card-head">
          <h3>Topics</h3>
          <span className="ia-muted">leave empty and it uses the topics from your brief</span>
        </header>
        <div className="ia-inline-form">
          <input value={topicDraft} placeholder="Kubernetes, Postgres indexing, event-driven design…"
                 onChange={(event) => setTopicDraft(event.target.value)}
                 onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTopic(topicDraft) } }} />
          <button className="ia-ghost" onClick={() => addTopic(topicDraft)}><Plus size={14} /> Add</button>
        </div>
        {topics.length > 0 && (
          <div className="ia-chips">
            {topics.map((topic) => (
              <span key={topic} className="ia-chip strong">
                {topic}
                <button type="button" onClick={() => setTopics(topics.filter((item) => item !== topic))}
                        aria-label={`Remove ${topic}`}><X size={11} /></button>
              </span>))}
          </div>)}
        {(options.suggested_topics || []).length > 0 && (
          <>
            <span className="ia-sublabel">From your brief</span>
            <div className="ia-chips">
              {options.suggested_topics.filter((item) => !topics.includes(item)).map((item) => (
                <button key={item} type="button" className="ia-chip button" onClick={() => addTopic(item)}>
                  <Plus size={10} /> {item}
                </button>))}
            </div>
          </>)}
      </section>

      <section className="ia-card">
        <header className="ia-card-head">
          <h3>How many questions</h3>
          <span className="ia-count-badge">{count}</span>
        </header>
        <input className="ia-range" type="range"
               min={options.min_questions} max={options.max_questions} step={1}
               value={count} onChange={(event) => setCount(Number(event.target.value))} />
        <div className="ia-range-scale"><span>{options.min_questions}</span><span>20 · a real screen</span><span>{options.max_questions}</span></div>
        <p className="ia-note">{options.note}</p>
      </section>

      <section className="ia-card">
        <header className="ia-card-head">
          <h3>Question types</h3>
          <span className="ia-muted">{types.length} selected</span>
        </header>
        <div className="ia-type-grid">
          {options.types.map((type) => {
            const on = types.includes(type.id)
            return (
              <button key={type.id} type="button" className={`ia-type ${on ? 'active' : ''}`}
                      onClick={() => toggleType(type.id)}>
                <span className="ia-type-head">
                  <strong>{type.label}</strong>
                  {on && <em>{split[type.id]}×</em>}
                </span>
                <span className="ia-type-desc">{type.description}</span>
                <span className="ia-type-example">“{type.example}”</span>
                <span className="ia-type-graded">Graded on {type.graded_on}</span>
              </button>)
          })}
        </div>
      </section>

      <section className="ia-card">
        <header className="ia-card-head"><h3>Difficulty</h3></header>
        <div className="ia-choice-row">
          {options.difficulties.map((item) => (
            <button key={item.id} type="button"
                    className={`ia-choice ${difficulty === item.id ? 'active' : ''}`}
                    onClick={() => setDifficulty(item.id)}>
              {item.id === 'mixed' && <Shuffle size={12} />} {item.id}
            </button>))}
        </div>
        <p className="ia-note">{options.difficulties.find((item) => item.id === difficulty)?.description}</p>
        <label className="ia-toggle">
          <input type="checkbox" checked={followUps} onChange={(event) => setFollowUps(event.target.checked)} />
          <span>Ask follow-ups when an answer leaves something open. They do not count towards the {count}.</span>
        </label>
      </section>

      {error && <p className="ia-error">{error}</p>}
      {blocked && <p className="ia-notice">{blocked}</p>}

      <div className="ia-actions ia-actions-wide">
        <button className="ia-primary ia-big" onClick={start} disabled={Boolean(blocked) || starting}>
          {starting
            ? <><Loader2 size={15} className="ia-spin" /> Writing {count} questions for you…</>
            : <><Play size={15} /> Start the interview</>}
        </button>
      </div>

      {sessions.length > 0 && (
        <section className="ia-card">
          <header className="ia-card-head"><h3><CalendarClock size={15} /> Previous interviews</h3></header>
          <ul className="ia-history">
            {sessions.map((item) => (
              <li key={item.id}>
                <button className="ia-history-open" onClick={() => onResume(item.id)}>
                  <strong>{item.role || 'Interview'}</strong>
                  <span className="ia-muted">
                    {item.created_at?.slice(0, 16)} · {item.answered}/{item.question_count} answered
                    {item.average > 0 && ` · ${item.average}/10`}
                  </span>
                </button>
                <span className={`ia-status ${item.status}`}>{item.band || item.status}</span>
                <button className="ia-icon-button" onClick={() => onDelete(item.id)} aria-label="Delete interview">
                  <Trash2 size={13} />
                </button>
              </li>))}
          </ul>
        </section>)}
    </div>
  )
}
