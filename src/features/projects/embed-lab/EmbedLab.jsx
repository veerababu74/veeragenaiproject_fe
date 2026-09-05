import { useEffect, useMemo, useState } from 'react'
import { Boxes, KeyRound, Loader2, Play, Ruler, TriangleAlert } from 'lucide-react'
import { createLabsApi } from '../../../lib/labsApi'
import LabShell from '../lab-shell/LabShell'
import './EmbedLab.css'

const api = createLabsApi('embedlab').request

const blankModel = () => ({ provider: 'openai', model: 'text-embedding-3-small', api_key: '' })

export default function EmbedLab({ onBack }) {
  const [catalog, setCatalog] = useState(null)
  const [corpora, setCorpora] = useState([])
  const [corpusId, setCorpusId] = useState('support')
  const [queryIndex, setQueryIndex] = useState(0)
  const [models, setModels] = useState([blankModel()])
  const [metric, setMetric] = useState('cosine')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api('/providers'), api('/corpora')])
      .then(([providerData, corpusData]) => {
        setCatalog(providerData)
        setCorpora(corpusData.corpora)
      })
      .catch((requestError) => setError(requestError.message))
  }, [])

  const corpus = corpora.find((item) => item.id === corpusId)
  const query = corpus?.queries[Math.min(queryIndex, corpus.queries.length - 1)]

  const run = async () => {
    if (!corpus || !query) return
    if (models.some((model) => !model.api_key.trim())) {
      setError('Every selected model needs an API key. Keys are used for this request only.')
      return
    }
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await api('/compare', {
        method: 'POST',
        body: JSON.stringify({
          query: query.text, corpus_id: corpus.id, models, top_k: 3,
        }),
      }))
    } catch (requestError) {
      setError(requestError.message)
    }
    setBusy(false)
  }

  const setModel = (index, patch) => {
    setModels((current) => current.map((model, position) =>
      position === index ? { ...model, ...patch } : model))
  }

  const modelsForProvider = (provider) =>
    catalog?.providers.find((item) => item.provider === provider)?.models || []

  // Chunks ordered by the first model's ranking, so the table reads top-down.
  const orderedChunks = useMemo(() => {
    if (!result) return []
    const ranks = result.models[0].metrics[metric].ranks
    return [...result.chunks].sort((a, b) => ranks[a.id] - ranks[b.id])
  }, [result, metric])

  return (
    <LabShell
      onBack={onBack}
      eyebrow="WHY RETRIEVAL MISSES"
      title="Embedding Lab"
      icon={Boxes}
      meta={[
        { label: 'your keys, this request only' },
        { label: 'exact search, no vector DB', ghost: true },
      ]}
      footer="Embeddings are computed with your own provider keys, used for the request and never stored."
    >
      {error && <p className="lab-error">{error}</p>}

      <div className="lab-card">
        <div className="lab-card-head">
          <h3><Play size={15} /> Set up a comparison</h3>
          <span className="lab-muted">up to {catalog?.limits.max_models || 3} models</span>
        </div>

        <div className="lab-field-grid">
          <label className="lab-field">
            <span>Corpus</span>
            <select value={corpusId}
                    onChange={(event) => { setCorpusId(event.target.value); setQueryIndex(0); setResult(null) }}>
              {corpora.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            {corpus && <small>{corpus.blurb}</small>}
          </label>

          <label className="lab-field">
            <span>Query</span>
            <select value={queryIndex}
                    onChange={(event) => { setQueryIndex(Number(event.target.value)); setResult(null) }}>
              {(corpus?.queries || []).map((item, index) => (
                <option key={index} value={index}>{item.text}</option>
              ))}
            </select>
            <small>{corpus?.chunks.length} chunks · {query?.relevant_ids.length} known answer(s)</small>
          </label>
        </div>

        {query && (
          <p className="el-whyhard"><TriangleAlert size={13} /> {query.why_hard}</p>
        )}

        <h5 className="lab-subhead">Models to compare</h5>
        {models.map((model, index) => (
          <div className="el-model-row" key={index}>
            <select value={model.provider}
                    onChange={(event) => {
                      const provider = event.target.value
                      setModel(index, { provider, model: modelsForProvider(provider)[0]?.id || '' })
                    }}>
              {(catalog?.providers || []).map((item) => (
                <option key={item.provider} value={item.provider}>{item.label}</option>
              ))}
            </select>
            <select value={model.model} onChange={(event) => setModel(index, { model: event.target.value })}>
              {modelsForProvider(model.provider).map((item) => (
                <option key={item.id} value={item.id}>{item.id} · {item.dims}d</option>
              ))}
            </select>
            <input type="password" placeholder="API key" autoComplete="off" value={model.api_key}
                   onChange={(event) => setModel(index, { api_key: event.target.value })} />
            {models.length > 1 && (
              <button className="lab-ghost"
                      onClick={() => setModels(models.filter((_, position) => position !== index))}>
                remove
              </button>
            )}
          </div>
        ))}

        <div className="el-actions">
          {models.length < (catalog?.limits.max_models || 3) && (
            <button className="lab-secondary" onClick={() => setModels([...models, blankModel()])}>
              Add a model
            </button>
          )}
          <button className="lab-primary" onClick={run} disabled={busy}>
            {busy ? <Loader2 size={14} className="lab-spin" /> : <Play size={14} />}
            {busy ? 'Embedding…' : 'Compare'}
          </button>
        </div>
        <p className="lab-note">
          <KeyRound size={11} /> Keys travel with this request and are not stored. Comparing two
          models on a nine-chunk corpus costs a fraction of a cent.
        </p>
      </div>

      {result && (
        <>
          {result.failures.length > 0 && (
            <div className="lab-card">
              {result.failures.map((failure, index) => (
                <p className="lab-error" key={index}>{failure.label}: {failure.error}</p>
              ))}
            </div>
          )}

          <div className="lab-card">
            <div className="lab-card-head">
              <h3>Ranking by {metric}</h3>
              <div className="el-metric-switch">
                {['cosine', 'dot', 'euclidean'].map((name) => (
                  <button key={name} className={metric === name ? 'active' : ''}
                          onClick={() => setMetric(name)}>{name}</button>
                ))}
              </div>
            </div>

            {result.comparison.comparable && (
              <p className={`el-verdict ${result.comparison.unanimous_top1 ? 'agree' : 'disagree'}`}>
                {result.comparison.unanimous_top1
                  ? 'All models chose the same top chunk.'
                  : `The models disagree about the best chunk — ${result.comparison.top1_by_model
                      .map((item) => `${item.label} picked #${item.chunk_id}`).join(', ')}. At most one can be right.`}
              </p>
            )}

            <div className="el-table-scroll">
              <table className="lab-table el-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Chunk</th>
                    {result.models.map((model) => <th key={model.label}>{model.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {orderedChunks.map((chunk) => {
                    const isAnswer = result.relevant_ids.includes(chunk.id)
                    return (
                      <tr key={chunk.id} className={isAnswer ? 'highlight' : ''}>
                        <td>{chunk.id}{isAnswer && <span className="el-answer">answer</span>}</td>
                        <td className="el-chunk">{chunk.text}</td>
                        {result.models.map((model) => {
                          const rank = model.metrics[metric].ranks[chunk.id]
                          const score = model.metrics[metric].scores[chunk.id]
                          return (
                            <td key={model.label}>
                              <span className={`el-rank ${rank === 1 ? 'top' : ''}`}>#{rank}</span>
                              <em>{score.toFixed(3)}</em>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="el-model-cards">
            {result.models.map((model) => (
              <article className="lab-card" key={model.label}>
                <div className="lab-card-head">
                  <h3>{model.label}</h3>
                  <span className="lab-muted">{model.latency_ms} ms</span>
                </div>
                {model.evaluation.top1_correct !== undefined && (
                  <p>
                    <span className={`lab-tag ${model.evaluation.top1_correct ? 'good' : 'bad'}`}>
                      {model.evaluation.top1_correct ? 'top-1 correct' : 'top-1 wrong'}
                    </span>{' '}
                    <span className={`lab-tag ${model.evaluation.hit_at_k ? 'good' : 'bad'}`}>
                      {model.evaluation.hit_at_k ? `found in top ${result.top_k}` : `missed in top ${result.top_k}`}
                    </span>
                  </p>
                )}
                <dl className="el-stats">
                  <div><dt>dimensions</dt><dd>{model.vectors.dims}</dd></div>
                  <div><dt>normalised</dt><dd>{model.vectors.normalised ? 'yes' : 'no'}</dd></div>
                  <div><dt>norm spread</dt><dd>{model.vectors.norm_spread}</dd></div>
                  <div><dt>answer at rank</dt><dd>{model.evaluation.best_relevant_rank || '—'}</dd></div>
                </dl>
                <p className="lab-note">
                  <Ruler size={11} />{' '}
                  {model.vectors.normalised
                    ? 'Vectors are unit length, so cosine, dot and euclidean must rank identically.'
                    : `Vector lengths vary by ${model.vectors.norm_spread}, which is why the metrics can disagree here.`}
                </p>
                {model.metric_disagreement.length > 0 && (
                  <p className="lab-note el-disagree">
                    {model.metric_disagreement.length} chunk(s) change rank depending on the metric.
                  </p>
                )}
                {!model.task_aware && (
                  <p className="lab-muted">
                    This provider encodes queries and documents identically. Gemini does not, and
                    uses a different code path for each.
                  </p>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </LabShell>
  )
}
