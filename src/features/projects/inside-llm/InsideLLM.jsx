import { useCallback, useEffect } from 'react'
import { ArrowLeft, Boxes, Brain, GitCompare, Grid3x3, Layers, Loader2 } from 'lucide-react'
import { insideLlmApi } from '../../../lib/insideLlmApi'
import Architecture from './Architecture'
import AttentionExplorer from './AttentionExplorer'
import ModelComparison from './ModelComparison'
import Walkthrough from './Walkthrough'
import { useInsideLLMStore } from './store'
import './InsideLLM.css'

const VIEWS = [
  { id: 'walkthrough', label: 'Components', icon: Layers },
  { id: 'attention', label: 'Attention', icon: Grid3x3 },
  { id: 'architecture', label: 'Architecture', icon: Boxes },
  { id: 'models', label: 'Three models', icon: GitCompare },
]

export default function InsideLLM({ onBack }) {
  const {
    view, setView, overview, examplesIndex, exampleId, setExampleId,
    example, setExample, setStatic, loading, setLoading, error, setError,
  } = useInsideLLMStore()

  useEffect(() => {
    Promise.all([
      insideLlmApi('/overview'),
      insideLlmApi('/components'),
      insideLlmApi('/models'),
      insideLlmApi('/examples'),
      insideLlmApi('/positional'),
    ])
      .then(([overviewData, componentData, modelData, indexData, positionalData]) => {
        setStatic({
          overview: overviewData,
          components: componentData.components,
          models: modelData,
          examplesIndex: indexData.examples,
          positional: positionalData,
        })
      })
      .catch((requestError) => setError(requestError.message))
  }, [setStatic, setError])

  const loadExample = useCallback((id) => {
    setLoading(true)
    insideLlmApi(`/examples/${id}`)
      .then(setExample)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [setExample, setError, setLoading])

  useEffect(() => { loadExample(exampleId) }, [exampleId, loadExample])

  const active = examplesIndex.find((item) => item.id === exampleId)

  return (
    <section className="inside-llm-app">
      <header className="ill-header">
        <button className="ill-back" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <div className="ill-brand">
          <span className="ill-brand-icon"><Brain size={17} /></span>
          <div>
            <span>WHAT HAPPENS INSIDE</span>
            <h1>Inside an LLM</h1>
          </div>
        </div>
        <div className="ill-header-meta">
          <span className="ill-pill">GPT-2 small · 124M</span>
          <span className="ill-pill ghost">12 layers · 12 heads · 768 dims</span>
        </div>
      </header>

      <div className="ill-examplebar">
        <label htmlFor="ill-example">Example</label>
        <select id="ill-example" value={exampleId}
                onChange={(event) => setExampleId(event.target.value)}>
          {examplesIndex.map((item) => (
            <option key={item.id} value={item.id}>{item.title} — “{item.text}”</option>
          ))}
        </select>
        {active && (
          <span className="ill-examplebar-meta">
            {active.tokens} tokens → predicts{' '}
            <code>{active.top_prediction.token.replaceAll(' ', '␣')}</code>{' '}
            at {(active.top_prediction.probability * 100).toFixed(1)}%
          </span>
        )}
      </div>

      <nav className="ill-tabs">
        {VIEWS.map((item) => (
          <button key={item.id} className={view === item.id ? 'active' : ''}
                  onClick={() => setView(item.id)}>
            <item.icon size={14} /> {item.label}
          </button>
        ))}
      </nav>

      {error && <p className="ill-error">{error}</p>}

      <div className="ill-body">
        {loading && !example && (
          <div className="ill-loading"><Loader2 size={22} className="ill-spin" /> Loading the forward pass…</div>
        )}
        {view === 'walkthrough' && <Walkthrough onOpenExplorer={() => setView('attention')} />}
        {view === 'attention' && <AttentionExplorer />}
        {view === 'architecture' && <Architecture />}
        {view === 'models' && <ModelComparison />}
      </div>

      <footer className="ill-footer">
        {overview?.method || 'Real GPT-2 weights, computed ahead of time and served as static data.'}
      </footer>
    </section>
  )
}
