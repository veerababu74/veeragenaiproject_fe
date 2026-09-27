import { ExternalLink, Info, Lightbulb, Mic, ShieldCheck } from 'lucide-react'

/* What this is and how to set it up, readable before a single key exists.
 *
 * Deliberately the first tab. Someone deciding whether this project is worth
 * three API keys should be able to find out what it does, what it will cost and
 * where the keys come from without configuring anything first.
 */

export default function Guide({ guide, onSetup }) {
  const { overview, stages, sources, microphone, privacy, tips, providers } = guide

  return (
    <div className="ia-pane">
      <section className="ia-card ia-intro">
        <h3>{overview.title}</h3>
        <p className="ia-headline">{overview.tagline}</p>
        <p>{overview.summary}</p>
        <ul className="ia-list good">
          {overview.why_it_is_different.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <div className="ia-actions">
          <button className="ia-primary" onClick={onSetup}>Set up your keys →</button>
        </div>
      </section>

      <section className="ia-card">
        <header className="ia-card-head"><h3>How a session runs</h3></header>
        <ol className="ia-stages">
          {stages.map((stage) => (
            <li key={stage.step}>
              <span className="ia-stage-number">{stage.step}</span>
              <div><strong>{stage.title}</strong><p>{stage.detail}</p></div>
            </li>))}
        </ol>
      </section>

      <section className="ia-card">
        <header className="ia-card-head">
          <h3>Where every key comes from</h3>
          <span className="ia-muted">links go straight to the right page</span>
        </header>
        <p className="ia-note">{providers.note}</p>
        {[['Thinking', providers.chat], ['Hearing', providers.stt], ['Speaking', providers.tts]].map(([job, list]) => (
          <div className="ia-key-group" key={job}>
            <span className="ia-sublabel">{job}</span>
            <div className="ia-key-cards">
              {list.map((item) => (
                <div className={`ia-key-card ${item.keyless ? 'free' : ''}`} key={`${job}-${item.provider}`}>
                  <strong>{item.label}{item.keyless && <em> · no key</em>}</strong>
                  <p>{item.note}</p>
                  {item.console_url && (
                    <a href={item.console_url} target="_blank" rel="noreferrer">
                      Get a key <ExternalLink size={11} />
                    </a>)}
                </div>))}
            </div>
          </div>))}
      </section>

      <section className="ia-card">
        <header className="ia-card-head"><h3><Info size={15} /> The three sources</h3></header>
        <div className="ia-source-help">
          {sources.map((item) => (
            <div key={item.source}>
              <strong>{item.source}</strong>
              <p>{item.how}</p>
              <p className="ia-muted">{item.caveat}</p>
              <p className="ia-weight">{item.weight}</p>
            </div>))}
        </div>
      </section>

      <div className="ia-two-column">
        <section className="ia-card">
          <header className="ia-card-head"><h3><Mic size={15} /> Microphone and browsers</h3></header>
          <ul className="ia-list">{microphone.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="ia-card">
          <header className="ia-card-head"><h3><ShieldCheck size={15} /> What is stored</h3></header>
          <ul className="ia-list">{privacy.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </div>

      <section className="ia-card">
        <header className="ia-card-head"><h3><Lightbulb size={15} /> How to score well</h3></header>
        <ul className="ia-list good">{tips.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
    </div>
  )
}
