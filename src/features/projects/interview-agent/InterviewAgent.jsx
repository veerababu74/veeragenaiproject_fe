import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, BarChart3, Clock3, KeyRound, ListChecks, Loader2, Mic, UserRound, X,
} from 'lucide-react'
import { interviewApi } from './api'
import Guide from './Guide'
import LiveInterview from './LiveInterview'
import Plan from './Plan'
import Profile from './Profile'
import Report from './Report'
import Setup from './Setup'
import './InterviewAgent.css'

/* The shell.
 *
 * All the interview state lives on the server and is returned whole by every
 * call that changes it — answer, skip and finish each hand back the full
 * session. So there is one `session` object here and no client-side store: a
 * half-answered interview survives a refresh, a closed laptop and a different
 * device, which a store in memory would not.
 */

const TABS = [
  { id: 'guide', label: 'How it works', icon: ListChecks },
  { id: 'setup', label: 'Setup', icon: KeyRound },
  { id: 'profile', label: 'Your profile', icon: UserRound },
  { id: 'plan', label: 'Plan', icon: ListChecks },
  { id: 'interview', label: 'Interview', icon: Mic },
  { id: 'report', label: 'Report', icon: BarChart3 },
]

export default function InterviewAgent({ onBack }) {
  const [tab, setTab] = useState('guide')
  const [guide, setGuide] = useState(null)
  const [setup, setSetup] = useState(null)
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')

  const loadSessions = useCallback(
    () => interviewApi('/sessions').then((data) => setSessions(data.sessions)).catch(() => {}), [])

  useEffect(() => {
    Promise.all([interviewApi('/guide'), interviewApi('/setup'), interviewApi('/profile')])
      .then(([guideData, setupData, profileData]) => {
        setGuide(guideData)
        setSetup(setupData)
        setProfile(profileData)
        // Land people where they left off rather than on the explanation they
        // have already read: keys but no brief means Profile, both means Plan.
        if (setupData.ready) setTab(profileData.brief?.name ? 'plan' : 'profile')
      })
      .catch((requestError) => setError(requestError.message))
    loadSessions()
  }, [loadSessions])

  const openSession = async (id) => {
    try {
      const state = await interviewApi(`/sessions/${id}`)
      setSession(state)
      setTab(state.session.status === 'completed' ? 'report' : 'interview')
    } catch (requestError) { setError(requestError.message) }
  }

  const removeSession = async (id) => {
    try {
      await interviewApi(`/sessions/${id}`, { method: 'DELETE' })
      if (session?.session.id === id) setSession(null)
      loadSessions()
    } catch (requestError) { setError(requestError.message) }
  }

  if (!guide || !setup) {
    return <section className="ia-app ia-booting">
      {error ? <p className="ia-error">{error}</p> : <><Loader2 size={20} className="ia-spin" /> Loading…</>}
    </section>
  }

  const briefReady = Boolean(profile?.brief?.name || profile?.brief?.headline)
  const active = session?.session.status === 'active'

  return (
    <section className="ia-app">
      <header className="ia-header">
        <button className="ia-back" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <div className="ia-brand">
          <span className="ia-brand-icon"><Mic size={17} /></span>
          <div><span>SPOKEN, GRADED, YOURS</span><h1>Live AI Interview</h1></div>
        </div>
        <div className="ia-header-meta">
          <span className={`ia-pill ${setup.ready ? '' : 'warn'}`}>
            {setup.ready ? `${setup.chat_provider}/${setup.chat_model}` : 'no chat key'}
          </span>
          {active && <span className="ia-pill">{session.progress.answered}/{session.progress.asked} answered</span>}
          <span className="ia-pill ghost"><Clock3 size={12} /> 48h retention</span>
        </div>
      </header>

      <nav className="ia-tabs">
        {TABS.map((item) => (
          <button key={item.id} className={tab === item.id ? 'active' : ''}
                  disabled={(item.id === 'interview' || item.id === 'report') && !session}
                  onClick={() => setTab(item.id)}>
            <item.icon size={14} /> {item.label}
          </button>))}
      </nav>

      {error && (
        <div className="ia-banner">
          <p>{error}</p>
          <button onClick={() => setError('')} aria-label="Dismiss"><X size={13} /></button>
        </div>)}

      <div className="ia-body">
        {tab === 'guide' && <Guide guide={guide} onSetup={() => setTab('setup')} />}
        {tab === 'setup' && <Setup setup={setup} onSaved={setSetup} />}
        {tab === 'profile' && (
          <Profile profile={profile} guide={guide} onProfile={setProfile}
                   onGoToPlan={() => setTab('plan')} />)}
        {tab === 'plan' && (
          <Plan ready={setup.ready} briefReady={briefReady} sessions={sessions}
                onStarted={(state) => { setSession(state); setTab('interview'); loadSessions() }}
                onResume={openSession} onDelete={removeSession} />)}
        {tab === 'interview' && session && (
          <LiveInterview state={session} setup={setup} tips={guide.tips} onState={setSession}
                         onFinished={(state) => { setSession(state); setTab('report'); loadSessions() }} />)}
        {tab === 'report' && session && (
          <Report state={session} onRestart={() => { setSession(null); setTab('plan') }} />)}
      </div>

      <footer className="ia-footer">
        Plan written up front so the count and the mix are exact · every answer graded on its own ·
        audio never stored · all data deleted after 48 hours
      </footer>
    </section>
  )
}
