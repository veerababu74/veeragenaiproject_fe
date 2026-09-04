import { useEffect, useRef } from 'react'
import {
  AlertTriangle, Brain, ChevronRight, CircleDashed, Clock, FileText,
  MessageCircleQuestion, Settings2, Zap,
} from 'lucide-react'

const formatMs = (ms) => (!ms ? '' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)

/** Steps arrive flat. The timeline reads as rounds, so regroup them: round 0 is
 *  the setup (what the model was given and asked), and every round after that is
 *  one pass of the think-act loop. */
function groupByRound(steps) {
  const setup = steps.filter((step) => step.round === 0)
  const rounds = new Map()
  for (const step of steps) {
    if (step.round === 0 || step.step_type === 'answer' || step.step_type === 'error') continue
    if (!rounds.has(step.round)) rounds.set(step.round, [])
    rounds.get(step.round).push(step)
  }
  const closing = steps.filter((step) => step.step_type === 'answer' || step.step_type === 'error')
  return { setup, rounds: [...rounds.entries()].sort((a, b) => a[0] - b[0]), closing }
}

function prettyArguments(value) {
  if (!value || typeof value !== 'object') return ''
  const entries = Object.entries(value).filter(([, item]) => item !== null && item !== '')
  if (!entries.length) return 'no arguments'
  return entries.map(([key, item]) =>
    `${key}: ${typeof item === 'object' ? JSON.stringify(item) : String(item)}`).join('  ·  ')
}

function ContextCard({ step }) {
  const tools = step.data?.tools || []
  const agent = step.data?.agent || {}
  return (
    <details className="sa-trace-context" open={false}>
      <summary>
        <Settings2 size={13} />
        <span>What the model was given</span>
        <small>{agent.provider}/{agent.model} · {tools.length} tool{tools.length === 1 ? '' : 's'}</small>
        <ChevronRight size={14} className="sa-chevron" />
      </summary>
      <div className="sa-context-body">
        <h5>System message</h5>
        <pre>{step.content}</pre>
        <h5>Tools offered to the model</h5>
        {tools.length === 0 && <p className="sa-muted">No tools were attached, so the model could only answer from memory.</p>}
        <ul className="sa-context-tools">
          {tools.map((tool) => (
            <li key={tool.name}>
              <code>{tool.name}</code>
              <span>{tool.description}</span>
              {tool.arguments?.length > 0 && (
                <small>takes {tool.arguments.map((argument) => `${argument.name} (${argument.type})`).join(', ')}</small>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}

function ToolCard({ call, result }) {
  const failed = result?.step_type === 'tool_error'
  return (
    <div className={`sa-tool-card ${failed ? 'failed' : ''} ${result ? 'settled' : 'pending'}`}>
      <div className="sa-tool-head">
        <span className="sa-tool-order">{call.tool_order}</span>
        <code>{call.tool_name}</code>
        {result
          ? result.duration_ms > 0 &&
              <span className="sa-tool-time"><Clock size={11} /> {formatMs(result.duration_ms)}</span>
          : <span className="sa-tool-time running"><CircleDashed size={11} className="sa-spin" /> running</span>}
      </div>
      <p className="sa-tool-args">{prettyArguments(call.data?.arguments)}</p>
      {result && (
        <div className={`sa-tool-result ${failed ? 'failed' : ''}`}>
          {failed && <AlertTriangle size={12} />}
          <pre>{result.content}</pre>
        </div>
      )}
    </div>
  )
}

function RoundBlock({ round, steps }) {
  const think = steps.find((step) => step.step_type === 'think')
  const calls = steps.filter((step) => step.step_type === 'tool_call')
  const results = steps.filter((step) => ['tool_result', 'tool_error'].includes(step.step_type))
  const chose = think?.data?.chose || []

  return (
    <section className="sa-round">
      <header className="sa-round-head">
        <span className="sa-round-badge">Round {round}</span>
        <span className="sa-round-note">
          {calls.length === 0 ? 'deciding' :
            calls.length === 1 ? 'called 1 tool' : `called ${calls.length} tools together`}
        </span>
      </header>

      {think && (
        <div className="sa-think">
          <div className="sa-think-head"><Brain size={13} /> <span>Reasoning</span>
            {think.duration_ms > 0 && <small>{formatMs(think.duration_ms)}</small>}
          </div>
          {think.content
            ? <p>{think.content}</p>
            : <p className="sa-muted">The model gave no commentary — it went straight to the tool call.</p>}
          {chose.length > 0 && (
            <p className="sa-chose">Chose {chose.map((name) => <code key={name}>{name}</code>)}</p>
          )}
        </div>
      )}

      <div className="sa-tool-list">
        {calls.map((call) => (
          <ToolCard
            key={call.seq}
            call={call}
            result={results.find((item) => item.tool_order === call.tool_order)}
          />
        ))}
      </div>
    </section>
  )
}

export default function TraceTimeline({ steps, isRunning, result }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    // Follow the run only while it is happening. Replaying a finished run from
    // History should open at the beginning, which is where its story starts.
    if (isRunning && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [steps.length, isRunning])

  if (!steps.length) {
    return (
      <div className="sa-trace-empty">
        <FileText size={26} />
        <h4>Nothing running yet</h4>
        <p>Ask the agent a question and every decision it makes will appear here — what it was told,
          what it reasoned, which tool it picked, what came back, and in what order.</p>
      </div>
    )
  }

  const { setup, rounds, closing } = groupByRound(steps)
  const context = setup.find((step) => step.step_type === 'context')
  const question = setup.find((step) => step.step_type === 'question')
  const answer = closing.find((step) => step.step_type === 'answer')
  const failure = closing.find((step) => step.step_type === 'error')
  const toolCount = steps.filter((step) => step.step_type === 'tool_call').length
  // The highest round reached, not the number of rounds that used a tool: the
  // final round is the one that produced the answer, and dropping it here made
  // this disagree with the run summary shown above the timeline.
  const roundCount = Math.max(0, ...steps.map((step) => step.round))

  return (
    <div className="sa-trace" ref={scrollRef}>
      {context && <ContextCard step={context} />}

      {question && (
        <div className="sa-trace-question">
          <MessageCircleQuestion size={14} />
          <p>{question.content}</p>
        </div>
      )}

      {rounds.map(([round, roundSteps]) => (
        <RoundBlock key={round} round={round} steps={roundSteps} />
      ))}

      {isRunning && !answer && (
        <div className="sa-trace-live"><CircleDashed size={13} className="sa-spin" /> waiting for the model…</div>
      )}

      {answer && (
        <div className="sa-trace-answer">
          <div className="sa-answer-head"><Zap size={13} /> <span>Answer</span></div>
          <p>{answer.content}</p>
          <div className="sa-answer-stats">
            <span><strong>{roundCount}</strong> round{roundCount === 1 ? '' : 's'}</span>
            <span><strong>{toolCount}</strong> tool call{toolCount === 1 ? '' : 's'}</span>
            {result?.tokens && <span><strong>{result.tokens.in + result.tokens.out}</strong> tokens</span>}
            {result?.duration_ms > 0 && <span><strong>{formatMs(result.duration_ms)}</strong> total</span>}
          </div>
        </div>
      )}

      {failure && (
        <div className="sa-trace-failure"><AlertTriangle size={14} /> <p>{failure.content}</p></div>
      )}
    </div>
  )
}
