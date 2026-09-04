import { useInsideLLMStore } from './store'

export default function ModelComparison() {
  const { models } = useInsideLLMStore()
  if (!models) return null

  return (
    <div className="ill-models">
      <header className="ill-arch-head">
        <h3>Three models, one skeleton</h3>
        <p>
          These three span most of what production language models do, and the differences between
          them are smaller than they look. Attention, residual connections and the feed-forward
          sandwich are the same in all three; what changes is how position is encoded, where
          normalisation happens, which activation is used, and whether the model is allowed to look
          forward.
        </p>
      </header>

      <div className="ill-model-cards">
        {models.models.map((model) => (
          <article className="ill-model-card" key={model.id}>
            <div className="ill-model-top">
              <div>
                <h4>{model.name}</h4>
                <span className="ill-model-family">{model.family} · {model.year}</span>
              </div>
              <span className="ill-model-params">{model.parameters}</span>
            </div>
            <p className="ill-model-tagline">{model.tagline}</p>

            <dl className="ill-spec">
              {Object.entries(model.spec).map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replace(/_/g, ' ')}</dt>
                  <dd>{typeof value === 'number' ? value.toLocaleString() : value}</dd>
                </div>
              ))}
            </dl>

            <h5 className="ill-subhead-plain">Design choices</h5>
            <ul className="ill-choices">
              {Object.entries(model.choices).map(([key, value]) => (
                <li key={key}><strong>{key}</strong><span>{value}</span></li>
              ))}
            </ul>

            <p className="ill-model-trained"><strong>Trained for:</strong> {model.trained_for}</p>
            <p className="ill-model-why">{model.why_it_matters}</p>
          </article>
        ))}
      </div>

      <h4 className="ill-compare-title">Side by side</h4>
      <div className="ill-compare-scroll">
        <table className="ill-compare">
          <thead>
            <tr>
              <th>Aspect</th><th>GPT-2</th><th>BERT</th><th>LLaMA</th><th>Why it matters</th>
            </tr>
          </thead>
          <tbody>
            {models.comparison.map((row) => (
              <tr key={row.aspect}>
                <th scope="row">{row.aspect}</th>
                <td>{row.gpt2}</td>
                <td>{row.bert}</td>
                <td>{row.llama}</td>
                <td className="ill-compare-note">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
