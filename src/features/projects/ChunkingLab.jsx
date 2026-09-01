import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, Bot, Check, ChevronDown, ChevronUp,
  Columns2, FileText, Image as ImageIcon, Info, KeyRound, Layers3, Plus,
  Scissors, Settings2, Sparkles, Table2, Trash2, Type, Upload, X, Zap
} from 'lucide-react'
import { chunkingApi } from '../../lib/chunkingApi'
import './ChunkingLab.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDERS = {
  gemini: { label: 'Google Gemini', defaultModel: 'gemini-2.0-flash' },
  openai: { label: 'OpenAI', defaultModel: 'gpt-4o-mini' },
  groq: { label: 'GroqCloud', defaultModel: 'llama-3.3-70b-versatile' },
  mistral: { label: 'Mistral AI', defaultModel: 'mistral-large-latest' },
}

const EMBEDDING_MODELS = [
  'gemini-embedding-001',
  'text-embedding-004',
]

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const CHUNK_TYPE_META = {
  table: { label: 'Table', icon: Table2, className: 'table' },
  image: { label: 'Image', icon: ImageIcon, className: 'image' },
  text: { label: 'Text', icon: Type, className: 'text' },
}

function ChunkCard({ chunk, index }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = chunk.content && chunk.content.length > 320
  const type = chunk.type || 'text'
  const typeMeta = CHUNK_TYPE_META[type] || CHUNK_TYPE_META.text
  const TypeIcon = typeMeta.icon

  return (
    <article className={`chunk-result-card chunk-type-${typeMeta.className}`} key={chunk.index ?? index}>
      <header className="chunk-card-header">
        <div className="chunk-card-title">
          <strong>Chunk {(chunk.index ?? index) + 1}</strong>
          <span className={`chunk-type-badge ${typeMeta.className}`}>
            <TypeIcon size={11} /> {typeMeta.label}
            {chunk.table_parts > 1 && ` · part ${chunk.table_part}/${chunk.table_parts}`}
          </span>
        </div>
        <div className="chunk-card-meta">
          <span><strong>{chunk.char_count?.toLocaleString() || chunk.content?.length || 0}</strong> chars</span>
          <span><strong>{chunk.word_count?.toLocaleString() || 0}</strong> words</span>
          {chunk.sentence_count != null && <span><strong>{chunk.sentence_count}</strong> sentences</span>}
          {chunk.paragraph_count != null && type === 'text' && <span><strong>{chunk.paragraph_count}</strong> paragraphs</span>}
          {chunk.row_count != null && <span><strong>{chunk.row_count}</strong> rows</span>}
          {chunk.approx_tokens != null && <span>~<strong>{chunk.approx_tokens}</strong> tokens</span>}
        </div>
      </header>
      {chunk.note && (
        <p className="chunk-card-note">
          <Info size={12} /> {chunk.note}
        </p>
      )}
      {type === 'image' ? (
        <div className="chunk-card-image-placeholder">
          <ImageIcon size={22} />
          <span>{chunk.image_name || 'Image'}</span>
        </div>
      ) : (
        <div className={`chunk-card-body ${type === 'table' ? 'is-table' : ''} ${expanded ? 'expanded' : ''}`}>
          {chunk.content}
        </div>
      )}
      {isLong && type !== 'image' && (
        <button
          type="button"
          className="chunk-card-toggle"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Show less' : 'Show full chunk'}
        </button>
      )}
    </article>
  )
}

function StatsBar({ stats, chunks }) {
  if (!stats) return null
  const typeCounts = (chunks || []).reduce((acc, c) => {
    const type = c.type || 'text'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})
  const showBreakdown = Object.keys(typeCounts).length > 1

  return (
    <>
      <div className="chunking-stats-row">
        <div className="chunking-stat-card">
          <span className="chunking-stat-num">{stats.count?.toLocaleString() || 0}</span>
          <span className="chunking-stat-label">Total Chunks</span>
        </div>
        <div className="chunking-stat-card">
          <span className="chunking-stat-num">{stats.avg_chars?.toLocaleString() || 0}</span>
          <span className="chunking-stat-label">Avg Characters</span>
        </div>
        <div className="chunking-stat-card">
          <span className="chunking-stat-num">{stats.min_chars?.toLocaleString() || 0}</span>
          <span className="chunking-stat-label">Min Characters</span>
        </div>
        <div className="chunking-stat-card">
          <span className="chunking-stat-num">{stats.max_chars?.toLocaleString() || 0}</span>
          <span className="chunking-stat-label">Max Characters</span>
        </div>
        <div className="chunking-stat-card">
          <span className="chunking-stat-num">{stats.total_chars?.toLocaleString() || 0}</span>
          <span className="chunking-stat-label">Total Characters</span>
        </div>
      </div>
      {showBreakdown && (
        <div className="chunking-type-breakdown">
          <Info size={12} />
          <span>
            This document mixes content types, so structure-aware chunking kept them separate:{' '}
            {Object.entries(typeCounts).map(([type, count], i) => {
              const meta = CHUNK_TYPE_META[type] || CHUNK_TYPE_META.text
              return (
                <span key={type}>
                  {i > 0 && ', '}
                  <strong>{count}</strong> {meta.label.toLowerCase()}{count === 1 ? '' : 's'}
                </span>
              )
            })}.
          </span>
        </div>
      )}
    </>
  )
}

function StrategyItem({ id, meta, selected, onToggle }) {
  return (
    <div
      id={`strategy-${id}`}
      className={`chunking-strategy-item ${selected ? 'selected' : ''}`}
      onClick={() => onToggle(id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onToggle(id)}
    >
      <div className="chunking-checkbox">
        {selected && <Check size={11} strokeWidth={3.5} color="white" />}
      </div>
      <span className="chunking-strategy-label">{meta.label || id}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {meta.requires_embedding && <span className="chunking-strategy-tag embed">Embed</span>}
        {meta.requires_llm && <span className="chunking-strategy-tag llm">LLM</span>}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChunkingLab({ onBack }) {
  // File state
  const [file, setFile] = useState(null)
  const [fileType, setFileType] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // Strategy selection
  const [selectedStrategies, setSelectedStrategies] = useState(['fixed', 'recursive', 'sentence'])
  const [strategies, setStrategies] = useState([])

  // Chunking params
  const [chunkSize, setChunkSize] = useState(800)
  const [overlap, setOverlap] = useState(120)

  // API keys
  const [embeddingKey, setEmbeddingKey] = useState('')
  const [embeddingModel, setEmbeddingModel] = useState('gemini-embedding-001')
  const [llmProvider, setLlmProvider] = useState('gemini')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmModel, setLlmModel] = useState('')

  // Results
  const [results, setResults] = useState(null)
  const [errors, setErrors] = useState({})
  const [fileInfo, setFileInfo] = useState(null)
  const [activeTab, setActiveTab] = useState(null)
  const [compareMode, setCompareMode] = useState(false)

  // Sessions
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)

  // UI state
  const [busy, setBusy] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const fileInputRef = useRef(null)
  const deleteDialog = useRef(null)

  // ─── Load strategies metadata ─────────────────────────────────────────────
  useEffect(() => {
    chunkingApi('/chunking/strategies')
      .then((data) => {
        if (Array.isArray(data)) setStrategies(data)
      })
      .catch(() => setStrategies([]))
  }, [])

  // ─── Load sessions ────────────────────────────────────────────────────────
  useEffect(() => {
    chunkingApi('/chunking/sessions')
      .then((items) => {
        if (Array.isArray(items)) {
          setSessions(items)
          if (items[0]) setSessionId(items[0].id)
        }
      })
      .catch(() => setSessions([]))
  }, [])

  useEffect(() => {
    if (deleteTarget && !deleteDialog.current?.open) {
      deleteDialog.current?.showModal()
    }
  }, [deleteTarget])

  // ─── Derived state ────────────────────────────────────────────────────────
  const strategyMeta = Object.fromEntries(strategies.map((s) => [s.id, s]))
  const needsEmbedding = selectedStrategies.some((id) => strategyMeta[id]?.requires_embedding)
  const needsLlm = selectedStrategies.some((id) => strategyMeta[id]?.requires_llm)
  const canAnalyze = Boolean(file && selectedStrategies.length > 0 && !busy)

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleFile = useCallback((f) => {
    if (!f) return
    setFile(f)
    setResults(null)
    setErrors({})
    setFileInfo(null)
    setActiveTab(null)
    setGlobalError('')
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer?.files?.[0]
    if (dropped) handleFile(dropped)
  }, [handleFile])

  const toggleStrategy = useCallback((id) => {
    setSelectedStrategies((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }, [])

  const toggleAllStrategies = useCallback(() => {
    const allIds = strategies.map((s) => s.id)
    setSelectedStrategies((prev) =>
      prev.length === allIds.length ? ['fixed', 'recursive'] : allIds
    )
  }, [strategies])

  const createSession = useCallback(async () => {
    try {
      const s = await chunkingApi('/chunking/sessions', { method: 'POST' })
      if (s?.id) {
        setSessions((prev) => [s, ...prev.filter((item) => item.id !== s.id)])
        setSessionId(s.id)
        return s.id
      }
      return null
    } catch (err) {
      setGlobalError(err.message)
      return null
    }
  }, [])

  const deleteSession = useCallback(async (id) => {
    if (!id) return
    try {
      await chunkingApi(`/chunking/sessions/${id}`, { method: 'DELETE' })
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (sessionId === id) setSessionId(null)
      setDeleteTarget(null)
    } catch (err) {
      setGlobalError(err.message)
    }
  }, [sessionId])

  const analyze = useCallback(async () => {
    if (!canAnalyze) return
    setBusy(true)
    setGlobalError('')
    setResults(null)
    setErrors({})

    try {
      const activeSessionId = sessionId || await createSession()
      if (!activeSessionId) return
      const body = new FormData()
      body.append('file', file)
      body.append('strategies', selectedStrategies.join(','))
      body.append('chunk_size', String(chunkSize))
      body.append('overlap', String(overlap))
      body.append('embedding_api_key', embeddingKey.trim())
      body.append('embedding_model', embeddingModel)
      body.append('llm_provider', llmProvider)
      body.append('llm_api_key', llmApiKey.trim())
      body.append('llm_model', llmModel.trim())
      body.append('session_id', activeSessionId)
      const data = await chunkingApi('/chunking/analyze', { method: 'POST', body })
      if (data) {
        setResults(data.results || {})
        setErrors(data.errors || {})
        setFileInfo({
          filename: data.filename,
          file_type: data.file_type,
          file_size: data.file_size,
          char_count: data.char_count,
        })
        setFileType(data.file_type || '')
        const firstOk = selectedStrategies.find((s) => data.results?.[s])
        setActiveTab(firstOk || selectedStrategies[0])
      }
    } catch (err) {
      setGlobalError(err.message)
    } finally {
      setBusy(false)
    }
  }, [
    canAnalyze, file, selectedStrategies, chunkSize, overlap,
    embeddingKey, embeddingModel, llmProvider, llmApiKey, llmModel, sessionId, createSession,
  ])

  // ─── Render helpers ───────────────────────────────────────────────────────

  const resultTabs = results
    ? selectedStrategies.filter((id) => results[id] || errors[id])
    : []

  const activeResult = results && activeTab ? results[activeTab] : null
  const activeError = errors && activeTab ? errors[activeTab] : null
  const activeMeta = strategyMeta[activeTab] || {}
  const currentSession = sessions.find((item) => item.id === sessionId)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="chat-app rag-app chunking-app">
      {/* ── Top Header ── */}
      <header className="chat-header rag-header chunking-header">
        <button className="icon-button" onClick={onBack} title="Back to projects">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1>Chunking Strategy Lab</h1>
          <p>
            {fileInfo
              ? `${fileInfo.filename} · ${fileInfo.char_count?.toLocaleString()} chars · ${resultTabs.length} strategies`
              : 'Compare 8 document chunking strategies side by side'}
          </p>
        </div>
        <div className="rag-session-actions">
          <div className="select-wrap">
            <select
              value={sessionId || ''}
              onChange={(e) => setSessionId(e.target.value || null)}
              aria-label="Chunking session"
            >
              <option value="">Unsaved session</option>
              {sessions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </div>
          <button
            className="icon-button"
            onClick={() => setDeleteTarget({ type: 'session', id: sessionId, name: currentSession?.title || 'this session' })}
            disabled={!sessionId || busy}
            title="Delete session"
          >
            <Trash2 size={17} />
          </button>
          <button className="new-chat-button" onClick={createSession} title="New analysis session">
            <Plus size={17} /> New session
          </button>
        </div>
      </header>

      {/* ── Privacy Notice Banner ── */}
      <div className="privacy-notice">
        <KeyRound size={16} />
        <span>Sessions are kept for 24 hours after the last interaction. Provider and embedding API keys are never saved.</span>
      </div>

      {/* ── Main Workspace 2-Column Layout ── */}
      <div className="chat-layout rag-layout chunking-layout">
        {/* ── Left Sidebar ── */}
        <aside className="chat-sidebar rag-sidebar chunking-sidebar">
          {/* 1. Document Upload Card */}
          <div className="chunking-sidebar-card">
            <h2 className="chunking-section-title">
              <Upload size={14} /> Document
            </h2>
            {!file ? (
              <label
                className={`chunking-drop-zone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.pptx,.txt,.md,.csv,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
                <Upload size={18} />
                <strong>Choose or drop document</strong>
                <span>PDF, DOCX, PPTX, TXT, MD, CSV, XLSX</span>
                <div className="chunking-file-tags">
                  {['PDF', 'DOCX', 'PPTX', 'TXT', 'MD', 'CSV', 'XLSX'].map((t) => (
                    <span className="chunking-file-tag" key={t}>{t}</span>
                  ))}
                </div>
              </label>
            ) : (
              <div className="chunking-active-file">
                <span className="chunking-file-badge">
                  {fileType || file.name.split('.').pop()?.toUpperCase()}
                </span>
                <div className="chunking-file-meta">
                  <strong title={file.name}>{file.name}</strong>
                  <span>{formatBytes(file.size)}</span>
                </div>
                <button
                  type="button"
                  className="chunking-file-remove"
                  onClick={() => { setFile(null); setResults(null); setFileInfo(null); setActiveTab(null) }}
                  title="Remove document"
                >
                  <X size={15} />
                </button>
              </div>
            )}
          </div>

          {/* 2. Strategy Selection */}
          <div className="chunking-sidebar-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="chunking-section-title">
                <Scissors size={14} /> Strategies ({selectedStrategies.length})
              </h2>
              <button
                type="button"
                className="chunking-select-all-btn"
                onClick={toggleAllStrategies}
              >
                {selectedStrategies.length === strategies.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="chunking-strategy-list">
              {strategies.map((s) => (
                <StrategyItem
                  key={s.id}
                  id={s.id}
                  meta={s}
                  selected={selectedStrategies.includes(s.id)}
                  onToggle={toggleStrategy}
                />
              ))}
            </div>
            {activeTab && strategyMeta[activeTab] && (
              <p className="chunking-desc-box">
                <strong>{strategyMeta[activeTab].label}:</strong> {strategyMeta[activeTab].description}
              </p>
            )}
          </div>

          {/* 3. Chunking Parameters */}
          <div className="chunking-sidebar-card">
            <h2 className="chunking-section-title">
              <Settings2 size={14} /> Parameters
            </h2>
            <div className="chunking-param-slider">
              <label>
                <span>Chunk Size</span>
                <output>{chunkSize.toLocaleString()} chars</output>
              </label>
              <input
                type="range"
                min={100}
                max={4000}
                step={50}
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
              />
            </div>
            <div className="chunking-param-slider">
              <label>
                <span>Overlap</span>
                <output>{overlap.toLocaleString()} chars</output>
              </label>
              <input
                type="range"
                min={0}
                max={Math.floor(chunkSize * 0.5)}
                step={10}
                value={Math.min(overlap, Math.floor(chunkSize * 0.5))}
                onChange={(e) => setOverlap(Number(e.target.value))}
              />
            </div>
          </div>

          {/* 4. Embedding Key (if semantic selected) */}
          {needsEmbedding && (
            <div className="chunking-sidebar-card">
              <h2 className="chunking-section-title" style={{ color: '#0369a1' }}>
                <Zap size={14} /> Semantic Embedding
              </h2>
              <div className="chunking-key-inputs">
                <label>
                  <span>Gemini API key</span>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={embeddingKey}
                    onChange={(e) => setEmbeddingKey(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span>Embedding Model</span>
                  <div className="select-wrap">
                    <select
                      value={embeddingModel}
                      onChange={(e) => setEmbeddingModel(e.target.value)}
                    >
                      {EMBEDDING_MODELS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* 5. LLM Config (if agentic selected) */}
          {needsLlm && (
            <div className="chunking-sidebar-card">
              <h2 className="chunking-section-title" style={{ color: '#be185d' }}>
                <Bot size={14} /> Agentic LLM
              </h2>
              <div className="chunking-key-inputs">
                <label>
                  <span>LLM Provider</span>
                  <div className="select-wrap">
                    <select
                      value={llmProvider}
                      onChange={(e) => { setLlmProvider(e.target.value); setLlmModel('') }}
                    >
                      {Object.entries(PROVIDERS).map(([id, p]) => (
                        <option key={id} value={id}>{p.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </div>
                </label>
                <label>
                  <span>API Key</span>
                  <input
                    type="password"
                    placeholder="Not saved"
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span>Model ID (optional)</span>
                  <input
                    type="text"
                    placeholder={PROVIDERS[llmProvider]?.defaultModel || 'Default model'}
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          {/* 6. Primary Action Button */}
          <button
            id="cl-analyze-btn"
            className="index-button chunking-analyze-btn"
            onClick={analyze}
            disabled={!canAnalyze}
          >
            <Sparkles size={16} />
            {busy ? 'Analyzing strategies...' : 'Analyze Document'}
          </button>
        </aside>

        {/* ── Right Main Content Area ── */}
        <main className="rag-main chunking-main">
          {globalError && (
            <div className="chunking-strategy-error" style={{ margin: 16 }}>
              <AlertTriangle size={16} />
              <div>
                <strong>Analysis Error</strong>
                <p>{globalError}</p>
              </div>
            </div>
          )}

          {!results ? (
            <div className="empty-chat" style={{ padding: 40 }}>
              <div><Layers3 size={32} /></div>
              <h2>Ready to chunk</h2>
              <p>
                Upload a document from the left sidebar, select your preferred strategies,
                and click <strong>Analyze Document</strong> to view interactive chunks and statistics.
              </p>
            </div>
          ) : (
            <>
              {/* Top Navigation Tabs */}
              <nav className="rag-tabs chunking-tabs">
                {resultTabs.map((id) => {
                  const meta = strategyMeta[id] || {}
                  const hasError = Boolean(errors[id])
                  const count = results[id]?.stats?.count
                  return (
                    <button
                      key={id}
                      className={`chunking-tab-btn ${activeTab === id && !compareMode ? 'active' : ''} ${hasError ? 'error' : ''}`}
                      onClick={() => { setActiveTab(id); setCompareMode(false) }}
                    >
                      <Layers3 size={14} />
                      {meta.label || id}
                      {count != null && <span className="count">{count}</span>}
                      {hasError && <AlertTriangle size={12} />}
                    </button>
                  )
                })}

                <button
                  className={`chunking-compare-toggle ${compareMode ? 'active' : ''}`}
                  onClick={() => setCompareMode(!compareMode)}
                  title="Compare all strategies side by side"
                >
                  <Columns2 size={14} />
                  {compareMode ? 'Single view' : 'Side-by-side Compare'}
                </button>
              </nav>

              {/* View 1: Compare Mode */}
              {compareMode ? (
                <div className="chunking-compare-container">
                  <div className="chunking-compare-row">
                    {resultTabs.filter((id) => results[id]).map((id) => {
                      const meta = strategyMeta[id] || {}
                      const result = results[id]
                      return (
                        <div key={id} className="chunking-compare-column">
                          <div className="chunking-compare-col-header">
                            <strong>{meta.label || id}</strong>
                            <span>{result.stats.count} chunks</span>
                          </div>
                          {result.chunks.slice(0, 8).map((chunk, idx) => (
                            <ChunkCard
                              key={chunk.index ?? idx}
                              chunk={chunk}
                              index={chunk.index ?? idx}
                            />
                          ))}
                          {result.chunks.length > 8 && (
                            <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', margin: 4 }}>
                              +{result.chunks.length - 8} more chunks (open single view to see all)
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                /* View 2: Single Strategy View */
                <div className="chunking-content-area">
                  {activeError && (
                    <div className="chunking-strategy-error">
                      <AlertTriangle size={16} />
                      <div>
                        <strong>{activeMeta.label || activeTab} failed</strong>
                        <p>{activeError}</p>
                      </div>
                    </div>
                  )}

                  {activeResult && (
                    <>
                      <StatsBar stats={activeResult.stats} chunks={activeResult.chunks} />
                      <div className="chunking-card-list">
                        {activeResult.chunks.map((chunk, idx) => (
                          <ChunkCard
                            key={chunk.index ?? idx}
                            chunk={chunk}
                            index={chunk.index ?? idx}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Delete Confirmation Dialog ── */}
      {deleteTarget && (
        <dialog
          ref={deleteDialog}
          className="delete-dialog"
          onCancel={() => setDeleteTarget(null)}
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
        >
          <div className="delete-dialog-icon"><AlertTriangle size={22} /></div>
          <h2 id="delete-dialog-title">Delete {deleteTarget.type}?</h2>
          <p id="delete-dialog-description">
            <strong>{deleteTarget.name}</strong> will be permanently removed.
          </p>
          <div className="delete-dialog-actions">
            <button autoFocus onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button
              className="danger-button"
              disabled={Boolean(busy)}
              onClick={() => deleteSession(deleteTarget.id)}
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        </dialog>
      )}
    </section>
  )
}
