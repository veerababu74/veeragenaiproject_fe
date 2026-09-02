import { useEffect, useRef, useState } from 'react'
import { Send, X, Bot, UserRound, Loader2, Trash2, Workflow, Activity } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { agentApi, agentStream } from '../../../lib/agentApi'
import { useAgentStore } from './store'

// crypto.randomUUID exists only in secure contexts, so it throws when the app
// is opened over plain http on a LAN address. Chat must not break there.
const newThreadId = () => (globalThis.crypto?.randomUUID
  ? crypto.randomUUID()
  : `c-${Date.now()}-${Math.random().toString(16).slice(2)}`)

export default function ChatPanel() {
  const { isChatOpen, setIsChatOpen, chatAgentId, chatMessages, addChatMessage, updateLastChatMessage,
    clearChatMessages, agents, isExecuting, setIsExecuting, conversationId, setConversationId } = useAgentStore()
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const threadAgentRef = useRef(null)
  const agent = agents.find((a) => a.id === chatAgentId)

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [chatMessages])
  useEffect(() => { if (isChatOpen) setTimeout(() => inputRef.current?.focus(), 100) }, [isChatOpen])
  // One thread per chat session, so the backend can replay earlier turns.
  useEffect(() => { if (isChatOpen && !conversationId) setConversationId(newThreadId()) }, [isChatOpen, conversationId, setConversationId])
  // Each agent gets its own thread: otherwise switching agents would show the
  // previous agent's transcript and replay its history as the new agent's memory.
  useEffect(() => {
    if (!chatAgentId || chatAgentId === threadAgentRef.current) return
    threadAgentRef.current = chatAgentId
    clearChatMessages()
    setConversationId(newThreadId())
  }, [chatAgentId, clearChatMessages, setConversationId])
  if (!isChatOpen) return null

  const startNewThread = async () => {
    const previous = conversationId
    clearChatMessages()
    setConversationId(newThreadId())
    if (previous) { try { await agentApi(`/execute/conversations/${previous}`, { method: 'DELETE' }) } catch { /* best effort */ } }
  }

  const send = async () => {
    const message = input.trim()
    if (!message || !chatAgentId || isExecuting) return
    const thread = conversationId || newThreadId()
    if (!conversationId) setConversationId(thread)
    setInput('')
    addChatMessage({ role: 'user', content: message })
    addChatMessage({ role: 'assistant', content: '', delegations: [], streaming: true })
    setIsExecuting(true)
    let streamed = ''
    const delegations = []
    const steps = []
    try {
      await agentStream('/execute/stream', { agent_id: chatAgentId, message, conversation_id: thread }, (event) => {
        if (event.type === 'token') {
          streamed += event.text
          updateLastChatMessage({ content: streamed })
        } else if (event.type === 'delegation') {
          delegations.push({ agent: event.agent, role: event.role, text: event.text })
          updateLastChatMessage({ delegations: [...delegations] })
        } else if (event.type === 'trace') {
          // Live view of what the agent is deciding and running right now.
          if (['reasoning', 'tool_call', 'tool_result', 'tool_error'].includes(event.event_type)) {
            steps.push(event)
            updateLastChatMessage({ steps: [...steps] })
          }
        } else if (event.type === 'done') {
          updateLastChatMessage({ content: event.output || streamed, delegations: event.delegations || delegations,
                                  executionId: event.execution_id, tokens: event.tokens, durationMs: event.duration_ms,
                                  streaming: false })
        } else if (event.type === 'error') {
          updateLastChatMessage({ content: `Error: ${event.error}`, streaming: false })
        }
      })
      updateLastChatMessage({ streaming: false })
    } catch (requestError) {
      updateLastChatMessage({ content: `Error: ${requestError.message}`, streaming: false })
    }
    setIsExecuting(false)
  }

  return (
    <div className="agent-chat-panel">
      <div className="agent-chat-header">
        <div><Bot size={17} /><div><p>{agent?.name || 'Chat'}</p><small>{agent?.llm_provider}/{agent?.llm_model}</small></div></div>
        <div><button onClick={startNewThread} title="Start a new conversation (clears what the agent remembers)"><Trash2 size={15} /></button><button onClick={() => setIsChatOpen(false)} title="Close"><X size={15} /></button></div>
      </div>
      <div ref={scrollRef} className="agent-chat-messages">
        {chatMessages.length === 0 && <div className="agent-chat-empty"><Bot size={32} /><p>Chat with {agent?.name}</p></div>}
        {chatMessages.map((message, index) => (
          <div key={index} className={`agent-chat-message ${message.role}`}>
            <span className="agent-chat-avatar">{message.role === 'user' ? <UserRound size={14} /> : <Bot size={14} />}</span>
            <div>
              {message.role === 'assistant'
                ? (message.content
                    ? <ReactMarkdown>{message.content}</ReactMarkdown>
                    : message.streaming && <span className="agent-chat-thinking"><Loader2 size={13} className="agent-spin" /><span>Working...</span></span>)
                : <p>{message.content}</p>}
              {message.steps?.length > 0 && (
                <details className="agent-delegations" open={message.streaming}>
                  <summary><Activity size={11} /> {message.streaming ? 'Working' : 'Steps'} · {message.steps.length}
                    {message.tokens > 0 && ` · ${message.tokens} tokens`}</summary>
                  {message.steps.map((step, stepIndex) => (
                    <div key={stepIndex} className={`agent-delegation-step ${step.event_type}`} style={{ paddingLeft: `${9 + (step.depth || 0) * 14}px` }}>
                      <span className="badge outline">{step.name || step.agent || step.event_type}</span>
                      <p>{step.event_type === 'reasoning'
                        ? (step.content || `chose ${(step.data?.chose || []).join(', ')}`)
                        : (step.content || '').slice(0, 300)}</p>
                    </div>
                  ))}
                </details>
              )}
              {message.delegations?.length > 0 && (
                <details className="agent-delegations">
                  <summary><Workflow size={11} /> Consulted {new Set(message.delegations.map((d) => d.agent)).size} agent(s)</summary>
                  {message.delegations.map((step, stepIndex) => (
                    <div key={stepIndex} className={`agent-delegation-step ${step.role}`}>
                      <span className="badge outline">{step.agent}</span>
                      <p>{step.role === 'request' ? `asked: ${step.text}` : step.text}</p>
                    </div>
                  ))}
                </details>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="agent-chat-composer">
        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()} placeholder="Send a message..." disabled={isExecuting} />
        <button onClick={send} disabled={isExecuting || !input.trim()}><Send size={16} /></button>
      </div>
    </div>
  )
}
