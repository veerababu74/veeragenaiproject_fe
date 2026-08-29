import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Bot, ChevronDown, KeyRound, MessageSquarePlus, Send, Trash2, UserRound } from 'lucide-react'
import { api } from '../../lib/api'
import MarkdownContent from '../../components/MarkdownContent'

const PROVIDERS = {
  openai: { label: 'OpenAI', model: 'gpt-4o' },
  gemini: { label: 'Google Gemini', model: 'gemini-flash-lite-latest' },
  mistral: { label: 'Mistral AI', model: 'mistral-large-latest' },
  groq: { label: 'GroqCloud', model: 'openai/gpt-oss-120b' },
  openrouter: { label: 'OpenRouter', model: 'openai/gpt-4o' },
}

const looksLikeApiKey = (value) => /^(gsk_|sk-|sk_|AIza)/i.test(value.trim())

export default function BasicChat({ onBack }) {
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [provider, setProvider] = useState('openai')
  const [model, setModel] = useState(PROVIDERS.openai.model)
  const [apiKey, setApiKey] = useState('')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const messageEnd = useRef(null)
  const deleteDialog = useRef(null)

  useEffect(() => {
    api('/basic-chat/sessions')
      .then(async (loadedSessions) => {
        setSessions(loadedSessions)
        if (!loadedSessions[0]) return
        const result = await api(`/basic-chat/sessions/${loadedSessions[0].id}`)
        setSessionId(result.session.id)
        setProvider(result.session.provider)
        setModel(result.session.model)
        setMessages(result.messages)
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setSessionsLoading(false))
  }, [])

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])
  useEffect(() => {
    if (deleteTarget && !deleteDialog.current?.open) deleteDialog.current?.showModal()
  }, [deleteTarget])

  function resetChat() {
    setSessionId(null)
    setMessages([])
    setError('')
  }

  async function newChat() {
    resetChat()
    try {
      const session = await api('/basic-chat/sessions', {
        method: 'POST',
        body: JSON.stringify({ provider, model }),
      })
      setSessionId(session.id)
      setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)])
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  function changeProvider(event) {
    const nextProvider = event.target.value
    setProvider(nextProvider)
    setModel(PROVIDERS[nextProvider].model)
    setApiKey('')
    resetChat()
  }

  async function openSession(id) {
    setError('')
    try {
      const result = await api(`/basic-chat/sessions/${id}`)
      setSessionId(result.session.id)
      if (result.session.provider !== provider) setApiKey('')
      setProvider(result.session.provider)
      setModel(result.session.model)
      setMessages(result.messages)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function removeSession(id) {
    try {
      await api(`/basic-chat/sessions/${id}`, { method: 'DELETE' })
      setSessions((current) => current.filter((session) => session.id !== id))
      if (sessionId === id) resetChat()
      setDeleteTarget(null)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function sendMessage(event) {
    event.preventDefault()
    if (!draft.trim() || busy) return
    if (looksLikeApiKey(model)) {
      setError('Your API key appears to be in the Model field. Move it to API key and enter a model ID.')
      return
    }
    if (!apiKey.trim()) {
      setError('Enter your provider API key')
      return
    }
    setBusy(true)
    setError('')
    const message = draft.trim()
    setDraft('')
    setMessages((current) => [...current, { role: 'user', content: message }])
    try {
      const result = await api('/basic-chat/messages', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, provider, api_key: apiKey, model, message }),
      })
      setSessionId(result.session.id)
      setMessages(result.messages)
      setSessions((current) => [result.session, ...current.filter((item) => item.id !== result.session.id)])
    } catch (requestError) {
      setMessages((current) => current.slice(0, -1))
      setDraft(message)
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="chat-app">
    <header className="chat-header">
      <button className="icon-button" onClick={onBack} title="Back to projects"><ArrowLeft size={20} /></button>
      <div><h1>Basic Chat</h1><p>{PROVIDERS[provider].label} · {looksLikeApiKey(model) ? 'Check model field' : model}</p></div>
      <button className="new-chat-button" onClick={newChat}><MessageSquarePlus size={17} /> New chat</button>
    </header>

    <div className="privacy-notice"><KeyRound size={16} /><span>Chats are kept for 24 hours after your last interaction. Your API key is used for this request only and is never saved.</span></div>

    <div className="chat-layout">
      <aside className="chat-sidebar">
        <div className="provider-settings">
          <label>Provider<div className="select-wrap"><select value={provider} onChange={changeProvider}>{Object.entries(PROVIDERS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}</select><ChevronDown size={16} /></div></label>
          <label>Model<input value={model} onChange={(event) => { setModel(event.target.value); if (sessionId) resetChat() }} placeholder="Provider model ID" /></label>
          <label>API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Not saved" autoComplete="off" /></label>
        </div>
        <div className="session-heading"><span>RECENT CHATS</span><small>10 exchanges each</small></div>
        <div className="session-list">
          {sessions.map((session) => <button key={session.id} className={session.id === sessionId ? 'active' : ''} onClick={() => openSession(session.id)}>
            <span>{session.title}</span><small>{PROVIDERS[session.provider]?.label || session.provider}</small>
            <span className="delete-session" onClick={(event) => { event.stopPropagation(); setDeleteTarget({ id: session.id, name: session.title }) }} title="Delete chat"><Trash2 size={14} /></span>
          </button>)}
          {sessionsLoading && <p>Loading chats...</p>}
          {!sessionsLoading && !sessions.length && <p>No recent chats</p>}
        </div>
      </aside>

      <div className="conversation">
        <div className="messages" aria-live="polite">
          {!messages.length && <div className="empty-chat"><div><Bot size={28} /></div><h2>What can I help you build?</h2><p>Choose a provider, enter your key and model, then start a conversation.</p></div>}
          {messages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
            <div className="message-avatar">{message.role === 'assistant' ? <Bot size={18} /> : <UserRound size={18} />}</div>
            <div><strong>{message.role === 'assistant' ? PROVIDERS[provider].label : 'You'}</strong>{message.role === 'assistant' ? <MarkdownContent>{message.content}</MarkdownContent> : <p>{message.content}</p>}</div>
          </article>)}
          {busy && <article className="chat-message assistant"><div className="message-avatar"><Bot size={18} /></div><div><strong>{PROVIDERS[provider].label}</strong><p className="thinking">Thinking<span>.</span><span>.</span><span>.</span></p></div></article>}
          <div ref={messageEnd} />
        </div>
        {error && <p className="chat-error" role="alert">{error}</p>}
        <form className="composer" onSubmit={sendMessage}>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit() }
          }} placeholder="Message your model" rows="1" maxLength="20000" />
          <button disabled={busy || !draft.trim()} title="Send message"><Send size={18} /></button>
        </form>
      </div>
    </div>
    {deleteTarget && <dialog ref={deleteDialog} className="delete-dialog" onCancel={() => setDeleteTarget(null)} aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description">
      <div className="delete-dialog-icon"><AlertTriangle size={22} /></div>
      <h2 id="delete-dialog-title">Delete chat?</h2>
      <p id="delete-dialog-description"><strong>{deleteTarget.name}</strong> and its messages will be permanently deleted and cannot be restored.</p>
      <div className="delete-dialog-actions">
        <button autoFocus onClick={() => setDeleteTarget(null)}>Cancel</button>
        <button className="danger-button" disabled={busy} onClick={() => removeSession(deleteTarget.id)}><Trash2 size={16} /> Delete</button>
      </div>
    </dialog>}
  </section>
}