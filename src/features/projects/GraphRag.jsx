import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowLeft, Boxes, ChevronDown, Database, FileText,
  KeyRound, Layers, Network, Play, Plus, Search, Send, Share2, Sparkles,
  Terminal, Trash2, Upload, Waypoints,
} from 'lucide-react'
import { api, streamNdjson } from '../../lib/api'
import MarkdownContent from '../../components/MarkdownContent'
import './GraphRag.css'

const PROVIDERS = {
  openai: { label: 'OpenAI', model: 'gpt-4o-mini' },
  gemini: { label: 'Google Gemini', model: 'gemini-flash-lite-latest' },
  mistral: { label: 'Mistral AI', model: 'mistral-large-latest' },
  groq: { label: 'GroqCloud', model: 'openai/gpt-oss-120b' },
  openrouter: { label: 'OpenRouter', model: 'openai/gpt-4o-mini' },
}

const TYPE_COLORS = ['#2e4cf5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6']
const colorForType = (type) => {
  let hash = 0
  for (const character of type || 'Concept') hash = (hash * 31 + character.charCodeAt(0)) % 997
  return TYPE_COLORS[hash % TYPE_COLORS.length]
}

const STEP_ICONS = {
  start: FileText, schema: Database, chunked: Layers, 'chunk-start': FileText,
  extracted: Sparkles, embedded: Waypoints, 'graph-write': Network, 'graph-complete': Boxes,
  'embed-question': Waypoints, 'chunk-search': Search, 'entity-search': Search,
  traversal: Share2, context: Layers, answer: Sparkles, error: AlertTriangle,
}

/** Force-directed layout: repulsion between nodes, springs along edges, pull to centre. */
function useForceLayout(nodes, edges, width, height) {
  const [positions, setPositions] = useState({})
  const frame = useRef(0)
  const state = useRef(new Map())
  const alpha = useRef(1)

  const nodeSignature = nodes.map((node) => node.key).join('|')
  const edgeSignature = edges.map((edge) => `${edge.source}>${edge.target}:${edge.type}`).join('|')

  useEffect(() => {
    if (!nodes.length) {
      setPositions({})
      return undefined
    }
    const points = state.current
    const keys = new Set(nodes.map((node) => node.key))
    for (const key of points.keys()) if (!keys.has(key)) points.delete(key)
    let hasNewNode = false
    nodes.forEach((node, index) => {
      if (!points.has(node.key)) {
        hasNewNode = true
        const angle = (index / nodes.length) * Math.PI * 2
        points.set(node.key, {
          x: width / 2 + Math.cos(angle) * 140 + Math.random() * 20,
          y: height / 2 + Math.sin(angle) * 140 + Math.random() * 20,
          vx: 0, vy: 0,
        })
      }
    })

    // Reheat instead of resetting: keeps already-settled nodes stable while
    // giving the simulation enough energy to fold in newly arrived ones.
    alpha.current = Math.max(alpha.current, hasNewNode ? 0.9 : 0.4)
    const decay = 1 - Math.pow(0.01, 1 / 300)
    let safety = 0

    const step = () => {
      const list = [...points.entries()]
      const heat = alpha.current
      for (const [, point] of list) { point.fx = 0; point.fy = 0 }

      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const a = list[i][1]
          const b = list[j][1]
          let dx = a.x - b.x
          let dy = a.y - b.y
          let distance = Math.hypot(dx, dy) || 0.01
          if (distance < 1) { dx = Math.random(); dy = Math.random(); distance = 1 }
          const force = (5200 / (distance * distance)) * heat
          a.fx += (dx / distance) * force
          a.fy += (dy / distance) * force
          b.fx -= (dx / distance) * force
          b.fy -= (dy / distance) * force
        }
      }

      for (const edge of edges) {
        const a = points.get(edge.source)
        const b = points.get(edge.target)
        if (!a || !b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const distance = Math.hypot(dx, dy) || 0.01
        const force = (distance - 130) * 0.015 * heat
        a.fx += (dx / distance) * force
        a.fy += (dy / distance) * force
        b.fx -= (dx / distance) * force
        b.fy -= (dy / distance) * force
      }

      for (const [, point] of list) {
        point.fx += (width / 2 - point.x) * 0.008
        point.fy += (height / 2 - point.y) * 0.008
        point.vx = (point.vx + point.fx) * 0.82
        point.vy = (point.vy + point.fy) * 0.82
        point.x = Math.max(36, Math.min(width - 36, point.x + point.vx))
        point.y = Math.max(28, Math.min(height - 28, point.y + point.vy))
      }

      setPositions(Object.fromEntries(list.map(([key, point]) => [key, { x: point.x, y: point.y }])))

      alpha.current *= 1 - decay
      safety += 1
      if (alpha.current > 0.01 && safety < 1500) frame.current = requestAnimationFrame(step)
    }

    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
    // Signatures (not raw arrays) so identical data from a new render doesn't
    // restart and reheat the simulation for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeSignature, edgeSignature, width, height])

  return positions
}

function GraphCanvas({ nodes, edges, emptyLabel }) {
  const width = 720
  const height = 460
  const positions = useForceLayout(nodes, edges, width, height)
  const [active, setActive] = useState(null)

  if (!nodes.length) {
    return <div className="gr-graph-empty"><Network size={30} /><p>{emptyLabel}</p></div>
  }

  const byKey = Object.fromEntries(nodes.map((node) => [node.key, node]))
  const activeNode = active ? byKey[active] : null

  return (
    <div className="gr-graph-wrap">
      <svg className="gr-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Knowledge graph">
        <defs>
          <marker id="gr-arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#b9c4e6" />
          </marker>
        </defs>
        {edges.map((edge, index) => {
          const a = positions[edge.source]
          const b = positions[edge.target]
          if (!a || !b) return null
          const dim = active && edge.source !== active && edge.target !== active
          const midX = (a.x + b.x) / 2
          const midY = (a.y + b.y) / 2
          const labelWidth = edge.type.length * 5.4 + 10
          return (
            <g key={`${edge.source}-${edge.target}-${edge.type}-${index}`} opacity={dim ? 0.15 : 1}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={active && (edge.source === active || edge.target === active) ? '#2e4cf5' : '#b9c4e6'}
                strokeWidth={active && (edge.source === active || edge.target === active) ? 2 : 1.4}
                markerEnd="url(#gr-arrow)"
              />
              <rect x={midX - labelWidth / 2} y={midY - 13} width={labelWidth} height={13} rx={4} className="gr-edge-label-bg" />
              <text x={midX} y={midY - 4} className="gr-edge-label">{edge.type}</text>
            </g>
          )
        })}
        {nodes.map((node) => {
          const point = positions[node.key]
          if (!point) return null
          const radius = node.seed ? 13 : 10
          return (
            <g
              key={node.key}
              className="gr-node"
              opacity={active && active !== node.key ? 0.35 : 1}
              onMouseEnter={() => setActive(node.key)}
              onMouseLeave={() => setActive(null)}
            >
              <circle
                cx={point.x} cy={point.y} r={radius}
                fill={colorForType(node.type)} stroke="#fff" strokeWidth="2"
                className="gr-node-circle"
              />
              <text x={point.x} y={point.y - radius - 6} className="gr-node-label">{node.name}</text>
            </g>
          )
        })}
      </svg>
      {activeNode && (
        <div className="gr-node-card">
          <strong>{activeNode.name}</strong>
          <span style={{ background: colorForType(activeNode.type) }}>{activeNode.type}</span>
          {activeNode.description && <p>{activeNode.description}</p>}
        </div>
      )}
    </div>
  )
}

function CypherBlock({ cypher }) {
  const items = Array.isArray(cypher) ? cypher : [cypher]
  return items.filter(Boolean).map((item, index) => (
    <pre className="gr-cypher" key={index}><code>{item.trim()}</code></pre>
  ))
}

function RowTable({ rows }) {
  if (!rows?.length) return <p className="gr-empty-rows">No rows returned.</p>
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  return (
    <div className="gr-table-wrap">
      <table className="gr-table">
        <thead><tr>{headers.map((header) => <th key={header}>{header.replace(/_/g, ' ')}</th>)}</tr></thead>
        <tbody>
          {rows.slice(0, 40).map((row, index) => (
            <tr key={index}>
              {headers.map((header) => {
                const value = row[header]
                const text = typeof value === 'number' ? Number(value.toFixed(4)) : Array.isArray(value) ? value.join(' → ') : String(value ?? '')
                return <td key={header} title={text}>{text.length > 140 ? `${text.slice(0, 140)}…` : text}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EventFeed({ events }) {
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [events])
  if (!events.length) {
    return <div className="gr-feed-empty"><Activity size={26} /><p>Upload a document to watch the graph build itself.</p></div>
  }
  return (
    <div className="gr-feed">
      {events.map((event, index) => {
        const Icon = STEP_ICONS[event.step] || Activity
        return (
          <article className={`gr-event ${event.step === 'error' ? 'error' : ''}`} key={index}>
            <div className="gr-event-icon"><Icon size={14} /></div>
            <div className="gr-event-body">
              <header><strong>{event.step.replace(/-/g, ' ')}</strong><span>{event.message || event.detail}</span></header>
              {event.text && <p className="gr-chunk-text">{event.text}</p>}
              {Boolean(event.entities?.length) && (
                <div className="gr-pills">
                  {event.entities.map((entity) => (
                    <span key={entity.name} style={{ '--pill': colorForType(entity.type) }} title={entity.description}>
                      {entity.name}<small>{entity.type}</small>
                    </span>
                  ))}
                </div>
              )}
              {Boolean(event.relationships?.length) && (
                <ul className="gr-triples">
                  {event.relationships.map((relationship, position) => (
                    <li key={position}><b>{relationship.source}</b> <em>{relationship.type}</em> <b>{relationship.target}</b></li>
                  ))}
                </ul>
              )}
              {event.cypher && <CypherBlock cypher={event.cypher} />}
              {Boolean(event.rows?.length) && <RowTable rows={event.rows} />}
              {event.stats && (
                <div className="gr-stat-row">
                  <span><b>{event.stats.entity_count}</b> entities</span>
                  <span><b>{event.stats.relationship_count}</b> relationships</span>
                  <span><b>{event.stats.chunk_count}</b> chunks</span>
                </div>
              )}
            </div>
          </article>
        )
      })}
      <div ref={end} />
    </div>
  )
}

export default function GraphRag({ onBack }) {
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [showSessions, setShowSessions] = useState(false)
  const [documents, setDocuments] = useState([])
  const [messages, setMessages] = useState([])

  const [provider, setProvider] = useState('gemini')
  const [model, setModel] = useState(PROVIDERS.gemini.model)
  const [apiKey, setApiKey] = useState('')
  const [embeddingKey, setEmbeddingKey] = useState('')
  const [embeddingModel] = useState('gemini-embedding-001')

  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [buildEvents, setBuildEvents] = useState([])
  const [queryEvents, setQueryEvents] = useState([])
  const [graph, setGraph] = useState({ nodes: [], edges: [] })
  const [stats, setStats] = useState({ entity_count: 0, relationship_count: 0, chunk_count: 0 })
  const [highlight, setHighlight] = useState(null)

  const [templates, setTemplates] = useState([])
  const [templateResult, setTemplateResult] = useState(null)
  const [draft, setDraft] = useState('')
  const [hops, setHops] = useState(2)
  const [tab, setTab] = useState('build')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const sessionPanel = useRef(null)

  useEffect(() => {
    api('/graph-rag/sessions').then(setSessions).catch((requestError) => setError(requestError.message))
    api('/graph-rag/queries').then(setTemplates).catch(() => setTemplates([]))
  }, [])

  useEffect(() => {
    function onClick(event) {
      if (sessionPanel.current && !sessionPanel.current.contains(event.target)) setShowSessions(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const loadGraph = useCallback(async (id) => {
    try {
      const result = await api(`/graph-rag/sessions/${id}/graph`)
      setGraph({ nodes: result.nodes || [], edges: result.edges || [] })
      setStats(result.stats)
    } catch (requestError) { setError(requestError.message) }
  }, [])

  const openSession = useCallback(async (id) => {
    setBusy('session')
    setError('')
    try {
      const result = await api(`/graph-rag/sessions/${id}`)
      setSessionId(result.session.id)
      setProvider(result.session.provider)
      setModel(result.session.model)
      setDocuments(result.documents)
      setMessages(result.messages)
      setBuildEvents([])
      setQueryEvents([])
      setHighlight(null)
      await loadGraph(id)
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }, [loadGraph])

  async function createSession() {
    const created = await api('/graph-rag/sessions', {
      method: 'POST',
      body: JSON.stringify({ provider, model, embedding_model: embeddingModel }),
    })
    setSessions((current) => [created, ...current])
    setSessionId(created.id)
    setDocuments([])
    setMessages([])
    setGraph({ nodes: [], edges: [] })
    setStats({ entity_count: 0, relationship_count: 0, chunk_count: 0 })
    return created.id
  }

  async function newSession() {
    setError('')
    try { await createSession() } catch (requestError) { setError(requestError.message) }
  }

  async function removeSession(id, event) {
    event.stopPropagation()
    try {
      await api(`/graph-rag/sessions/${id}`, { method: 'DELETE' })
      const remaining = sessions.filter((item) => item.id !== id)
      setSessions(remaining)
      if (sessionId === id) {
        setSessionId(null)
        setDocuments([])
        setMessages([])
        setGraph({ nodes: [], edges: [] })
        setBuildEvents([])
      }
    } catch (requestError) { setError(requestError.message) }
  }

  async function removeDocument(documentId) {
    setBusy(documentId)
    try {
      await api(`/graph-rag/documents/${documentId}`, { method: 'DELETE' })
      setDocuments((current) => current.filter((item) => item.id !== documentId))
      if (sessionId) await loadGraph(sessionId)
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  async function buildGraph() {
    if (!file || busy) return
    if (!apiKey.trim()) { setError('Enter the LLM provider API key used to extract entities'); return }
    if (!embeddingKey.trim()) { setError('Enter your Google Gemini embedding API key'); return }
    setBusy('build')
    setError('')
    setBuildEvents([])
    setTab('build')
    try {
      const activeSession = sessionId || await createSession()
      const body = new FormData()
      body.append('file', file)
      body.append('provider', provider)
      body.append('api_key', apiKey)
      body.append('model', model)
      body.append('embedding_api_key', embeddingKey)
      body.append('embedding_model', embeddingModel)
      await streamNdjson(`/graph-rag/sessions/${activeSession}/documents`, { body }, (event) => {
        setBuildEvents((current) => [...current, event])
        if (event.nodes) setGraph({ nodes: event.nodes, edges: event.edges || [] })
        if (event.stats) setStats(event.stats)
        if (event.step === 'error') setError(event.detail)
        if (event.document) setDocuments((current) => [event.document, ...current])
      })
      setFile(null)
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  async function ask(event) {
    event.preventDefault()
    if (!draft.trim() || busy) return
    if (!apiKey.trim() || !embeddingKey.trim()) { setError('Enter both API keys before asking a question'); return }
    const question = draft.trim()
    setBusy('ask')
    setError('')
    setQueryEvents([])
    setDraft('')
    setTab('ask')
    try {
      await streamNdjson('/graph-rag/messages', {
        body: JSON.stringify({
          session_id: sessionId, provider, api_key: apiKey, model,
          embedding_api_key: embeddingKey, embedding_model: embeddingModel,
          message: question, top_k: 5, hops,
        }),
      }, (event) => {
        setQueryEvents((current) => [...current, event])
        if (event.step === 'traversal') setHighlight({ nodes: event.nodes || [], edges: event.edges || [] })
        if (event.step === 'error') setError(event.detail)
        if (event.step === 'answer') {
          setMessages((current) => [
            ...current,
            { role: 'user', content: question, sources: [] },
            { role: 'assistant', content: event.answer, sources: event.citations },
          ])
        }
      })
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  async function runTemplate(templateId) {
    if (!sessionId) { setError('Open or create a session first'); return }
    setBusy(templateId)
    setError('')
    try {
      setTemplateResult(await api(`/graph-rag/sessions/${sessionId}/queries/${templateId}`, { method: 'POST' }))
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  const visibleGraph = useMemo(
    () => (tab === 'ask' && highlight ? highlight : graph),
    [tab, highlight, graph],
  )
  const legend = useMemo(
    () => [...new Set(visibleGraph.nodes.map((node) => node.type))].slice(0, 8),
    [visibleGraph],
  )

  return (
    <div className="graph-rag">
      <header className="gr-header">
        <button className="gr-back" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <div className="gr-title">
          <div className="gr-title-icon"><Network size={20} color="#fff" /></div>
          <div>
            <h1>Graph RAG</h1>
            <p>Watch a Neo4j knowledge graph build and answer questions in real time</p>
          </div>
        </div>
        <div className="gr-rel" ref={sessionPanel}>
          <button className={`gr-session-btn ${showSessions ? 'active' : ''}`} onClick={() => setShowSessions(!showSessions)}>
            <Layers size={15} />
            {sessionId ? sessions.find((item) => item.id === sessionId)?.title || 'Session' : 'Sessions'}
            <ChevronDown size={13} />
          </button>
          {showSessions && (
            <div className="gr-session-panel">
              {sessions.length === 0 && <p className="gr-session-empty">No sessions yet.</p>}
              {sessions.map((item) => (
                <div
                  key={item.id}
                  className={`gr-session-item ${sessionId === item.id ? 'active' : ''}`}
                  onClick={() => { openSession(item.id); setShowSessions(false) }}
                >
                  <FileText size={15} />
                  <div><strong>{item.title}</strong><span>{new Date(item.created_at * 1000).toLocaleString()}</span></div>
                  <button onClick={(event) => removeSession(item.id, event)} title="Delete session"><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="gr-session-new" onClick={newSession}><Plus size={14} /> New session</button>
            </div>
          )}
        </div>
      </header>

      {busy && <div className="gr-progress" />}
      {error && <div className="gr-error"><AlertTriangle size={15} /> {error}</div>}

      <div className="gr-body">
        <aside className="gr-sidebar">
          <section className="gr-card">
            <h2><KeyRound size={14} /> Model access</h2>
            <label>Provider
              <select value={provider} onChange={(event) => { setProvider(event.target.value); setModel(PROVIDERS[event.target.value].model) }}>
                {Object.entries(PROVIDERS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
              </select>
            </label>
            <label>Model<input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Model ID" /></label>
            <label>Provider API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Used for extraction and answers" /></label>
            <label>Gemini embedding key<input type="password" value={embeddingKey} onChange={(event) => setEmbeddingKey(event.target.value)} placeholder="Google API key" /></label>
            <p className="gr-note">Keys are sent with the current request only and are never stored.</p>
          </section>

          <section className="gr-card">
            <h2><Upload size={14} /> Document</h2>
            {!file ? (
              <div
                className={`gr-drop ${dragOver ? 'over' : ''}`}
                onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => { event.preventDefault(); setDragOver(false); setFile(event.dataTransfer.files[0]) }}
              >
                <input type="file" accept=".pdf,.docx,.txt" onChange={(event) => setFile(event.target.files?.[0])} />
                <Upload size={18} />
                <strong>Drop a document</strong>
                <span>PDF, DOCX or TXT · up to 3 MB</span>
              </div>
            ) : (
              <div className="gr-file">
                <FileText size={16} />
                <div><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(0)} KB</span></div>
                <button onClick={() => setFile(null)}><Trash2 size={14} /></button>
              </div>
            )}
            <button className="gr-primary" disabled={!file || Boolean(busy)} onClick={buildGraph}>
              <Play size={15} /> {busy === 'build' ? 'Building graph…' : 'Build knowledge graph'}
            </button>
          </section>

          {Boolean(documents.length) && (
            <section className="gr-card">
              <h2><Boxes size={14} /> Indexed documents</h2>
              {documents.map((document) => (
                <div className="gr-doc" key={document.id}>
                  <FileText size={14} />
                  <div><strong>{document.filename}</strong><span>{document.chunk_count} chunks</span></div>
                  <button disabled={busy === document.id} onClick={() => removeDocument(document.id)}><Trash2 size={13} /></button>
                </div>
              ))}
            </section>
          )}

          <section className="gr-card gr-stats">
            <h2><Database size={14} /> Graph in Neo4j</h2>
            <div><strong>{stats.entity_count}</strong><span>Entities</span></div>
            <div><strong>{stats.relationship_count}</strong><span>Relationships</span></div>
            <div><strong>{stats.chunk_count}</strong><span>Chunks</span></div>
          </section>
        </aside>

        <main className="gr-main">
          <nav className="gr-tabs">
            {[
              ['build', 'Live build', Activity],
              ['graph', 'Graph', Network],
              ['ask', 'Ask', Send],
              ['cypher', 'Cypher', Terminal],
            ].map(([key, label, Icon]) => (
              <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </nav>

          {tab === 'build' && <EventFeed events={buildEvents} />}

          {tab === 'graph' && (
            <div className="gr-graph-panel">
              <div className="gr-legend">
                {legend.map((type) => <span key={type}><i style={{ background: colorForType(type) }} />{type}</span>)}
              </div>
              <GraphCanvas nodes={graph.nodes} edges={graph.edges} emptyLabel="No graph yet. Build one from a document." />
            </div>
          )}

          {tab === 'ask' && (
            <div className="gr-ask">
              <div className="gr-ask-graph">
                <GraphCanvas
                  nodes={visibleGraph.nodes}
                  edges={visibleGraph.edges}
                  emptyLabel="Ask a question to see the traversed subgraph."
                />
              </div>
              <div className="gr-conversation">
                {messages.map((message, index) => (
                  <article className={`gr-message ${message.role}`} key={index}>
                    <span className="gr-message-role">{message.role === 'assistant' ? 'Graph RAG' : 'You'}</span>
                    {message.role === 'assistant'
                      ? <MarkdownContent>{message.content}</MarkdownContent>
                      : <p className="gr-message-plain">{message.content}</p>}
                    {Boolean(message.sources?.length) && (
                      <details className="gr-sources">
                        <summary>{message.sources.length} cited chunks</summary>
                        {message.sources.map((source) => (
                          <p key={source.number}><b>[{source.number}] {source.filename} · chunk {source.position + 1} · {source.score?.toFixed(3)}</b>{source.text}</p>
                        ))}
                      </details>
                    )}
                  </article>
                ))}
                {Boolean(queryEvents.length) && (
                  <details className="gr-trace" open>
                    <summary><Sparkles size={13} /> Retrieval trace</summary>
                    <EventFeed events={queryEvents} />
                  </details>
                )}
              </div>
              <form className="gr-composer" onSubmit={ask}>
                <label className="gr-hops">Hops
                  <select value={hops} onChange={(event) => setHops(Number(event.target.value))}>
                    <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                  </select>
                </label>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={documents.length ? 'Ask how the entities connect…' : 'Build a graph first'}
                  disabled={!documents.length || Boolean(busy)}
                />
                <button type="submit" disabled={!draft.trim() || Boolean(busy)}><Send size={15} /></button>
              </form>
            </div>
          )}

          {tab === 'cypher' && (
            <div className="gr-cypher-panel">
              <p className="gr-note">Read-only queries scoped to this session. Every query runs on Neo4j exactly as shown.</p>
              <div className="gr-template-grid">
                {templates.map((template) => (
                  <article className="gr-template" key={template.id}>
                    <h3>{template.label}</h3>
                    <p>{template.description}</p>
                    <CypherBlock cypher={template.cypher} />
                    <button disabled={Boolean(busy)} onClick={() => runTemplate(template.id)}>
                      <Play size={13} /> Run query
                    </button>
                  </article>
                ))}
              </div>
              {templateResult && (
                <section className="gr-result">
                  <h3><Terminal size={14} /> Result</h3>
                  <CypherBlock cypher={templateResult.cypher} />
                  <RowTable rows={templateResult.rows} />
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
