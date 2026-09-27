import { useRef, useState } from 'react'
import {
  AlertTriangle, Briefcase, CheckCircle2, FileText, GitBranch, Loader2, Sparkles, Star, Upload, X,
} from 'lucide-react'
import { interviewApi, patientSignal } from './api'

/* The three sources, and the brief they are distilled into.
 *
 * The honesty about LinkedIn is deliberate and it is rendered, not hidden in a
 * comment: there is no public profile API and scraping it breaks their terms,
 * so the user pastes their own text. Every product that claims to "import your
 * LinkedIn" is either scraping it or asking you to paste it, and pretending
 * otherwise here would only make the paste box look like a bug.
 */

export default function Profile({ profile, guide, onProfile, onGoToPlan }) {
  const fileInput = useRef(null)
  const [github, setGithub] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [linkedinText, setLinkedinText] = useState('')
  const [pasted, setPasted] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const run = async (label, work) => {
    setBusy(label); setError('')
    try { onProfile(await work()) } catch (requestError) { setError(requestError.message) }
    setBusy('')
  }

  const uploadResume = (file) => {
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    run('resume', () => interviewApi('/profile/resume', { method: 'POST', body }))
  }

  const saveSources = (payload) => run('sources',
    () => interviewApi('/profile/sources', { method: 'POST', body: JSON.stringify(payload) }))

  const buildBrief = () => run('brief',
    () => interviewApi('/profile/brief', { method: 'POST', signal: patientSignal() }))

  const clear = () => run('clear', async () => {
    await interviewApi('/profile', { method: 'DELETE' })
    return interviewApi('/profile')
  })

  const brief = profile?.brief || {}
  const hasBrief = Boolean(brief.name || brief.headline || (brief.skills || []).length)
  const sourceHelp = Object.fromEntries((guide?.sources || []).map((item) => [item.source, item]))

  return (
    <div className="ia-pane">
      <div className="ia-card ia-intro">
        <h3><Sparkles size={15} /> Build the brief first</h3>
        <p>
          The questions are written from this. Give it whatever you have — the more sources, the
          more the interview is about you rather than about the job title.
        </p>
      </div>

      <div className="ia-source-grid">
        {/* ── resume ── */}
        <section className="ia-card">
          <header className="ia-card-head">
            <h3><FileText size={15} /> Resume</h3>
            {profile?.resume_chars > 0 && (
              <span className="ia-pill-good"><CheckCircle2 size={12} /> {profile.resume_chars.toLocaleString()} chars</span>)}
          </header>
          <p className="ia-note">{sourceHelp.Resume?.how}</p>
          <input ref={fileInput} type="file" accept=".pdf,.docx,.txt,.md" hidden
                 onChange={(event) => uploadResume(event.target.files?.[0])} />
          <div className="ia-actions">
            <button className="ia-primary" onClick={() => fileInput.current?.click()} disabled={busy === 'resume'}>
              {busy === 'resume' ? <><Loader2 size={14} className="ia-spin" /> Reading…</>
                : <><Upload size={14} /> {profile?.resume_name ? 'Replace file' : 'Upload file'}</>}
            </button>
            <button className="ia-ghost" onClick={() => setShowPaste(!showPaste)}>
              {showPaste ? 'Cancel' : 'Paste text instead'}
            </button>
          </div>
          {profile?.resume_name && <p className="ia-muted">Loaded: {profile.resume_name}</p>}
          {showPaste && (
            <>
              <textarea rows={6} value={pasted} placeholder="Paste your resume text here"
                        onChange={(event) => setPasted(event.target.value)} />
              <button className="ia-primary" disabled={!pasted.trim() || busy === 'sources'}
                      onClick={() => { saveSources({ resume_text: pasted }); setShowPaste(false) }}>
                Save text
              </button>
            </>
          )}
          <p className="ia-caveat"><AlertTriangle size={12} /> {sourceHelp.Resume?.caveat}</p>
        </section>

        {/* ── github ── */}
        <section className="ia-card">
          <header className="ia-card-head">
            <h3><GitBranch size={15} /> GitHub</h3>
            {profile?.github?.username && (
              <span className="ia-pill-good"><CheckCircle2 size={12} /> {profile.github.public_repos} repos</span>)}
          </header>
          <p className="ia-note">{sourceHelp.GitHub?.how}</p>
          <div className="ia-inline-form">
            <input value={github} placeholder="github.com/yourname, or just yourname"
                   onChange={(event) => setGithub(event.target.value)} />
            <button className="ia-primary" disabled={!github.trim() || busy === 'sources'}
                    onClick={() => saveSources({ github })}>
              {busy === 'sources' ? <Loader2 size={14} className="ia-spin" /> : 'Fetch'}
            </button>
          </div>
          {profile?.github?.username && (
            <div className="ia-github">
              <p><strong>{profile.github.name || profile.github.username}</strong>
                {profile.github.bio && <span> — {profile.github.bio}</span>}</p>
              <div className="ia-chips">
                {(profile.github.languages || []).slice(0, 6).map((item) => (
                  <span key={item.language} className="ia-chip">{item.language}</span>))}
              </div>
              <ul className="ia-repo-list">
                {(profile.github.repositories || []).slice(0, 4).map((repo) => (
                  <li key={repo.name}>
                    <a href={repo.url} target="_blank" rel="noreferrer">{repo.name}</a>
                    <span className="ia-muted"> {repo.language} · <Star size={10} /> {repo.stars}</span>
                  </li>))}
              </ul>
            </div>
          )}
          <p className="ia-caveat"><AlertTriangle size={12} /> {sourceHelp.GitHub?.caveat}</p>
        </section>

        {/* ── linkedin ── */}
        <section className="ia-card">
          <header className="ia-card-head">
            <h3><Briefcase size={15} /> LinkedIn</h3>
            {profile?.linkedin_chars > 0 && (
              <span className="ia-pill-good"><CheckCircle2 size={12} /> {profile.linkedin_chars.toLocaleString()} chars</span>)}
          </header>
          <p className="ia-note">{sourceHelp.LinkedIn?.how}</p>
          <input value={linkedinUrl} placeholder="https://linkedin.com/in/yourname"
                 onChange={(event) => setLinkedinUrl(event.target.value)} />
          <textarea rows={6} value={linkedinText}
                    placeholder="Paste your About section and your Experience entries here"
                    onChange={(event) => setLinkedinText(event.target.value)} />
          <button className="ia-primary"
                  disabled={(!linkedinUrl.trim() && !linkedinText.trim()) || busy === 'sources'}
                  onClick={() => saveSources({ linkedin_url: linkedinUrl, linkedin_text: linkedinText })}>
            Save LinkedIn
          </button>
          <p className="ia-caveat"><AlertTriangle size={12} /> {sourceHelp.LinkedIn?.caveat}</p>
        </section>
      </div>

      {error && <p className="ia-error">{error}</p>}

      <div className="ia-actions ia-actions-wide">
        <button className="ia-primary ia-big" onClick={buildBrief}
                disabled={!profile?.has_sources || busy === 'brief'}>
          {busy === 'brief'
            ? <><Loader2 size={15} className="ia-spin" /> Reading your sources…</>
            : <><Sparkles size={15} /> {hasBrief ? 'Rebuild brief' : 'Build candidate brief'}</>}
        </button>
        {profile?.has_sources && (
          <button className="ia-ghost" onClick={clear} disabled={busy === 'clear'}>
            <X size={13} /> Clear everything
          </button>)}
      </div>

      {hasBrief && (
        <section className="ia-card ia-brief">
          <header className="ia-card-head">
            <h3><Sparkles size={15} /> {brief.name || 'Candidate'} — the interviewer's brief</h3>
            <span className="ia-pill">{brief.seniority} · {brief.years_experience} yrs</span>
          </header>
          <p className="ia-headline">{brief.headline}</p>
          <p>{brief.summary}</p>

          <div className="ia-chips">
            {(brief.primary_stack || []).map((item) => <span key={item} className="ia-chip strong">{item}</span>)}
          </div>

          <div className="ia-brief-grid">
            <div>
              <span className="ia-sublabel">Skills, and the evidence behind them</span>
              <ul>
                {(brief.skills || []).slice(0, 10).map((item) => (
                  <li key={item.skill}>
                    <strong>{item.skill}</strong>
                    <em className={item.confidence === 'demonstrated' ? 'good' : ''}> {item.confidence}</em>
                    <span className="ia-muted"> — {item.evidence}</span>
                  </li>))}
              </ul>
            </div>
            <div>
              <span className="ia-sublabel">What the interview will press on</span>
              <ul>
                {(brief.probe_areas || []).map((item) => (
                  <li key={item.area}><strong>{item.area}</strong><span className="ia-muted"> — {item.why}</span></li>))}
              </ul>
              {(brief.contradictions || []).length > 0 && (
                <>
                  <span className="ia-sublabel">Where the sources disagree</span>
                  <ul className="ia-contradictions">
                    {brief.contradictions.map((item) => <li key={item}><AlertTriangle size={11} /> {item}</li>)}
                  </ul>
                </>
              )}
            </div>
          </div>

          <div className="ia-actions">
            <button className="ia-primary" onClick={onGoToPlan}>Plan the interview →</button>
          </div>
        </section>
      )}
    </div>
  )
}
