import { useEffect, useMemo, useState } from 'react'
import { Boxes, ChevronDown, KeyRound, Loader2, Play, Ruler, Sigma, TriangleAlert } from 'lucide-react'
import { createLabsApi } from '../../../lib/labsApi'
import LabShell from '../lab-shell/LabShell'
import { Derivation, Equation, Substitution, SymbolTable, fixed } from '../lab-shell/math'
import './EmbedLab.css'

const api = createLabsApi('embedlab').request

const blankModel = () => ({ provider: 'openai', model: 'text-embedding-3-small', api_key: '' })

/* Why the three metrics are one computation.
 *
 * A ranking table shows three columns of scores and invites the reading that
 * three different things were measured. They were not: one dot product and two
 * lengths generate all three, and writing them out that way is the whole
 * explanation of why they agree exactly on normalised vectors and can disagree
 * otherwise. */
function MetricMath({ model, chunk, chunkIndex, concepts }) {
  const terms = model.metrics.terms
  if (!terms || chunkIndex === undefined) return null

  const dotProduct = terms.dot[chunkIndex]
  const queryNorm = terms.query_norm
  const chunkNorm = terms.chunk_norms[chunkIndex]
  const euclidean = -Math.sqrt(Math.max(0, queryNorm ** 2 + chunkNorm ** 2 - 2 * dotProduct))

  return (
    <div className="lab-card">
      <div className="lab-card-head">
        <h3><Sigma size={15} /> How the three scores are computed</h3>
        <span className="lab-muted">{model.label} · chunk #{chunk.id}</span>
      </div>

      {concepts?.shared_terms && (
        <Equation label={concepts.shared_terms.claim} note={concepts.shared_terms.consequence}>
          {concepts.shared_terms.formula}
        </Equation>
      )}
      <SymbolTable symbols={concepts?.metrics?.[0]?.symbols} />

      <Substitution
        title={`The arithmetic for chunk #${chunk.id}`}
        rows={[
          { label: 'dot', expression: `q · c over ${model.vectors.dims} dimensions`,
            result: fixed(dotProduct, 4) },
          { label: 'lengths', expression: `‖q‖ = ${fixed(queryNorm, 4)},  ‖c‖ = ${fixed(chunkNorm, 4)}` },
          { label: 'cosine', expression: `${fixed(dotProduct, 4)} / (${fixed(queryNorm, 4)} × ${fixed(chunkNorm, 4)})`,
            result: fixed(model.metrics.cosine.scores[chunkIndex], 4) },
          { label: 'dot', expression: 'the same product, undivided',
            result: fixed(model.metrics.dot.scores[chunkIndex], 4) },
          { label: 'euclidean',
            expression: `− √(${fixed(queryNorm ** 2, 3)} + ${fixed(chunkNorm ** 2, 3)} − 2 × ${fixed(dotProduct, 3)})`,
            result: fixed(euclidean, 4),
            note: `the payload records ${fixed(model.metrics.euclidean.scores[chunkIndex], 4)}` },
        ]}
        footnote={model.vectors.normalised
          ? `This model returns unit-length vectors (‖c‖ varies by only ${model.vectors.norm_spread}),
             so ‖q‖ ‖c‖ ≈ 1 and the cosine and the dot product are the same number. Euclidean then
             reduces to √(2 − 2 cos), which is monotonic in the cosine — so all three orderings are
             forced to be identical. Switching metrics above cannot change this model's ranking.`
          : `This model's vector lengths vary by ${model.vectors.norm_spread}, so ‖q‖ ‖c‖ is not 1
             and the division actually changes something. That is the entire reason the three
             columns can rank the same chunks differently.`}
      />
    </div>
  )
}

/* What every number in the results table means, and how it is computed.
 *
 * The evaluation column is the reason this exists. "reciprocal rank 0.33" is
 * meaningless until you know it is one divided by the rank of the first correct
 * answer — and the lab was printing it bare. */
function Reference({ concepts }) {
  const [open, setOpen] = useState('')

  const sections = [
    { id: 'metrics', title: 'How chunks are scored', items: concepts.metrics },
    { id: 'evaluation', title: 'How a run is judged', items: concepts.evaluation },
  ]

  return (
    <div className="lab-card el-reference">
      <div className="lab-card-head">
        <h3><Sigma size={15} /> The mathematics</h3>
        <span className="lab-muted">every number in the table below, defined</span>
      </div>

      {sections.map((section) => (
        <div key={section.id}>
          <h5 className="lab-subhead">{section.title}</h5>
          {section.items.map((item) => {
            const isOpen = open === item.id
            return (
              <article className={`el-concept ${isOpen ? 'open' : ''}`} key={item.id}>
                <button onClick={() => setOpen(isOpen ? '' : item.id)}>
                  <div>
                    <h4>{item.name}</h4>
                    {item.tagline && <p>{item.tagline}</p>}
                  </div>
                  <code>{item.formula}</code>
                  <ChevronDown size={15} className="el-chevron" />
                </button>
                {isOpen && (
                  <div className="el-concept-body">
                    {item.summary && <p>{item.summary}</p>}
                    <SymbolTable symbols={item.symbols} />
                    <Derivation steps={item.derivation} />
                    {item.range && <p className="lab-note"><strong>Range:</strong> {item.range}</p>}
                    <p className="lab-note"><strong>Why:</strong> {item.why}</p>
                    {item.misconception && (
                      <p className="el-misconception">
                        <TriangleAlert size={13} /> {item.misconception}
                      </p>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      ))}

      <h5 className="lab-subhead">Whether a model normalises</h5>
      <code className="el-formula">{concepts.vector_stats.formula}</code>
      <p className="lab-note">{concepts.vector_stats.why}</p>
      <p className="lab-note lab-muted">{concepts.vector_stats.note}</p>
    </div>
  )
}

export default function EmbedLab({ onBack }) {
  const [catalog, setCatalog] = useState(null)
  const [concepts, setConcepts] = useState(null)
  const [corpora, setCorpora] = useState([])
  const [corpusId, setCorpusId] = useState('support')
  const [queryIndex, setQueryIndex] = useState(0)
  const [models, setModels] = useState([blankModel()])
  const [metric, setMetric] = useState('cosine')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api('/providers'), api('/corpora'), api('/concepts')])
      .then(([providerData, corpusData, conceptData]) => {
        setCatalog(providerData)
        setCorpora(corpusData.corpora)
        setConcepts(conceptData)
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

      {concepts && <Reference concepts={concepts} />}

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

          {result.models[0] && orderedChunks[0] && (
            <MetricMath model={result.models[0]} chunk={orderedChunks[0]}
                        chunkIndex={orderedChunks[0].id} concepts={concepts} />
          )}

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
