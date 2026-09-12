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
  const [catalog, setCatalog] = useState(null)
  const [provider, setProvider] = useState('openai')
  const [chatModel, setChatModel] = useState('gpt-4o-mini')
  const [apiKey, setApiKey] = useState('')
  const [keyHint, setKeyHint] = useState('')
  // Embeddings are configured separately: the fastest chat provider may serve
  // no embeddings at all, so tying them together quietly rules it out.
  const [embedProvider, setEmbedProvider] = useState('openai')
  const [embedModel, setEmbedModel] = useState('text-embedding-3-small')
  const [embedKey, setEmbedKey] = useState('')
  const [embedKeyHint, setEmbedKeyHint] = useState('')
  const [reuseKey, setReuseKey] = useState(true)
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
      setKeyHint(data.key_hint)
      setEmbedProvider(data.embed_provider)
      setEmbedModel(data.embed_model)
      setEmbedKeyHint(data.embed_key_hint)
      setConfigured(data.configured)
      // Only offer to reuse one key when nothing is saved yet; once both exist
      // separately, silently overwriting one with the other would be rude.
      setReuseKey(!data.embed_configured && data.embed_provider === data.provider)
    }).catch((requestError) => setError(requestError.message))
  }, [])

  const chatCatalog = catalog?.chat || []
  const embedCatalog = catalog?.embedding || []
  const active = chatCatalog.find((item) => item.provider === provider)
  const activeEmbed = embedCatalog.find((item) => item.provider === embedProvider)
  // Reusing one key only makes sense when both halves point at the same vendor.
  const canReuse = embedProvider === provider

  const changeProvider = (next) => {
    setProvider(next)
    const entry = chatCatalog.find((item) => item.provider === next)
    if (entry) setChatModel(entry.models[0])
  }

  const changeEmbedProvider = (next) => {
    setEmbedProvider(next)
    const entry = embedCatalog.find((item) => item.provider === next)
    if (entry) setEmbedModel(entry.models[0])
  }

  const save = async () => {
    const sharedKey = reuseKey && canReuse ? apiKey.trim() : embedKey.trim()
    if (!apiKey.trim() && !sharedKey && !keyHint && !embedKeyHint) {
      setError('Paste at least one API key first.')
      return
    }
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await marketingApi('/setup', {
        method: 'POST',
        body: JSON.stringify({
          provider, chat_model: chatModel, api_key: apiKey.trim(),
          embed_provider: embedProvider, embed_model: embedModel,
          embed_api_key: sharedKey,
        }),
      })
      if (apiKey.trim()) setKeyHint(`…${apiKey.slice(-4)}`)
      if (sharedKey) setEmbedKeyHint(`…${sharedKey.slice(-4)}`)
      setConfigured(response.chat_configured && response.embed_configured)
      setApiKey('')
      setEmbedKey('')
      setNotice(response.chat_configured && response.embed_configured
        ? 'Saved. Now build the index so the copilot can search the corpus.'
        : `Saved, but ${response.chat_configured ? 'the embedding' : 'the chat'} key is still `
          + 'missing — both are needed before anything runs.')
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
          <h3><KeyRound size={15} /> 1. Your model keys</h3>
          {configured && <span className="mc-pill-good"><CheckCircle2 size={12} /> both saved</span>}
        </div>
        <p className="mc-note">
          Two different jobs, configured separately. The <strong>chat model</strong> answers,
          routes and grades; the <strong>embedding model</strong> indexes the corpus and is used
          again on every search. They do not have to be the same provider — Groq is quick and
          cheap for routing but serves no embeddings, so pairing it with OpenAI or Google is a
          sensible combination. Keys are stored against your account and never returned to the
          browser.
        </p>

        <h5 className="mc-sublabel">Chat {keyHint && <em className="mc-saved">saved {keyHint}</em>}</h5>
        <div className="mc-field-grid">
          <label className="mc-field">
            <span>Provider</span>
            <select value={provider} onChange={(event) => changeProvider(event.target.value)}>
              {chatCatalog.map((item) => (
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
              {(active?.models || []).map((model) => <option key={model} value={model} />)}
            </datalist>
            <small>Answers, routes and grades. A small model is enough.</small>
          </label>

          <label className="mc-field">
            <span>Chat API key</span>
            <input type="password" autoComplete="off" value={apiKey}
                   placeholder={keyHint ? `saved ${keyHint} — leave blank to keep` : 'Paste your key'}
                   onChange={(event) => setApiKey(event.target.value)} />
            <small>Leave blank to keep the one already saved.</small>
          </label>
        </div>

        <h5 className="mc-sublabel">
          Embeddings {embedKeyHint && <em className="mc-saved">saved {embedKeyHint}</em>}
        </h5>
        <div className="mc-field-grid">
          <label className="mc-field">
            <span>Provider</span>
            <select value={embedProvider}
                    onChange={(event) => changeEmbedProvider(event.target.value)}>
              {embedCatalog.map((item) => (
                <option key={item.provider} value={item.provider}>{item.label}</option>
              ))}
            </select>
            {activeEmbed && <small>{activeEmbed.key_hint}</small>}
          </label>

          <label className="mc-field">
            <span>Embedding model</span>
            <input list="mc-embed-models" value={embedModel}
                   onChange={(event) => setEmbedModel(event.target.value)} />
            <datalist id="mc-embed-models">
              {(activeEmbed?.models || []).map((model) => <option key={model} value={model} />)}
            </datalist>
            <small>Changing this later means rebuilding the index.</small>
          </label>

          <label className="mc-field">
            <span>Embedding API key</span>
            <input type="password" autoComplete="off"
                   value={reuseKey && canReuse ? '' : embedKey}
                   disabled={reuseKey && canReuse}
                   placeholder={reuseKey && canReuse
                     ? 'using the chat key above'
                     : embedKeyHint ? `saved ${embedKeyHint} — leave blank to keep` : 'Paste your key'}
                   onChange={(event) => setEmbedKey(event.target.value)} />
            <small>
              {canReuse
                ? 'Same provider as chat, so one key can serve both.'
                : 'A different provider from chat, so this needs its own key.'}
            </small>
          </label>
        </div>

        {canReuse && (
          <label className="mc-reuse">
            <input type="checkbox" checked={reuseKey}
                   onChange={(event) => setReuseKey(event.target.checked)} />
            <span>Use the same key for both — they are the same provider</span>
          </label>
        )}

        <button className="mc-primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={14} className="mc-spin" /> : <KeyRound size={14} />}
          {configured ? 'Update keys' : 'Save keys'}
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
