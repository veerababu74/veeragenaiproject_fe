import { useState } from 'react'
import { Award, BookOpen, ChevronDown, Download, RotateCcw, Target, TrendingUp } from 'lucide-react'

/* The report.
 *
 * Every number on this screen was computed on the server from the stored
 * answers — never generated. The model wrote the prose around them. That split
 * is why the bars and the narrative can be trusted to agree: a model asked to
 * summarise twenty scores will state an average it never calculated.
 *
 * It can be downloaded because everything here is deleted after 48 hours, and
 * the point of a practice interview is what you do in the week afterwards.
 */

function asMarkdown(state) {
  const report = state.report
  const lines = [
    `# Interview report — ${state.session.role || 'Software Engineer'}`,
    `${state.session.created_at?.slice(0, 16)} · ${report.overall}/10 · ${report.band}`,
    '', report.summary, '',
    `Answered ${report.questions_answered} of ${report.questions_asked}. `
    + `${report.strong_answers} strong, ${report.weak_answers} weak, ${report.skipped} skipped.`,
    '', '## Scores by question type',
    ...report.by_type.map((row) => `- ${row.name}: ${row.average}/10 over ${row.answered}`),
    '', '## Scores by topic',
    ...report.by_topic.map((row) => `- ${row.name}: ${row.average}/10 over ${row.answered}`),
    '', '## What you did well', ...(report.strengths || []).map((item) => `- ${item}`),
    '', '## What to fix', ...(report.improvements || []).map((item) => `- ${item}`),
    '', '## Habits across the interview', ...(report.patterns || []).map((item) => `- ${item}`),
    '', '## Study plan',
    ...(report.study_plan || []).map((item, index) => `${index + 1}. **${item.focus}** — ${item.why}\n   Do: ${item.action}`),
    '', '## Every question',
    ...state.questions.filter((item) => item.answered).flatMap((item) => [
      '', `### Q${item.ordinal} · ${item.kind_label} · ${item.answer.score}/10`,
      item.text, '', `**You said:** ${item.answer.transcript || '(nothing)'}`,
      `**Verdict:** ${item.answer.verdict}`,
      ...(item.answer.gaps || []).map((gap) => `- Missing: ${gap}`),
      item.answer.ideal_answer ? `\n**A strong answer:** ${item.answer.ideal_answer}` : '',
    ]),
  ]
  return lines.join('\n')
}

function download(state) {
  const url = URL.createObjectURL(new Blob([asMarkdown(state)], { type: 'text/markdown' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `interview-${state.session.created_at?.slice(0, 10) || 'report'}.md`
  link.click()
  URL.revokeObjectURL(url)
}

function Bars({ title, rows }) {
  if (!rows?.length) return null
  return (
    <div className="ia-bars">
      <span className="ia-sublabel">{title}</span>
      {rows.map((row) => (
        <div className="ia-bar-row" key={row.name}>
          <span className="ia-bar-label">{row.name}</span>
          <div className="ia-bar">
            <span className={`ia-bar-fill band-${Math.min(4, Math.floor(row.average / 2.5))}`}
                  style={{ width: `${row.average * 10}%` }} />
          </div>
          <span className="ia-bar-value">{row.average} <em>({row.answered})</em></span>
        </div>))}
    </div>)
}

export default function Report({ state, onRestart }) {
  const [openQuestion, setOpenQuestion] = useState('')
  const report = state.report || {}
  if (!report.overall && !report.summary) {
    return <p className="ia-notice">This interview has not been finished yet. Finish it to get the report.</p>
  }

  return (
    <div className="ia-pane">
      <section className="ia-card ia-scorecard">
        <div className="ia-score-big">
          <strong>{report.overall}</strong><em>/10</em>
          <span className={`ia-band band-${report.band?.replace(/\s/g, '-')}`}>{report.band}</span>
        </div>
        <div className="ia-score-detail">
          <p className="ia-headline">{report.band_note}</p>
          <div className="ia-metrics">
            <span><strong>{report.questions_answered}</strong> answered</span>
            <span><strong>{report.strong_answers}</strong> strong (7+)</span>
            <span><strong>{report.weak_answers}</strong> weak (&lt;5)</span>
            <span><strong>{report.skipped}</strong> skipped</span>
            <span><strong>{report.average_words}</strong> words per answer</span>
          </div>
          <div className="ia-actions">
            <button className="ia-ghost ia-small" onClick={() => download(state)}>
              <Download size={12} /> Download this report
            </button>
            <span className="ia-muted">everything here is deleted after 48 hours</span>
          </div>
        </div>
      </section>

      {report.summary && <section className="ia-card"><p className="ia-summary">{report.summary}</p></section>}

      <section className="ia-card">
        <header className="ia-card-head"><h3><Target size={15} /> Where the marks went</h3></header>
        <Bars title="By question type" rows={report.by_type} />
        <Bars title="By topic" rows={report.by_topic} />
        <Bars title="By difficulty" rows={report.by_difficulty} />
        <p className="ia-muted">Lowest first. The number in brackets is how many questions that average is over —
          one question is a data point, not a verdict.</p>
      </section>

      <div className="ia-two-column">
        {report.strengths?.length > 0 && (
          <section className="ia-card">
            <header className="ia-card-head"><h3><Award size={15} /> What you did well</h3></header>
            <ul className="ia-list good">{report.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>)}
        {report.improvements?.length > 0 && (
          <section className="ia-card">
            <header className="ia-card-head"><h3><TrendingUp size={15} /> What to fix</h3></header>
            <ul className="ia-list">{report.improvements.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>)}
      </div>

      {report.patterns?.length > 0 && (
        <section className="ia-card">
          <header className="ia-card-head">
            <h3>Habits across the whole interview</h3>
            <span className="ia-muted">the part worth the most</span>
          </header>
          <ul className="ia-list">{report.patterns.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>)}

      {report.study_plan?.length > 0 && (
        <section className="ia-card">
          <header className="ia-card-head"><h3><BookOpen size={15} /> Study plan, in order</h3></header>
          <ol className="ia-plan">
            {report.study_plan.map((item, index) => (
              <li key={item.focus || index}>
                <strong>{item.focus}</strong>
                <span className="ia-muted">{item.why}</span>
                <span className="ia-action">{item.action}</span>
              </li>))}
          </ol>
        </section>)}

      <section className="ia-card">
        <header className="ia-card-head"><h3>Every question, and what you said</h3></header>
        <ul className="ia-review">
          {state.questions.filter((item) => item.answered).map((item) => (
            <li key={item.id} className={openQuestion === item.id ? 'open' : ''}>
              <button onClick={() => setOpenQuestion(openQuestion === item.id ? '' : item.id)}>
                <span className={`ia-review-score s${Math.round(item.answer.score / 2)}`}>{item.answer.score}</span>
                <span className="ia-review-text">{item.text}</span>
                <span className="ia-tag ghost">{item.kind_label}</span>
                <ChevronDown size={14} />
              </button>
              {openQuestion === item.id && (
                <div className="ia-review-body">
                  {item.rationale && <p className="ia-muted">Why you were asked: {item.rationale}</p>}
                  <span className="ia-sublabel">You said</span>
                  <p className="ia-said">{item.answer.transcript || '(nothing)'}</p>
                  <span className="ia-sublabel">Verdict</span>
                  <p>{item.answer.verdict}</p>
                  {item.answer.gaps?.length > 0 && (
                    <ul className="ia-gaps">{item.answer.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>)}
                  {item.answer.ideal_answer && (
                    <>
                      <span className="ia-sublabel">A strong answer</span>
                      <p>{item.answer.ideal_answer}</p>
                    </>)}
                  {item.expected_points?.length > 0 && (
                    <>
                      <span className="ia-sublabel">What it was marked against</span>
                      <ul>{item.expected_points.map((point) => <li key={point}>{point}</li>)}</ul>
                    </>)}
                </div>)}
            </li>))}
        </ul>
      </section>

      {report.next_session && (
        <section className="ia-card ia-next">
          <header className="ia-card-head"><h3><RotateCcw size={15} /> For your next run</h3></header>
          <p>{report.next_session}</p>
          <div className="ia-actions">
            <button className="ia-primary" onClick={onRestart}>Plan another interview</button>
          </div>
        </section>)}
    </div>
  )
}
