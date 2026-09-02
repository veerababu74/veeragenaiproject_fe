import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react'
import { agentApi, agentUpload } from '../../../lib/agentApi'

const EMBEDDING_MODELS = ['gemini-embedding-001', 'text-embedding-004']

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function statusIcon(status) {
  if (status === 'ready') return <CheckCircle size={15} className="status-ready" />
  if (status === 'processing') return <Loader2 size={15} className="status-processing agent-spin" />
  if (status === 'error') return <AlertCircle size={15} className="status-error" />
  return <Clock size={15} className="status-pending" />
}

export default function RagManager() {
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [embeddingModel, setEmbeddingModel] = useState(EMBEDDING_MODELS[0])
  const [embeddingApiKey, setEmbeddingApiKey] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const load = () => agentApi('/rag/documents').then(setDocs).catch(() => {})
  useEffect(() => { load() }, [])

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Select a file'); return }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) { setError('Only PDF, DOC, DOCX, or TXT files are supported'); return }
    if (file.size > 4 * 1024 * 1024) { setError('Max file size is 4MB'); return }
    if (embeddingApiKey.trim().length < 8) { setError('Enter a valid Google Gemini API key'); return }
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('embedding_model', embeddingModel)
      formData.append('embedding_api_key', embeddingApiKey.trim())
      await agentUpload('/rag/upload', formData)
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (requestError) { setError(requestError.message) }
    setUploading(false)
  }

  const remove = async (id) => {
    if (!confirm('Delete this document?')) return
    try { await agentApi(`/rag/documents/${id}`, { method: 'DELETE' }); load() } catch (requestError) { setError(requestError.message) }
  }

  return (
    <div className="agent-panel">
      <header className="agent-panel-header"><h1>RAG Document Manager</h1><p>Upload PDF, DOC, or TXT files (max 4MB). Storage is automatic; embeddings use your own Gemini key.</p></header>
      <div className="agent-panel-scroll"><div className="agent-panel-content">
        <section className="agent-card">
          <h2><Upload size={16} /> Upload Document</h2>
          <p className="agent-muted">Supported: PDF, DOC, DOCX, TXT (max 4MB). Embeddings are generated with Google Gemini using your own API key — it's used for this upload only and isn't saved.</p>
          <label>Select File *<input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" /></label>
          <div className="agent-dialog-row">
            <label>Embedding Model<select value={embeddingModel} onChange={(e) => setEmbeddingModel(e.target.value)}>{EMBEDDING_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
            <label>Gemini API Key *<input type="password" value={embeddingApiKey} onChange={(e) => setEmbeddingApiKey(e.target.value)} placeholder="AIza..." /></label>
          </div>
          {error && <p className="agent-error">{error}</p>}
          <button className="agent-primary-button full" onClick={handleUpload} disabled={uploading}>{uploading ? <><Loader2 size={15} className="agent-spin" /> Processing...</> : <><Upload size={15} /> Upload and Process</>}</button>
        </section>

        <section className="agent-card">
          <h2>Uploaded Documents</h2>
          {docs.length === 0 ? <div className="agent-empty"><FileText size={32} /><p>No documents yet</p></div> : <div className="agent-list">
            {docs.map((doc) => (
              <div className="agent-list-row" key={doc.id}>
                <div className="agent-list-row-main">{statusIcon(doc.status)}<div><p>{doc.file_name}</p><small>{formatSize(doc.file_size)} · {doc.chunk_count} chunks{doc.embedding_model ? ` · ${doc.embedding_model}` : ''}</small>{doc.error_message && <small className="status-error">{doc.error_message}</small>}</div></div>
                <div className="agent-list-row-actions"><span className={`badge ${doc.status === 'error' ? 'destructive' : doc.status === 'ready' ? '' : 'outline'}`}>{doc.status}</span><button className="icon-button danger" onClick={() => remove(doc.id)}><Trash2 size={14} /></button></div>
              </div>
            ))}
          </div>}
        </section>

        <section className="agent-card notice">
          <Clock size={18} />
          <div><p>48-Hour Data Retention</p><small>All uploaded documents, their chunks, and embeddings are automatically deleted after 48 hours.</small></div>
        </section>
      </div></div>
    </div>
  )
}
