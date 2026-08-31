import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, BarChart3, Check, ChevronDown, ChevronUp,
  Columns2, FileText, Layers, Plus, Scissors, Settings2, SplitSquareVertical,
  Trash2, Upload, X, Zap
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

const FILE_TYPE_COLORS = {
  PDF: { bg: '#ef4444', text: 'white' },
  DOCX: { bg: '#3b82f6', text: 'white' },
  PowerPoint: { bg: '#f97316', text: 'white' },
  CSV: { bg: '#10b981', text: 'white' },
  Excel: { bg: '#22c55e', text: 'white' },
  Markdown: { bg: '#a855f7', text: 'white' },
  Text: { bg: '#64748b', text: 'white' },
}

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const formatTime = (ts) => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChunkCard({ chunk, color, index }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = chunk.content.length > 300

  return (
    <article
      className="cl-chunk-card"
      style={{ '--chunk-color': color, '--chunk-index': index }}
    >
      <div className="cl-chunk-header">
        <span className="cl-chunk-label">Chunk {chunk.index + 1}</span>
        <div className="cl-chunk-meta">
          <span><strong>{chunk.char_count.toLocaleString()}</strong> chars</span>
          <span><strong>{chunk.word_count.toLocaleString()}</strong> words</span>
          {chunk.sentence_count != null && <span><strong>{chunk.sentence_count}</strong> sentences</span>}
          {chunk.approx_tokens != null && <span>~<strong>{chunk.approx_tokens}</strong> tokens</span>}
        </div>
      </div>
      <div className={`cl-chunk-body ${expanded ? 'expanded' : ''}`}>
        {chunk.content}
      </div>
      {isLong && (
        <button className="cl-chunk-expand" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </article>
  )
}

function StatsBar({ stats, color }) {
  return (
    <div className="cl-stats-bar">
      <div className="cl-stat">
        <span className="cl-stat-value" style={{ color }}>{stats.count.toLocaleString()}</span>
        <span className="cl-stat-label">Chunks</span>
      </div>
      <div className="cl-stat">
        <span className="cl-stat-value">{stats.avg_chars.toLocaleString()}</span>
        <span className="cl-stat-label">Avg chars</span>
      </div>
      <div className="cl-stat">
        <span className="cl-stat-value">{stats.min_chars.toLocaleString()}</span>
        <span className="cl-stat-label">Min chars</span>
      </div>
      <div className="cl-stat">
        <span className="cl-stat-value">{stats.max_chars.toLocaleString()}</span>
        <span className="cl-stat-label">Max chars</span>
      </div>
      <div className="cl-stat">
        <span className="cl-stat-value">{stats.total_chars.toLocaleString()}</span>
        <span className="cl-stat-label">Total chars</span>
      </div>
    </div>
  )
}

function StrategyItem({ id, meta, selected, onToggle }) {
  return (
    <div
      id={`strategy-${id}`}
      className={`cl-strategy-item ${selected ? 'selected' : ''}`}
      style={{ '--strategy-color': meta.color }}
      onClick={() => onToggle(id)}
    >
      <div className="cl-strategy-checkbox">
        {selected && <Check size={10} strokeWidth={3} color="white" />}
      </div>
      <div className="cl-strategy-dot" />
      <label htmlFor={`strategy-${id}`}>{meta.label}</label>
      <div className="cl-strategy-badges">
        {meta.requires_embedding && <span className="cl-badge embed">Embed</span>}
        {meta.requires_llm && <span className="cl-badge llm">LLM</span>}
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
  const [showSessions, setShowSessions] = useState(false)

  // UI state
  const [busy, setBusy] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const sessionPanelRef = useRef(null)
  const fileInputRef = useRef(null)

  // ─── Load strategies metadata ─────────────────────────────────────────────
  useEffect(() => {
    chunkingApi('/chunking/strategies')
      .then((data) => setStrategies(data))
      .catch(() => setStrategies([]))
  }, [])

  // ─── Load sessions ────────────────────────────────────────────────────────
  useEffect(() => {
    chunkingApi('/chunking/sessions')
      .then(setSessions)
      .catch(() => setSessions([]))
  }, [])

  // ─── Close session panel on outside click ────────────────────────────────
  useEffect(() => {
    function handleClick(e) {
      if (sessionPanelRef.current && !sessionPanelRef.current.contains(e.target)) {
        setShowSessions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ─── Derived state ────────────────────────────────────────────────────────
  const strategyMeta = Object.fromEntries(strategies.map((s) => [s.id, s]))
  const needsEmbedding = selectedStrategies.some((id) => strategyMeta[id]?.requires_embedding)
  const needsLlm = selectedStrategies.some((id) => strategyMeta[id]?.requires_llm)
  const canAnalyze = file && selectedStrategies.length > 0 && !busy

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
    const dropped = e.dataTransfer.files[0]
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
      setSessions((prev) => [s, ...prev])
      setSessionId(s.id)
      setShowSessions(false)
      return s.id
    } catch (err) {
      setGlobalError(err.message)
      return null
    }
  }, [])

  const deleteSession = useCallback(async (id, e) => {
    e.stopPropagation()
    try {
      await chunkingApi(`/chunking/sessions/${id}`, { method: 'DELETE' })
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (sessionId === id) setSessionId(null)
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
      body.append('chunk_size', chunkSize)
      body.append('overlap', overlap)
      body.append('embedding_api_key', embeddingKey)
      body.append('embedding_model', embeddingModel)
      body.append('llm_provider', llmProvider)
      body.append('llm_api_key', llmApiKey)
      body.append('llm_model', llmModel)
      body.append('session_id', activeSessionId)
      const data = await chunkingApi('/chunking/analyze', { method: 'POST', body })
      setResults(data.results)
      setErrors(data.errors || {})
      setFileInfo({ filename: data.filename, file_type: data.file_type, file_size: data.file_size, char_count: data.char_count })
      setFileType(data.file_type)
      // Set active tab to first successful strategy
      const firstOk = selectedStrategies.find((s) => data.results[s])
      setActiveTab(firstOk || selectedStrategies[0])
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="chunking-lab">
      {/* ── Header ── */}
      <header className="cl-header">
        <button id="cl-back-btn" className="cl-back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>

        <div className="cl-header-title">
          <div className="cl-header-icon">
            <Scissors size={20} color="white" />
          </div>
          <div>
            <h1>Chunking Lab</h1>
            <p>Visualize document chunking strategies in real time</p>
          </div>
        </div>

        {/* Session picker */}
        <div className="cl-rel" ref={sessionPanelRef}>
          <button
            id="cl-sessions-btn"
            className={`cl-session-btn ${showSessions ? 'active' : ''}`}
            onClick={() => setShowSessions(!showSessions)}
          >
            <Layers size={15} />
            {sessionId ? sessions.find((s) => s.id === sessionId)?.title || 'Session' : 'Sessions'}
            <ChevronDown size={13} />
          </button>

          {showSessions && (
            <div className="cl-session-panel">
              <div className="cl-session-panel-header">
                <span>Sessions</span>
                <X size={14} style={{ cursor: 'pointer', color: '#64748b' }} onClick={() => setShowSessions(false)} />
              </div>
              {sessions.length === 0 && (
                <p style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem', margin: 0 }}>
                  No sessions yet. Create one to save your analyses.
                </p>
              )}
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`cl-session-item ${sessionId === s.id ? 'active' : ''}`}
                  onClick={() => { setSessionId(s.id); setShowSessions(false) }}
                >
                  <FileText size={15} color="#6366f1" />
                  <div className="cl-session-item-text">
                    <strong>{s.title}</strong>
                    <span>{formatTime(s.created_at)}</span>
                  </div>
                  <button
                    className="cl-session-delete"
                    onClick={(e) => deleteSession(s.id, e)}
                    title="Delete session"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button className="cl-session-new-btn" onClick={createSession}>
                <Plus size={14} /> New session
              </button>
            </div>
          )}
        </div>
      </header>

      {busy && <div className="cl-progress-bar" />}

      {globalError && (
        <div className="cl-global-error">
          <AlertTriangle size={15} /> {globalError}
        </div>
      )}

      {/* ── Body ── */}
      <div className="cl-body">
        {/* ── Sidebar ── */}
        <aside className="cl-sidebar">
          {/* Upload */}
          <div className="cl-card">
            <h2 className="cl-card-title"><Upload size={14} /> Document</h2>
            {!file ? (
              <div
                id="cl-upload-zone"
                className={`cl-upload-zone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.pptx,.txt,.md,.csv,.xlsx"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  id="cl-file-input"
                />
                <div className="cl-upload-icon"><Upload size={20} /></div>
                <h3>Drop your document</h3>
                <p>or click to browse</p>
                <div className="cl-file-types">
                  {['PDF', 'DOCX', 'PPTX', 'TXT', 'MD', 'CSV', 'XLSX'].map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="cl-file-info">
                <div
                  className="cl-file-icon"
                  style={{
                    background: FILE_TYPE_COLORS[fileType]?.bg || '#6366f1',
                    color: FILE_TYPE_COLORS[fileType]?.text || 'white',
                  }}
                >
                  {fileType || file.name.split('.').pop().toUpperCase()}
                </div>
                <div className="cl-file-info-text">
                  <strong title={file.name}>{file.name}</strong>
                  <span>
                    {formatBytes(file.size)}
                    {fileInfo && ` · ${fileInfo.char_count.toLocaleString()} chars`}
                  </span>
                </div>
                <button
                  className="cl-file-remove"
                  onClick={() => { setFile(null); setResults(null); setFileInfo(null); setActiveTab(null) }}
                  title="Remove file"
                >
                  <X size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Strategies */}
          <div className="cl-card">
            <h2 className="cl-card-title"><SplitSquareVertical size={14} /> Strategies</h2>
            <div className="cl-strategies-grid">
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
            <button className="cl-select-all-btn" onClick={toggleAllStrategies}>
              {selectedStrategies.length === strategies.length ? 'Deselect all' : 'Select all strategies'}
            </button>
            {activeTab && strategyMeta[activeTab] && (
              <p
                className="cl-description"
                style={{ '--desc-color': strategyMeta[activeTab].color }}
              >
                {strategyMeta[activeTab].description}
              </p>
            )}
          </div>

          {/* Chunk parameters */}
          <div className="cl-card">
            <h2 className="cl-card-title"><Settings2 size={14} /> Parameters</h2>
            <div className="cl-control-group">
              <div>
                <div className="cl-control-label">
                  Chunk Size <span>{chunkSize.toLocaleString()} chars</span>
                </div>
                <input
                  id="cl-chunk-size"
                  className="cl-slider"
                  type="range"
                  min={100}
                  max={4000}
                  step={50}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                />
              </div>
              <div>
                <div className="cl-control-label">
                  Overlap <span>{overlap.toLocaleString()} chars</span>
                </div>
                <input
                  id="cl-overlap"
                  className="cl-slider"
                  type="range"
                  min={0}
                  max={Math.floor(chunkSize * 0.5)}
                  step={10}
                  value={Math.min(overlap, Math.floor(chunkSize * 0.5))}
                  onChange={(e) => setOverlap(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Embedding config (visible when semantic selected) */}
          {needsEmbedding && (
            <div className="cl-card">
              <h2 className="cl-card-title" style={{ color: '#10b981' }}>
                <Zap size={14} /> Embedding (Semantic)
              </h2>
              <div className="cl-control-group">
                <div>
                  <div className="cl-control-label">Gemini API Key</div>
                  <input
                    id="cl-embedding-key"
                    className="cl-input"
                    type="password"
                    placeholder="AIza..."
                    value={embeddingKey}
                    onChange={(e) => setEmbeddingKey(e.target.value)}
                  />
                </div>
                <div>
                  <div className="cl-control-label">Embedding Model</div>
                  <select
                    id="cl-embedding-model"
                    className="cl-select"
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                  >
                    {EMBEDDING_MODELS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* LLM config (visible when agentic selected) */}
          {needsLlm && (
            <div className="cl-card">
              <h2 className="cl-card-title" style={{ color: '#ec4899' }}>
                <Zap size={14} /> LLM (Agentic)
              </h2>
              <div className="cl-control-group">
                <div>
                  <div className="cl-control-label">Provider</div>
                  <select
                    id="cl-llm-provider"
                    className="cl-select"
                    value={llmProvider}
                    onChange={(e) => { setLlmProvider(e.target.value); setLlmModel('') }}
                  >
                    {Object.entries(PROVIDERS).map(([id, p]) => (
                      <option key={id} value={id}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="cl-control-label">API Key</div>
                  <input
                    id="cl-llm-key"
                    className="cl-input"
                    type="password"
                    placeholder={PROVIDERS[llmProvider]?.defaultModel || 'API key...'}
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                  />
                </div>
                <div>
                  <div className="cl-control-label">Model (optional)</div>
                  <input
                    id="cl-llm-model"
                    className="cl-input"
                    type="text"
                    placeholder={PROVIDERS[llmProvider]?.defaultModel || 'Default model'}
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Analyze button */}
          <button
            id="cl-analyze-btn"
            className="cl-analyze-btn"
            onClick={analyze}
            disabled={!canAnalyze}
          >
            {busy ? (
              <><div className="cl-spinner" /> Analyzing…</>
            ) : (
              <><BarChart3 size={17} /> Analyze Document</>
            )}
          </button>
        </aside>

        {/* ── Results Area ── */}
        <main className="cl-main">
          {!results ? (
            <div className="cl-empty">
              <div className="cl-empty-graphic">
                <div className="cl-empty-graphic-ring">
                  <div className="cl-empty-graphic-inner">
                    <Scissors size={32} />
                  </div>
                </div>
              </div>
              <h2>Ready to chunk</h2>
              <p>
                Upload a document, select the chunking strategies you want to compare,
                then click Analyze to see them in action.
              </p>
              <div className="cl-empty-steps">
                <div className="cl-empty-step">
                  <div className="cl-empty-step-num">1</div>
                  <span>Upload a PDF, DOCX, CSV, or other file</span>
                </div>
                <div className="cl-empty-step">
                  <div className="cl-empty-step-num">2</div>
                  <span>Select strategies and set chunk size</span>
                </div>
                <div className="cl-empty-step">
                  <div className="cl-empty-step-num">3</div>
                  <span>Click Analyze and compare results</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="cl-tabs-bar">
                {resultTabs.map((id, i) => {
                  const meta = strategyMeta[id] || {}
                  const hasError = !!errors[id]
                  const count = results[id]?.stats?.count
                  return (
                    <button
                      key={id}
                      id={`cl-tab-${id}`}
                      className={`cl-tab ${activeTab === id ? 'active' : ''} ${hasError ? 'cl-tab-error' : ''}`}
                      style={{ '--tab-color': meta.color || '#6366f1' }}
                      onClick={() => { setActiveTab(id); setCompareMode(false) }}
                    >
                      <span className="cl-tab-dot" />
                      {meta.label || id}
                      {count != null && <span className="cl-tab-count">{count}</span>}
                      {hasError && <AlertTriangle size={12} />}
                    </button>
                  )
                })}
                <div className="cl-tab-separator" />
                <button
                  id="cl-compare-btn"
                  className={`cl-compare-btn ${compareMode ? 'active' : ''}`}
                  onClick={() => setCompareMode(!compareMode)}
                >
                  <Columns2 size={14} />
                  {compareMode ? 'Single view' : 'Compare'}
                </button>
              </div>

              {compareMode ? (
                /* ─── Compare Grid ─── */
                <div className="cl-compare-grid">
                  {resultTabs.filter((id) => results[id]).map((id) => {
                    const meta = strategyMeta[id] || {}
                    const result = results[id]
                    return (
                      <div key={id} className="cl-compare-col">
                        <div
                          className="cl-compare-col-header"
                          style={{ '--col-color': meta.color || '#6366f1' }}
                        >
                          <span className="cl-compare-col-dot" />
                          {meta.label || id}
                          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8' }}>
                            {result.stats.count} chunks
                          </span>
                        </div>
                        {result.chunks.slice(0, 5).map((chunk) => (
                          <ChunkCard
                            key={chunk.index}
                            chunk={chunk}
                            color={meta.color || '#6366f1'}
                            index={chunk.index}
                          />
                        ))}
                        {result.chunks.length > 5 && (
                          <p style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', margin: '0.25rem' }}>
                            +{result.chunks.length - 5} more chunks (switch to single view to see all)
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* ─── Single Strategy View ─── */
                <div className="cl-results">
                  {activeError && (
                    <div className="cl-error-card">
                      <AlertTriangle size={16} />
                      <div>
                        <strong>{activeMeta.label || activeTab} failed</strong>
                        <p style={{ margin: '0.25rem 0 0', opacity: 0.85 }}>{activeError}</p>
                      </div>
                    </div>
                  )}

                  {activeResult && (
                    <>
                      <StatsBar stats={activeResult.stats} color={activeMeta.color || '#6366f1'} />
                      <div className="cl-chunks-grid">
                        {activeResult.chunks.map((chunk) => (
                          <ChunkCard
                            key={chunk.index}
                            chunk={chunk}
                            color={activeMeta.color || '#6366f1'}
                            index={chunk.index}
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
    </div>
  )
}
