import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Bot, CheckCircle2, ChevronDown, FileText, KeyRound, Layers3, MessageSquarePlus, Search, Send, Sparkles, Trash2, Upload, UserRound } from 'lucide-react'
import { api } from '../../lib/api'
import MarkdownContent from '../../components/MarkdownContent'
import './BasicRag.css'

const PROVIDERS = {
  openai: { label: 'OpenAI', model: 'gpt-4o' },
  gemini: { label: 'Google Gemini', model: 'gemini-flash-lite-latest' },
  mistral: { label: 'Mistral AI', model: 'mistral-large-latest' },
  groq: { label: 'GroqCloud', model: 'openai/gpt-oss-120b' },
  openrouter: { label: 'OpenRouter', model: 'openai/gpt-4o' },
}
const STRATEGIES = {
  fixed: 'Fixed', recursive: 'Recursive', 'content-aware': 'Content-aware', semantic: 'Semantic',
}
const looksLikeApiKey = (value) => /^(gsk_|sk-|sk_|AIza)/i.test(value.trim())
const PIPELINE_STEPS = ['Rephrasing the question', 'Generating search queries', 'Retrieving chunks for each query', 'Checking context quality', 'Building final LLM context', 'Generating grounded answer']
const documentForm = (file, strategy, chunkSize, overlap, embeddingKey, embeddingModel) => {
  const body = new FormData()
  body.append('file', file)
  body.append('strategy', strategy)
  body.append('chunk_size', chunkSize)
  body.append('overlap', overlap)
  body.append('embedding_api_key', embeddingKey)
  body.append('embedding_model', embeddingModel)
  return body
}

function PipelineTrace({ trace, expanded = false }) {
  if (!trace) return null
  return <details className="pipeline-trace" open={expanded}>
    <summary><Sparkles size={14} /> Advanced retrieval trace</summary>
    <section><h3>Query rewrite</h3><p><b>Original</b>{trace.original_query}</p><p><b>Rephrased</b>{trace.rewritten_query}</p></section>
    <section><h3>Generated queries</h3>{trace.generated_queries.map((query, index) => <p key={query}><b>{index + 1}</b>{query}</p>)}</section>
    <section><h3>Retrieval by query</h3>{trace.retrievals.map((run, index) => <details key={`${run.type}-${index}`}><summary><Search size={13} /> {run.type}: {run.query} <span>{run.chunks.length} chunks</span></summary>{run.chunks.length ? run.chunks.map((chunk) => <p key={`${chunk.document_id}-${chunk.position}`}><b>{chunk.filename} · chunk {chunk.position + 1} · {chunk.score.toFixed(4)}</b>{chunk.text}</p>) : <p>No chunks found</p>}</details>)}</section>
    <section className={`context-quality ${trace.context_quality.status}`}><h3><CheckCircle2 size={14} /> Context quality: {trace.context_quality.status}</h3><p>Best score {trace.context_quality.best_score.toFixed(4)} · threshold {trace.context_quality.threshold.toFixed(2)}</p><p>{trace.context_quality.reason}</p>{trace.fallback_query && <p><b>Fallback query</b>{trace.fallback_query}</p>}</section>
    <section><h3>Exact context sent to the LLM</h3><pre>{trace.final_context || 'No context was retrieved.'}</pre></section>
  </details>
}

export default function BasicRag({ onBack, endpoint = '/basic-rag', title = 'Basic RAG', advanced = false }) {
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [documents, setDocuments] = useState([])
  const [messages, setMessages] = useState([])
  const [provider, setProvider] = useState('gemini')
  const [model, setModel] = useState(PROVIDERS.gemini.model)
  const [apiKey, setApiKey] = useState('')
  const [embeddingKey, setEmbeddingKey] = useState('')
  const [embeddingModel, setEmbeddingModel] = useState('gemini-embedding-001')
  const [strategy, setStrategy] = useState('recursive')
  const [chunkSize, setChunkSize] = useState(800)
  const [overlap, setOverlap] = useState(120)
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [view, setView] = useState('chat')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [pipelineStep, setPipelineStep] = useState(0)
  const messageEnd = useRef(null)
  const deleteDialog = useRef(null)
  const openInitialSession = useEffectEvent((id) => openSession(id))

  useEffect(() => {
    api(`${endpoint}/sessions`).then(async (items) => {
      setSessions(items)
      if (items[0]) await openInitialSession(items[0].id)
    }).catch((requestError) => setError(requestError.message))
  }, [endpoint])

  useEffect(() => {
    if (!selectedFile || (strategy === 'semantic' && !embeddingKey.trim())) {
      return undefined
    }
    let active = true
    const timer = setTimeout(async () => {
      setBusy('preview')
      setError('')
      try {
        const body = documentForm(selectedFile, strategy, chunkSize, overlap, embeddingKey, embeddingModel)
        const result = await api(`${endpoint}/preview`, { method: 'POST', body })
        if (active) setPreview(result)
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setBusy('')
      }
    }, 450)
    return () => { active = false; clearTimeout(timer) }
  }, [selectedFile, strategy, chunkSize, overlap, embeddingKey, embeddingModel, endpoint])

  useEffect(() => {
    if (!advanced || busy !== 'message') return undefined
    const timer = setInterval(() => setPipelineStep((current) => Math.min(current + 1, PIPELINE_STEPS.length - 1)), 1300)
    return () => clearInterval(timer)
  }, [advanced, busy])

  useEffect(() => { messageEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])
  useEffect(() => {
    if (deleteTarget && !deleteDialog.current?.open) deleteDialog.current?.showModal()
  }, [deleteTarget])

  function resetWorkspace() {
    setSessionId(null)
    setDocuments([])
    setMessages([])
    setPreview(null)
    setSelectedFile(null)
    setError('')
  }

  async function createSession() {
    const created = await api(`${endpoint}/sessions`, {
      method: 'POST', body: JSON.stringify({ provider, model, embedding_model: embeddingModel }),
    })
    setSessionId(created.id)
    setSessions((current) => [created, ...current])
    setDocuments([])
    setMessages([])
    return created.id
  }

  async function newSession() {
    resetWorkspace()
    try { await createSession() } catch (requestError) { setError(requestError.message) }
  }

  async function openSession(id) {
    setBusy('session')
    setError('')
    try {
      const result = await api(`${endpoint}/sessions/${id}`)
      setSessionId(result.session.id)
      setProvider(result.session.provider)
      setModel(result.session.model)
      setEmbeddingModel(result.session.embedding_model)
      setDocuments(result.documents)
      setMessages(result.messages)
      setPreview(null)
      setSelectedFile(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally { setBusy('') }
  }

  async function removeSession() {
    if (!sessionId) return
    setBusy('delete-session')
    try {
      await api(`${endpoint}/sessions/${sessionId}`, { method: 'DELETE' })
      const remaining = sessions.filter((item) => item.id !== sessionId)
      setSessions(remaining)
      resetWorkspace()
      setDeleteTarget(null)
      if (remaining[0]) await openSession(remaining[0].id)
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  function changeProvider(event) {
    const next = event.target.value
    setProvider(next)
    setModel(PROVIDERS[next].model)
    setApiKey('')
    resetWorkspace()
  }

  async function uploadDocument() {
    if (!selectedFile || busy) return
    if (!embeddingKey.trim()) { setError('Enter your Google Gemini embedding API key'); return }
    setBusy('upload')
    setError('')
    try {
      const activeSession = sessionId || await createSession()
      const document = await api(`${endpoint}/sessions/${activeSession}/documents`, {
        method: 'POST', body: documentForm(selectedFile, strategy, chunkSize, overlap, embeddingKey, embeddingModel),
      })
      setDocuments((current) => [document, ...current])
      setPreview({ filename: document.filename, chunks: document.chunks.map((chunk) => chunk.content), overlap: document.overlap })
      setSelectedFile(null)
      setView('chunks')
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  async function removeDocument(documentId) {
    setBusy(documentId)
    try {
      await api(`${endpoint}/documents/${documentId}`, { method: 'DELETE' })
      setDocuments((current) => current.filter((item) => item.id !== documentId))
      setDeleteTarget(null)
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  async function sendMessage(event) {
    event.preventDefault()
    if (!draft.trim() || busy) return
    if (!sessionId || !documents.length) { setError('Upload at least one document first'); return }
    const llmApiKey = apiKey.trim()
    const geminiEmbeddingKey = embeddingKey.trim()
    if (!llmApiKey || !geminiEmbeddingKey) { setError('Enter both API keys'); return }
    if (llmApiKey.length > 500) { setError('LLM API key must be at most 500 characters'); return }
    if (geminiEmbeddingKey.length > 500) { setError('Gemini embedding key must be at most 500 characters'); return }
    if (looksLikeApiKey(model)) { setError('Move the API key out of the Model field'); return }
    const message = draft.trim()
    setDraft('')
    setMessages((current) => [...current, { role: 'user', content: message, sources: [] }])
    setPipelineStep(0)
    setBusy('message')
    setError('')
    try {
      const result = await api(`${endpoint}/messages`, {
        method: 'POST', body: JSON.stringify({
          session_id: sessionId, provider, api_key: llmApiKey, model,
          embedding_api_key: geminiEmbeddingKey, embedding_model: embeddingModel, message,
        }),
      })
      setMessages(result.messages)
      setDocuments(result.documents)
      setSessions((current) => [result.session, ...current.filter((item) => item.id !== result.session.id)])
      if (advanced) setView('trace')
    } catch (requestError) {
      setMessages((current) => current.slice(0, -1))
      setDraft(message)
      setError(requestError.message)
    } finally { setBusy('') }
  }

  const shownChunks = preview?.chunks || documents[0]?.chunks?.map((chunk) => chunk.content) || []
  const shownOverlap = preview?.overlap ?? documents[0]?.overlap ?? overlap
  const currentSession = sessions.find((item) => item.id === sessionId)
  const latestTrace = messages.findLast((message) => message.trace)?.trace

  return <section className="chat-app rag-app">
    <header className="chat-header rag-header">
      <button className="icon-button" onClick={onBack} title="Back to projects"><ArrowLeft size={20} /></button>
      <div><h1>{title}</h1><p>{documents.length} documents · {shownChunks.length} visible chunks</p></div>
      <div className="rag-session-actions">
        <div className="select-wrap"><select value={sessionId || ''} onChange={(event) => event.target.value && openSession(event.target.value)} aria-label="RAG session"><option value="">Unsaved session</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><ChevronDown size={16} /></div>
        <button className="icon-button" onClick={() => setDeleteTarget({ type: 'session', name: currentSession?.title || 'this session' })} disabled={!sessionId || busy} title="Delete session"><Trash2 size={17} /></button>
        <button className="new-chat-button" onClick={newSession}><MessageSquarePlus size={17} /> New session</button>
      </div>
    </header>

    <div className="privacy-notice"><KeyRound size={16} /><span>Originals use private storage. Provider and embedding keys are request-only and never saved.</span></div>

    <div className="chat-layout rag-layout">
      <aside className="chat-sidebar rag-sidebar">
        <div className="provider-settings">
          <label>LLM provider<div className="select-wrap"><select value={provider} onChange={changeProvider}>{Object.entries(PROVIDERS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select><ChevronDown size={16} /></div></label>
          <label>LLM model<input value={model} onChange={(event) => { setModel(event.target.value); if (sessionId) resetWorkspace() }} /></label>
          <label>LLM API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Not saved" autoComplete="off" maxLength="500" /></label>
          <label>Gemini embedding model<input value={embeddingModel} onChange={(event) => { setEmbeddingModel(event.target.value); if (sessionId) resetWorkspace() }} /></label>
          <label>Gemini embedding key<input type="password" value={embeddingKey} onChange={(event) => setEmbeddingKey(event.target.value)} placeholder="Not saved" autoComplete="off" maxLength="500" /></label>
        </div>

        <div className="chunk-controls">
          <label>Chunk strategy<div className="select-wrap"><select value={strategy} onChange={(event) => { setStrategy(event.target.value); setPreview(null) }}>{Object.entries(STRATEGIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={16} /></div></label>
          <label>Chunk size <output>{chunkSize}</output><input type="range" min="100" max="2000" step="50" value={chunkSize} onChange={(event) => { const value = Number(event.target.value); setChunkSize(value); setPreview(null); if (overlap >= value) setOverlap(Math.max(0, value - 50)) }} /></label>
          <label>Overlap <output>{overlap}</output><input type="range" min="0" max={Math.max(0, chunkSize - 50)} step="10" value={overlap} onChange={(event) => { setOverlap(Number(event.target.value)); setPreview(null) }} /></label>
        </div>

        <label className="rag-upload"><Upload size={17} /><span>{selectedFile?.name || 'Choose PDF, DOCX, or TXT'}</span><input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => { setSelectedFile(event.target.files?.[0] || null); setPreview(null) }} /></label>
        <button className="index-button" disabled={!selectedFile || !preview || busy} onClick={uploadDocument}>{busy === 'upload' ? 'Indexing...' : 'Add to knowledge base'}</button>

        <div className="session-heading"><span>DOCUMENTS</span><small>{documents.length}</small></div>
        <div className="document-list">{documents.map((item) => <button key={item.id} onClick={() => { setPreview({ filename: item.filename, chunks: item.chunks.map((chunk) => chunk.content), overlap: item.overlap }); setView('chunks') }}><FileText size={16} /><span><strong>{item.filename}</strong><small>{item.chunk_count} chunks · {STRATEGIES[item.strategy]}</small></span><span className="delete-document" title="Delete document" onClick={(event) => { event.stopPropagation(); setDeleteTarget({ type: 'document', id: item.id, name: item.filename }) }}><Trash2 size={14} /></span></button>)}{!documents.length && <p>No documents</p>}</div>
      </aside>

      <div className="rag-main">
        <div className="rag-tabs"><button className={view === 'chat' ? 'active' : ''} onClick={() => setView('chat')}><Bot size={16} /> Chat</button><button className={view === 'chunks' ? 'active' : ''} onClick={() => setView('chunks')}><Layers3 size={16} /> Chunks <span>{shownChunks.length}</span></button>{advanced && <button className={view === 'trace' ? 'active' : ''} onClick={() => setView('trace')}><Sparkles size={16} /> Trace</button>}{busy === 'preview' && <small>Updating preview...</small>}</div>
        {view === 'chunks' ? <div className="chunk-inspector">
          {!shownChunks.length && <div className="empty-chat"><div><Layers3 size={28} /></div><h2>No chunk preview</h2></div>}
          {shownChunks.map((chunk, index) => <article key={`${index}-${chunk.slice(0, 20)}`}><header><strong>Chunk {index + 1}</strong><span>{chunk.length} characters</span></header><p>{index > 0 && shownOverlap > 0 ? <><mark>{chunk.slice(0, shownOverlap)}</mark>{chunk.slice(shownOverlap)}</> : chunk}</p></article>)}
        </div> : view === 'trace' ? <div className="trace-inspector">
          {!latestTrace ? <div className="empty-chat"><div><Sparkles size={28} /></div><h2>No retrieval trace yet</h2><p>Ask a question to inspect every query and retrieved chunk.</p></div> : <PipelineTrace trace={latestTrace} expanded />}
        </div> : <div className="conversation">
          <div className="messages" aria-live="polite">
            {!messages.length && <div className="empty-chat"><div><Bot size={28} /></div><h2>Ask your documents</h2></div>}
            {messages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><div className="message-avatar">{message.role === 'assistant' ? <Bot size={18} /> : <UserRound size={18} />}</div><div><strong>{message.role === 'assistant' ? PROVIDERS[provider].label : 'You'}</strong>{message.role === 'assistant' ? <MarkdownContent>{message.content}</MarkdownContent> : <p>{message.content}</p>}{message.sources?.length > 0 && <details className="message-sources"><summary>{message.sources.length} sources</summary>{message.sources.map((source) => <p key={source.number}><b>[{source.number}] {source.filename}, chunk {source.position + 1}</b>{source.text}</p>)}</details>}<PipelineTrace trace={message.trace} /></div></article>)}
            {busy === 'message' && <article className="chat-message assistant"><div className="message-avatar"><Bot size={18} /></div><div><strong>{PROVIDERS[provider].label}</strong>{advanced ? <div className="pipeline-progress">{PIPELINE_STEPS.map((step, index) => <p className={index < pipelineStep ? 'done' : index === pipelineStep ? 'active' : ''} key={step}>{index < pipelineStep ? <CheckCircle2 size={14} /> : <span>{index + 1}</span>}{step}</p>)}</div> : <p className="thinking">Retrieving<span>.</span><span>.</span><span>.</span></p>}</div></article>}
            <div ref={messageEnd} />
          </div>
          {error && <p className="chat-error" role="alert">{error}</p>}
          <form className="composer" onSubmit={sendMessage}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit() } }} placeholder="Ask a grounded question" rows="1" maxLength="20000" /><button disabled={Boolean(busy) || !draft.trim()} title="Send question"><Send size={18} /></button></form>
        </div>}
        {view === 'chunks' && error && <p className="chat-error" role="alert">{error}</p>}
      </div>
    </div>
    {deleteTarget && <dialog ref={deleteDialog} className="delete-dialog" onCancel={() => setDeleteTarget(null)} aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description">
      <div className="delete-dialog-icon"><AlertTriangle size={22} /></div>
      <h2 id="delete-dialog-title">Delete {deleteTarget.type}?</h2>
      <p id="delete-dialog-description"><strong>{deleteTarget.name}</strong> will be permanently deleted. {deleteTarget.type === 'session' ? 'Its documents, vectors, and chat history' : 'Its original file and vectors'} cannot be restored.</p>
      <div className="delete-dialog-actions">
        <button autoFocus onClick={() => setDeleteTarget(null)}>Cancel</button>
        <button className="danger-button" disabled={Boolean(busy)} onClick={() => deleteTarget.type === 'session' ? removeSession() : removeDocument(deleteTarget.id)}><Trash2 size={16} /> {busy ? 'Deleting...' : 'Delete'}</button>
      </div>
    </dialog>}
  </section>
}
