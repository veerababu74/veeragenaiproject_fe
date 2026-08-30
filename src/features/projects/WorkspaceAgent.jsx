import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Bot, CalendarDays, CheckCircle2, ChevronDown, Clock3, ExternalLink, Link2, Link2Off, Mail, MessageSquarePlus, Send, Sparkles, Trash2, UserRound } from 'lucide-react'
import { api } from '../../lib/api'
import MarkdownContent from '../../components/MarkdownContent'
import './WorkspaceAgent.css'

const PROVIDERS = {
  openai: { label: 'OpenAI', model: 'gpt-4o' },
  gemini: { label: 'Google Gemini', model: 'gemini-flash-lite-latest' },
  mistral: { label: 'Mistral AI', model: 'mistral-large-latest' },
  groq: { label: 'GroqCloud', model: 'openai/gpt-oss-120b' },
  openrouter: { label: 'OpenRouter', model: 'openai/gpt-4o' },
}
const QUICK_PROMPTS = [
  ['Important mail', 'Show my important emails from the last 14 days'],
  ['Today’s meetings', 'What meetings do I have today?'],
  ['Plan a meeting', 'Book a 30 minute meeting tomorrow at 10 AM'],
]
const LIVE_STEPS = [
  ['understand', 'Understanding your request'],
  ['plan', 'Selecting a Gmail or Calendar tool'],
  ['google', 'Contacting Google Workspace'],
  ['answer', 'Preparing a grounded response'],
]

function ResultData({ data }) {
  if (!Array.isArray(data) || !data.length) return null
  return <div className="workspace-results">{data.map((item) => item.subject ? <article key={item.id}>
    <Mail size={15} /><div><strong>{item.subject}</strong><span>{item.from}</span><p>{item.snippet}</p></div>{item.important && <small>Important</small>}
  </article> : <article key={item.id}>
    <CalendarDays size={15} /><div><strong>{item.summary}</strong><span>{item.start}</span>{item.location && <p>{item.location}</p>}</div>{item.html_link && <a href={item.html_link} target="_blank" rel="noreferrer" title="Open in Google Calendar"><ExternalLink size={14} /></a>}
  </article>)}</div>
}

export default function WorkspaceAgent({ onBack }) {
  const [connection, setConnection] = useState({ connected: false, configured: true, email: null })
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [provider, setProvider] = useState('gemini')
  const [model, setModel] = useState(PROVIDERS.gemini.model)
  const [apiKey, setApiKey] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(() => new URLSearchParams(window.location.search).get('google_error') || '')
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [liveStep, setLiveStep] = useState(0)
  const confirmDialog = useRef(null)
  const messageEnd = useRef(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const linked = params.get('google') === 'linked'
    const oauthError = params.get('google_error')
    if (linked || oauthError) window.history.replaceState({}, '', window.location.pathname)
    Promise.all([api('/workspace-agent/connection'), api('/workspace-agent/sessions')]).then(async ([account, items]) => {
      setConnection(account)
      setSessions(items)
      if (items[0]) {
        const result = await api(`/workspace-agent/sessions/${items[0].id}`)
        setSessionId(result.session.id)
        setProvider(result.session.provider)
        setModel(result.session.model)
        setMessages(result.messages)
      }
    }).catch((requestError) => setError(requestError.message))
  }, [])
  useEffect(() => { messageEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])
  useEffect(() => { if (confirmTarget && !confirmDialog.current?.open) confirmDialog.current?.showModal() }, [confirmTarget])
  useEffect(() => {
    if (busy !== 'message') return undefined
    const timer = setInterval(() => setLiveStep((current) => Math.min(current + 1, LIVE_STEPS.length - 1)), 1100)
    return () => clearInterval(timer)
  }, [busy])

  async function connectGoogle() {
    if (!connection.configured) {
      setError('Google OAuth needs GOOGLE_CLIENT_SECRET in the backend .env. Restart the backend after adding it.')
      return
    }
    setBusy('connect')
    try {
      const result = await api(`/workspace-agent/google/authorize?return_url=${encodeURIComponent(window.location.origin)}`)
      window.location.assign(result.authorization_url)
    } catch (requestError) { setError(requestError.message); setBusy('') }
  }

  async function unlinkGoogle() {
    setBusy('unlink')
    try {
      await api('/workspace-agent/connection', { method: 'DELETE' })
      setConnection({ connected: false, configured: connection.configured, email: null })
      setConfirmTarget(null)
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  function newSession() {
    setSessionId(null)
    setMessages([])
    setError('')
  }

  async function openSession(id) {
    setBusy('session')
    try {
      const result = await api(`/workspace-agent/sessions/${id}`)
      setSessionId(id)
      setProvider(result.session.provider)
      setModel(result.session.model)
      setMessages(result.messages)
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  async function removeSession() {
    setBusy('delete')
    try {
      await api(`/workspace-agent/sessions/${confirmTarget.id}`, { method: 'DELETE' })
      const remaining = sessions.filter((item) => item.id !== confirmTarget.id)
      setSessions(remaining)
      setConfirmTarget(null)
      newSession()
      if (remaining[0]) await openSession(remaining[0].id)
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  async function sendMessage(event) {
    event?.preventDefault()
    const message = draft.trim()
    if (!message || busy) return
    if (!connection.connected) { setError('Connect Gmail and Google Calendar first'); return }
    if (apiKey.trim().length < 8) { setError('Enter a valid LLM API key'); return }
    setDraft('')
    setError('')
    setLiveStep(0)
    setBusy('message')
    setMessages((current) => [...current, { role: 'user', content: message, trace: [] }])
    try {
      const result = await api('/workspace-agent/messages', { method: 'POST', body: JSON.stringify({ session_id: sessionId, provider, api_key: apiKey.trim(), model, message }) })
      setSessionId(result.session.id)
      setMessages(result.messages)
      setSessions((current) => [result.session, ...current.filter((item) => item.id !== result.session.id)])
    } catch (requestError) { setMessages((current) => current.slice(0, -1)); setDraft(message); setError(requestError.message) } finally { setBusy('') }
  }

  async function confirmAction(messageId) {
    setBusy('action')
    try {
      const result = await api('/workspace-agent/actions/confirm', { method: 'POST', body: JSON.stringify({ message_id: messageId }) })
      setMessages(result.messages)
      setConfirmTarget(null)
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  const latestTrace = messages.findLast((message) => message.trace?.length)?.trace || []
  const shownTrace = busy === 'message' ? LIVE_STEPS.slice(0, liveStep + 1).map(([step, detail], index) => ({ step, detail, status: index < liveStep ? 'complete' : 'running' })) : latestTrace

  return <section className="workspace-agent-app">
    <header className="workspace-agent-header">
      <button className="icon-button" onClick={onBack} title="Back to projects"><ArrowLeft size={20} /></button>
      <div><span>CONNECTED OPERATIONS</span><h1>Google Workspace Agent</h1></div>
      <div className={`google-connection ${connection.connected ? 'connected' : ''}`}>
        <span><i />{connection.connected ? connection.email : 'Google not connected'}</span>
        {connection.connected ? <button onClick={() => setConfirmTarget({ type: 'unlink' })}><Link2Off size={15} /> Unlink</button> : <button onClick={connectGoogle} disabled={busy === 'connect'}><Link2 size={15} /> {busy === 'connect' ? 'Opening Google...' : connection.configured ? 'Connect Gmail + Calendar' : 'OAuth setup required'}</button>}
      </div>
    </header>

    <div className="workspace-agent-grid">
      <aside className="agent-control-panel">
        <section><label>LLM provider<div className="select-wrap"><select value={provider} onChange={(event) => { const next = event.target.value; setProvider(next); setModel(PROVIDERS[next].model); newSession() }}>{Object.entries(PROVIDERS).map(([value, item]) => <option value={value} key={value}>{item.label}</option>)}</select><ChevronDown size={15} /></div></label><label>Model<input value={model} onChange={(event) => { setModel(event.target.value); newSession() }} /></label><label>API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Request-only, never saved" maxLength="500" autoComplete="off" /></label></section>
        <button className="agent-new-session" onClick={newSession}><MessageSquarePlus size={16} /> New conversation</button>
        <div className="agent-session-title"><span>CONVERSATIONS</span><small>{sessions.length}</small></div>
        <div className="agent-session-list">{sessions.map((item) => <button className={item.id === sessionId ? 'active' : ''} key={item.id} onClick={() => openSession(item.id)}><span>{item.title}</span><i onClick={(event) => { event.stopPropagation(); setConfirmTarget({ type: 'session', id: item.id, name: item.title }) }} title="Delete conversation"><Trash2 size={13} /></i></button>)}{!sessions.length && <p>No conversations yet</p>}</div>
      </aside>

      <main className="agent-conversation">
        <div className="agent-messages" aria-live="polite">
          {!messages.length && <div className="agent-welcome"><div><Sparkles size={25} /></div><span>YOUR GOOGLE WORKSPACE, IN CONVERSATION</span><h2>Ask. Review. Approve.</h2><p>Read important mail, inspect your schedule, and prepare calendar changes with a clear audit trail.</p><div>{QUICK_PROMPTS.map(([label, prompt]) => <button onClick={() => setDraft(prompt)} key={label}>{label}</button>)}</div></div>}
          {messages.map((message) => <article className={`agent-message ${message.role}`} key={message.id || `${message.role}-${message.content}`}><div className="agent-avatar">{message.role === 'assistant' ? <Bot size={17} /> : <UserRound size={17} />}</div><div><strong>{message.role === 'assistant' ? 'Workspace agent' : 'You'}</strong>{message.role === 'assistant' ? <MarkdownContent>{message.content}</MarkdownContent> : <p>{message.content}</p>}<ResultData data={message.data} />{message.pending_action && message.pending_status === 'pending' && <div className="pending-action"><AlertTriangle size={17} /><div><b>Calendar change needs approval</b><span>{message.pending_action.action === 'calendar_create' ? `Create: ${message.pending_action.arguments.summary}` : 'Remove this calendar event'}</span></div><button onClick={() => setConfirmTarget({ type: 'action', id: message.id, action: message.pending_action })}>Review</button></div>}{message.pending_status === 'completed' && <span className="action-complete"><CheckCircle2 size={13} /> Action completed</span>}</div></article>)}
          {busy === 'message' && <article className="agent-message assistant"><div className="agent-avatar"><Bot size={17} /></div><div><strong>Workspace agent</strong><p className="agent-thinking">Understanding your request and selecting a safe tool...</p></div></article>}
          <div ref={messageEnd} />
        </div>
        {error && <p className="agent-error" role="alert">{error}</p>}
        <form className="agent-composer" onSubmit={sendMessage}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={connection.connected ? 'Ask about Gmail or your calendar...' : 'Connect Google to begin'} disabled={!connection.connected} rows="1" maxLength="10000" /><button disabled={!draft.trim() || Boolean(busy)} title="Send"><Send size={18} /></button></form>
      </main>

      <aside className="agent-trace-panel">
        <header><Clock3 size={16} /><div><strong>Agent activity</strong><span>Latest execution</span></div></header>
        <div className="agent-trace">{shownTrace.map((step, index) => <article className={step.status} key={`${step.step}-${index}`}><i>{step.status === 'complete' ? <CheckCircle2 size={14} /> : index + 1}</i><div><strong>{step.step}</strong><p>{step.detail}</p>{step.arguments && <pre>{JSON.stringify(step.arguments, null, 2)}</pre>}</div></article>)}{!shownTrace.length && <p>Tool selection, Google calls, and approvals will appear here.</p>}</div>
        <section className="agent-permissions"><strong>Connected permissions</strong><p><Mail size={14} /> Read Gmail</p><p><CalendarDays size={14} /> Manage calendar events</p><small>Calendar changes always require approval.</small></section>
      </aside>
    </div>

    {confirmTarget && <dialog ref={confirmDialog} className="agent-confirm-dialog" onCancel={() => setConfirmTarget(null)}>
      <div className="agent-confirm-icon"><AlertTriangle size={22} /></div>
      <h2>{confirmTarget.type === 'action' ? 'Approve calendar change?' : confirmTarget.type === 'unlink' ? 'Unlink Google account?' : 'Delete conversation?'}</h2>
      {confirmTarget.type === 'action' ? <><p>The agent will now perform this action in Google Calendar.</p><pre>{JSON.stringify(confirmTarget.action.arguments, null, 2)}</pre></> : <p>{confirmTarget.type === 'unlink' ? 'Stored access will be removed and Google authorization will be revoked.' : `${confirmTarget.name} and its messages will be permanently deleted.`}</p>}
      <div><button autoFocus onClick={() => setConfirmTarget(null)}>Cancel</button><button className="danger-button" disabled={Boolean(busy)} onClick={() => confirmTarget.type === 'action' ? confirmAction(confirmTarget.id) : confirmTarget.type === 'unlink' ? unlinkGoogle() : removeSession()}>{busy ? 'Working...' : confirmTarget.type === 'action' ? 'Approve action' : confirmTarget.type === 'unlink' ? 'Unlink' : 'Delete'}</button></div>
    </dialog>}
  </section>
}
