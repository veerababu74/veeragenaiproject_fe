import { useCallback, useEffect, useState } from 'react'
import {
  Activity, ArrowLeft, BookOpen, FlaskConical, KeyRound, Loader2,
  MessageSquare, Megaphone, ShieldCheck,
} from 'lucide-react'
import { marketingApi } from './api'
import Ask from './Ask'
import Compliance from './Compliance'
import Corpus from './Corpus'
import Evaluate from './Evaluate'
import HowItWorks from './HowItWorks'
import Setup from './Setup'
import './MarketingCopilot.css'
import Monitor from './Monitor'

/* Marketing Copilot.
 *
 * The tab order is the order someone should meet the project: set up a key, ask
 * it something, look at what it searched, then the two things that make it a
 * system rather than a demo — how it is evaluated, and how it is watched.
 */

const TABS = [
  { id: 'setup', label: 'Setup', icon: KeyRound },
  { id: 'ask', label: 'Ask', icon: MessageSquare },
  { id: 'corpus', label: 'Corpus', icon: BookOpen },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'evaluate', label: 'Evaluate', icon: FlaskConical },
  { id: 'monitor', label: 'Monitor', icon: Activity },
  { id: 'how', label: 'How it works', icon: Megaphone },
]

export default function MarketingCopilot({ onBack }) {
  const [tab, setTab] = useState('setup')
  const [overview, setOverview] = useState(null)
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [overviewData, setupData] = await Promise.all([
        marketingApi('/overview'), marketingApi('/setup'),
      ])
      setOverview(overviewData)
      setConfigured(setupData.configured && overviewData.corpus.chunks_indexed > 0)
      // Land people on Ask once the workspace is usable; Setup is a chore, not
      // a destination.
      if (setupData.configured && overviewData.corpus.chunks_indexed > 0) {
        setTab((current) => (current === 'setup' ? 'ask' : current))
      }
    } catch (requestError) {
      setError(requestError.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const needSetup = () => setTab('setup')

  return (
    <section className="mc-app">
      <header className="mc-header">
        <button className="mc-back" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <div className="mc-brand">
          <span className="mc-brand-icon"><Megaphone size={17} /></span>
          <div>
            <span>RAG + AGENT, END TO END</span>
            <h1>Marketing Copilot</h1>
          </div>
        </div>
        <div className="mc-header-meta">
          {overview && (
            <>
              <span className="mc-pill">
                {overview.corpus.documents} docs · {overview.corpus.campaigns} campaign rows
              </span>
              <span className="mc-pill ghost">
                {overview.corpus.chunks_indexed > 0
                  ? `${overview.corpus.chunks_indexed} chunks · ${overview.corpus.retriever}`
                  : 'not indexed yet'}
              </span>
            </>
          )}
        </div>
      </header>

      <nav className="mc-tabs">
        {TABS.map((item) => (
          <button key={item.id} className={tab === item.id ? 'active' : ''}
                  onClick={() => setTab(item.id)}>
            <item.icon size={14} /> {item.label}
          </button>
        ))}
      </nav>

      {!configured && !loading && tab !== 'setup' && (
        <p className="mc-banner">
          Add your model key and build the index in <button onClick={needSetup}>Setup</button> to
          ask anything. The corpus, the rules and the explanation are readable without it.
        </p>
      )}

      {error && <p className="mc-error">{error}</p>}

      <div className="mc-body">
        {loading && <div className="mc-loading"><Loader2 size={20} className="mc-spin" /> Loading…</div>}
        {!loading && tab === 'setup' && <Setup overview={overview} onConfigured={refresh} />}
        {!loading && tab === 'ask' && <Ask configured={configured} onNeedSetup={needSetup} />}
        {!loading && tab === 'corpus' && <Corpus />}
        {!loading && tab === 'compliance' && <Compliance />}
        {!loading && tab === 'evaluate' && <Evaluate configured={configured} onNeedSetup={needSetup} />}
        {!loading && tab === 'monitor' && <Monitor />}
        {!loading && tab === 'how' && <HowItWorks overview={overview} />}
      </div>

      <footer className="mc-footer">
        Runs on your own model key. The demo corpus is fictional — a B2B compliance-software
        company selling into financial services, chosen because a regulated vertical makes the
        claim-checking step real rather than decorative.
      </footer>
    </section>
  )
}
