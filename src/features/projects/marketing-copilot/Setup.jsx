import { useEffect, useState } from 'react'
import { Boxes, CheckCircle2, KeyRound, Loader2, Play } from 'lucide-react'
import { marketingApi } from './api'

/* Setup: the user's own key, and building the index with it.
 *
 * Two steps rather than one, kept visibly separate because they fail for
 * different reasons and at different times. Saving a key is instant and either
 * works or does not; indexing runs an embedding call per chunk and is where a
 * wrong key, a wrong model name or an exhausted quota actually shows up. Merging
 * them would report an embedding failure as if the key had not saved.
 */

export default function Setup({ overview, onConfigured }) {
  const [catalog, setCatalog] = useState([])
  const [provider, setProvider] = useState('openai')
  const [chatModel, setChatModel] = useState('gpt-4o-mini')
  const [embedModel, setEmbedModel] = useState('text-embedding-3-small')
  const [apiKey, setApiKey] = useState('')
  const [keyHint, setKeyHint] = useState('')
  const [configured, setConfigured] = useState(false)
  const [saving, setSaving] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [indexResult, setIndexResult] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    marketingApi('/setup').then((data) => {
      setCatalog(data.providers)
      setProvider(data.provider)
      setChatModel(data.chat_model)
      setEmbedModel(data.embed_model)
      setKeyHint(data.key_hint)
      setConfigured(data.configured)
    }).catch((requestError) => setError(requestError.message))
  }, [])

  const active = catalog.find((item) => item.provider === provider)

  const changeProvider = (next) => {
    setProvider(next)
    const entry = catalog.find((item) => item.provider === next)
    if (entry) {
      setChatModel(entry.chat_models[0])
      setEmbedModel(entry.embed_models[0])
    }
  }

  const save = async () => {
    if (!apiKey.trim()) { setError('Paste an API key first.'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      await marketingApi('/setup', {
        method: 'POST',
        body: JSON.stringify({ provider, chat_model: chatModel, embed_model: embedModel, api_key: apiKey }),
      })
      setConfigured(true)
      setKeyHint(`…${apiKey.slice(-4)}`)
      setApiKey('')
      setNotice('Key saved. Now build the index so the copilot can search the corpus.')
      onConfigured?.()
    } catch (requestError) {
      setError(requestError.message)
    }
    setSaving(false)
  }

  const buildIndex = async () => {
    setIndexing(true); setError(''); setNotice(''); setIndexResult(null)
    try {
      const result = await marketingApi('/index', { method: 'POST' })
      setIndexResult(result)
      onConfigured?.()
    } catch (requestError) {
      setError(requestError.message)
    }
    setIndexing(false)
  }

  const indexed = overview?.corpus?.chunks_indexed || 0

  return (
    <div className="mc-setup">
      <div className="mc-card">
        <div className="mc-card-head">
          <h3><KeyRound size={15} /> 1. Your model key</h3>
          {configured && <span className="mc-pill-good"><CheckCircle2 size={12} /> saved {keyHint}</span>}
        </div>
        <p className="mc-note">
          The copilot runs on your own key — it is used for this workspace only and never
          leaves the server. One key covers both jobs: the chat model answers, and the
          embedding model indexes the corpus.
        </p>

        <div className="mc-field-grid">
          <label className="mc-field">
            <span>Provider</span>
            <select value={provider} onChange={(event) => changeProvider(event.target.value)}>
              {catalog.map((item) => (
                <option key={item.provider} value={item.provider}>{item.label}</option>
              ))}
            </select>
            {active && <small>{active.key_hint}</small>}
          </label>

          <label className="mc-field">
            <span>Chat model</span>
            <input list="mc-chat-models" value={chatModel}
                   onChange={(event) => setChatModel(event.target.value)} />
            <datalist id="mc-chat-models">
              {(active?.chat_models || []).map((model) => <option key={model} value={model} />)}
            </datalist>
            <small>Answers, routes and grades. A small model is enough.</small>
          </label>

          <label className="mc-field">
            <span>Embedding model</span>
            <input list="mc-embed-models" value={embedModel}
                   onChange={(event) => setEmbedModel(event.target.value)} />
            <datalist id="mc-embed-models">
              {(active?.embed_models || []).map((model) => <option key={model} value={model} />)}
            </datalist>
            <small>Changing this later means rebuilding the index.</small>
          </label>

          <label className="mc-field">
            <span>API key</span>
            <input type="password" autoComplete="off" value={apiKey}
                   placeholder={configured ? 'Replace the saved key' : 'Paste your key'}
                   onChange={(event) => setApiKey(event.target.value)} />
            <small>Stored against your account, never returned to the browser.</small>
          </label>
        </div>

        <button className="mc-primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={14} className="mc-spin" /> : <KeyRound size={14} />}
          {configured ? 'Update key' : 'Save key'}
        </button>
      </div>

      <div className="mc-card">
        <div className="mc-card-head">
          <h3><Boxes size={15} /> 2. Build the index</h3>
          {indexed > 0 && <span className="mc-pill-good"><CheckCircle2 size={12} /> {indexed} chunks</span>}
        </div>
        <p className="mc-note">
          Chunks every document on its headings and embeds each piece. Idempotent — running it
          again skips anything already indexed rather than adding a second copy, because
          duplicate chunks degrade retrieval without ever raising an error.
        </p>

        {overview?.corpus && (
          <dl className="mc-stats">
            <div><dt>documents</dt><dd>{overview.corpus.documents}</dd></div>
            <div><dt>campaign rows</dt><dd>{overview.corpus.campaigns}</dd></div>
            <div><dt>compliance rules</dt><dd>{overview.corpus.rules}</dd></div>
            <div><dt>vector store</dt><dd>{overview.corpus.retriever}</dd></div>
          </dl>
        )}

        <button className="mc-primary" onClick={buildIndex} disabled={indexing || !configured}>
          {indexing ? <Loader2 size={14} className="mc-spin" /> : <Play size={14} />}
          {indexing ? 'Embedding…' : indexed > 0 ? 'Re-index' : 'Build index'}
        </button>

        {indexResult && (
          <p className="mc-note mc-good">
            Embedded {indexResult.chunks_embedded} chunk(s); skipped {indexResult.documents_skipped}{' '}
            already-indexed document(s). Backend: <strong>{indexResult.backend}</strong>.
            {indexResult.backend === 'local' && (
              ' Pinecone is not configured on this deployment, so search runs as brute-force'
              + ' cosine over SQLite — exact, and fine at this corpus size.'
            )}
          </p>
        )}
        {!configured && <p className="mc-note">Save a key first.</p>}
      </div>

      {notice && <p className="mc-notice">{notice}</p>}
      {error && <p className="mc-error">{error}</p>}
    </div>
  )
}
