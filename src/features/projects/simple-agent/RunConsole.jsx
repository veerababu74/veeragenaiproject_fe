import { useEffect, useRef, useState } from 'react'
import { Activity, Bot, Loader2, RotateCcw, Send, Sparkles, UserRound } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { simpleAgentApi, simpleAgentStream } from '../../../lib/simpleAgentApi'
import { newConversationId, useSimpleAgentStore } from './store'
import TraceTimeline from './TraceTimeline'

const STARTERS = [
  'What is 21 doubled, then divided by 7?',
  'What day is it today, and what is happening in AI this week?',
  'Convert 500 USD to INR and work out a 5-day daily budget.',
]

export default function RunConsole() {
  const {
    agent, messages, addMessage, patchLastMessage, clearMessages,
    conversationId, setConversationId, steps, addStep, resetSteps,
    isRunning, setIsRunning, runResult, setRunResult, setActiveTab,
  } = useSimpleAgentStore()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  if (!agent) {
    return (
      <div className="sa-empty-state">
        <Bot size={30} />
        <h3>No agent yet</h3>
        <p>Build an agent — or load one of the ready-made examples — and it will appear here to talk to.</p>
        <button className="sa-primary" onClick={() => setActiveTab('build')}>Go to Build</button>
      </div>
    )
  }

  const send = async (text) => {
    const question = (text ?? input).trim()
    if (!question || isRunning) return
    setInput('')
    setError('')
    resetSteps()
    addMessage({ role: 'user', content: question })
    addMessage({ role: 'assistant', content: '', streaming: true })
    setIsRunning(true)

    let streamed = ''
    try {
      await simpleAgentStream('/run/stream', { message: question, conversation_id: conversationId }, (event) => {
        if (event.type === 'step') {
          addStep(event)
        } else if (event.type === 'token') {
          streamed += event.text
          patchLastMessage({ content: streamed })
        } else if (event.type === 'done') {
          setRunResult(event)
          patchLastMessage({
            content: event.answer || streamed, streaming: false, runId: event.run_id,
            rounds: event.rounds, toolCalls: event.tool_calls, durationMs: event.duration_ms,
          })
        } else if (event.type === 'error') {
          setError(event.error)
          patchLastMessage({ content: '', streaming: false, failed: true })
        }
      })
      patchLastMessage({ streaming: false })
    } catch (requestError) {
      setError(requestError.message)
      patchLastMessage({ content: '', streaming: false, failed: true })
    }
    setIsRunning(false)
  }

  const startNewThread = async () => {
    const previous = conversationId
    clearMessages()
    resetSteps()
    setConversationId(newConversationId())
    if (previous) {
      try { await simpleAgentApi(`/conversations/${previous}`, { method: 'DELETE' }) } catch { /* best effort */ }
    }
  }

  return (
    <div className="sa-run">
      <div className="sa-chat">
        <header className="sa-chat-head">
          <div>
            <span className="sa-chat-avatar"><Bot size={15} /></span>
            <div>
              <strong>{agent.name}</strong>
              <small>{agent.provider} · {agent.model} · {agent.tools?.length || 0} tools</small>
            </div>
          </div>
          <button onClick={startNewThread} title="Start a new conversation, clearing what the agent remembers">
            <RotateCcw size={14} /> New thread
          </button>
        </header>

        <div className="sa-messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="sa-starters">
              <Sparkles size={22} />
              <h4>Ask {agent.name} something</h4>
              <p>Pick a question that needs more than one tool — that is when the trace gets interesting.</p>
              {STARTERS.map((starter) => (
                <button key={starter} onClick={() => send(starter)}>{starter}</button>
              ))}
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className={`sa-message ${message.role}`}>
              <span className="sa-message-avatar">
                {message.role === 'user' ? <UserRound size={13} /> : <Bot size={13} />}
              </span>
              <div className="sa-message-body">
                {message.role === 'assistant' ? (
                  message.content
                    ? <ReactMarkdown>{message.content}</ReactMarkdown>
                    : message.streaming
                      ? <span className="sa-thinking"><Loader2 size={13} className="sa-spin" /> working…</span>
                      : <span className="sa-muted">No answer was produced.</span>
                ) : <p>{message.content}</p>}

                {message.role === 'assistant' && !message.streaming && message.rounds > 0 && (
                  <div className="sa-message-meta">
                    <Activity size={11} />
                    {message.rounds} round{message.rounds === 1 ? '' : 's'} · {message.toolCalls} tool call
                    {message.toolCalls === 1 ? '' : 's'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="sa-error">{error}</p>}

        <div className="sa-composer">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && send()}
            placeholder={`Ask ${agent.name} a question…`}
            disabled={isRunning}
          />
          <button onClick={() => send()} disabled={isRunning || !input.trim()} title="Send">
            {isRunning ? <Loader2 size={15} className="sa-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>

      <aside className="sa-trace-pane">
        <header className="sa-trace-head">
          <div><Activity size={14} /> <strong>Live trace</strong></div>
          {isRunning && <span className="sa-live-dot">running</span>}
        </header>
        <TraceTimeline steps={steps} isRunning={isRunning} result={runResult} />
      </aside>
    </div>
  )
}
