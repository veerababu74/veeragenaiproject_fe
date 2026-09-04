import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, FileUp, Info, Loader2, Trash2, TriangleAlert } from 'lucide-react'
import { simpleAgentApi } from '../../../lib/simpleAgentApi'
import { useSimpleAgentStore } from './store'

const formatBytes = (bytes) => (bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`)

export default function DocumentsPanel({ onRefresh }) {
  const { documents, quota } = useSimpleAgentStore()
  const [options, setOptions] = useState(null)
  const [strategy, setStrategy] = useState('recursive')
  const [chunkSize, setChunkSize] = useState(1000)
  const [overlap, setOverlap] = useState(150)
  const [embeddingModel, setEmbeddingModel] = useState('gemini-embedding-001')
  const [apiKey, setApiKey] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [lastUpload, setLastUpload] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    simpleAgentApi('/documents/options').then((data) => {
      setOptions(data)
      setStrategy(data.default_strategy)
      setEmbeddingModel(data.default_embedding_model)
    }).catch(() => setOptions(null))
  }, [])

  const upload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Choose a file first.')
      return
    }
    if (!apiKey.trim()) {
      setError('A Google Gemini API key is required to create embeddings.')
      return
    }
    setUploading(true)
    setError('')
    setLastUpload(null)
    const body = new FormData()
    body.append('file', file)
    body.append('chunk_strategy', strategy)
    body.append('chunk_size', String(chunkSize))
    body.append('chunk_overlap', String(overlap))
    body.append('embedding_model', embeddingModel)
    body.append('embedding_api_key', apiKey.trim())
    try {
      const result = await simpleAgentApi('/documents/upload', { method: 'POST', body })
      setLastUpload(result)
      if (fileRef.current) fileRef.current.value = ''
      await onRefresh()
    } catch (requestError) {
      setError(requestError.message)
    }
    setUploading(false)
  }

  const remove = async (documentId) => {
    try {
      await simpleAgentApi(`/documents/${documentId}`, { method: 'DELETE' })
      await onRefresh()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const usedPercent = Math.min(100, Math.round((quota.used_bytes / quota.quota_bytes) * 100))

  return (
    <div className="sa-documents">
      <section className="sa-card">
        <header className="sa-card-head">
          <h3><FileUp size={16} /> Upload a document</h3>
          <span className="sa-muted">
            {formatBytes(quota.used_bytes)} of {formatBytes(quota.quota_bytes)} used
          </span>
        </header>

        <div className="sa-quota"><div style={{ width: `${usedPercent}%` }} /></div>

        <p className="sa-muted">
          Uploads are chunked, embedded with Gemini and indexed in Pinecone. The
          <strong> Document Search </strong> tool then searches them, so attach that tool to the agent for
          this to be reachable.
        </p>

        <div className="sa-field-grid">
          <label className="sa-field sa-field-wide">
            <span>File — {options?.file_types?.join(', ').toUpperCase() || 'PDF, TXT, DOCX, CSV'}</span>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.docx,.csv" />
          </label>

          <label className="sa-field sa-field-wide">
            <span>Chunking strategy</span>
            <div className="sa-strategy-list">
              {(options?.strategies || []).map((item) => (
                <button key={item.id} type="button"
                  className={`sa-strategy ${strategy === item.id ? 'active' : ''}`}
                  onClick={() => setStrategy(item.id)}>
                  <strong>{item.id.replace('_', '-')}</strong>
                  <span>{item.label.split('—')[1]?.trim() || item.label}</span>
                </button>
              ))}
            </div>
          </label>

          <label className="sa-field">
            <span>Chunk size · {chunkSize}</span>
            <input type="range" min={200} max={3000} step={100} value={chunkSize}
              onChange={(event) => setChunkSize(Number(event.target.value))} />
          </label>

          <label className="sa-field">
            <span>Overlap · {overlap}</span>
            <input type="range" min={0} max={500} step={25} value={overlap}
              onChange={(event) => setOverlap(Number(event.target.value))} />
            <small>{strategy === 'semantic' ? 'Semantic chunking finds its own boundaries; overlap is unused.' : 'Characters repeated between neighbouring chunks.'}</small>
          </label>

          <label className="sa-field">
            <span>Embedding model</span>
            <select value={embeddingModel} onChange={(event) => setEmbeddingModel(event.target.value)}>
              {(options?.embedding_models || []).map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>

          <label className="sa-field">
            <span>Google Gemini API key</span>
            <input type="password" value={apiKey} autoComplete="off" placeholder="Used for embeddings"
              onChange={(event) => setApiKey(event.target.value)} />
            <small>Saved so the search tool can embed queries with the same model. Deleted after 48 hours.</small>
          </label>
        </div>

        {error && <p className="sa-error">{error}</p>}

        <div className="sa-card-actions">
          <button className="sa-primary" onClick={upload} disabled={uploading}>
            {uploading ? <Loader2 size={14} className="sa-spin" /> : <FileUp size={14} />}
            {uploading ? 'Extracting, chunking and indexing…' : 'Upload and index'}
          </button>
        </div>

        {lastUpload && lastUpload.status === 'ready' && (
          <div className="sa-upload-result">
            <h4><CheckCircle2 size={14} /> {lastUpload.file_name} indexed</h4>
            <p>
              {lastUpload.chunk_count} chunks · {lastUpload.chunk_strategy.replace('_', '-')} ·
              {' '}{lastUpload.embedding_model}
            </p>
            {Object.keys(lastUpload.structure || {}).length > 0 && (
              <p className="sa-muted">
                Structure found: {Object.entries(lastUpload.structure)
                  .map(([kind, count]) => `${count} ${kind}${count === 1 ? '' : 's'}`).join(', ')}
              </p>
            )}
            {lastUpload.chunk_preview?.length > 0 && (
              <details>
                <summary>First chunks</summary>
                {lastUpload.chunk_preview.map((chunk, index) => <pre key={index}>{chunk}</pre>)}
              </details>
            )}
          </div>
        )}
        {lastUpload && lastUpload.status === 'error' && (
          <p className="sa-error"><TriangleAlert size={13} /> {lastUpload.error_message}</p>
        )}
      </section>

      <section className="sa-card">
        <header className="sa-card-head"><h3><Info size={16} /> Indexed documents</h3></header>
        {documents.length === 0 && <p className="sa-muted">Nothing uploaded yet.</p>}
        <ul className="sa-doc-rows">
          {documents.map((document) => (
            <li key={document.id}>
              <div>
                <strong>{document.file_name}</strong>
                <small>
                  {formatBytes(document.file_size)} · {document.chunk_count} chunks ·
                  {' '}{document.chunk_strategy.replace('_', '-')} · {document.status}
                </small>
                {document.error_message && <em className="sa-error-text">{document.error_message}</em>}
              </div>
              <button className="sa-danger-link" onClick={() => remove(document.id)}><Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
