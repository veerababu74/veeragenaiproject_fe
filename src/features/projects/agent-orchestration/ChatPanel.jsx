import { useEffect, useRef, useState } from 'react'
import { Send, X, Bot, UserRound, Loader2, Trash2, Workflow } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { agentApi } from '../../../lib/agentApi'
import { useAgentStore } from './store'

export default function ChatPanel() {
  const { isChatOpen, setIsChatOpen, chatAgentId, chatMessages, addChatMessage, clearChatMessages, agents, isExecuting, setIsExecuting } = useAgentStore()
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const agent = agents.find((a) => a.id === chatAgentId)

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [chatMessages])
  useEffect(() => { if (isChatOpen) setTimeout(() => inputRef.current?.focus(), 100) }, [isChatOpen])
  if (!isChatOpen) return null

  const send = async () => {
    const message = input.trim()
    if (!message || !chatAgentId || isExecuting) return
    setInput('')
    addChatMessage({ role: 'user', content: message })
    setIsExecuting(true)
    try {
      const result = await agentApi('/execute', { method: 'POST', body: JSON.stringify({ agent_id: chatAgentId, message }) })
      addChatMessage(result.status === 'error'
        ? { role: 'assistant', content: `Error: ${result.error}`, delegations: result.delegations }
        : { role: 'assistant', content: result.output, delegations: result.delegations })
    } catch (requestError) {
      addChatMessage({ role: 'assistant', content: `Error: ${requestError.message}` })
    }
    setIsExecuting(false)
  }

  return (
    <div className="agent-chat-panel">
      <div className="agent-chat-header">
        <div><Bot size={17} /><div><p>{agent?.name || 'Chat'}</p><small>{agent?.llm_provider}/{agent?.llm_model}</small></div></div>
        <div><button onClick={clearChatMessages} title="Clear conversation"><Trash2 size={15} /></button><button onClick={() => setIsChatOpen(false)} title="Close"><X size={15} /></button></div>
      </div>
      <div ref={scrollRef} className="agent-chat-messages">
        {chatMessages.length === 0 && <div className="agent-chat-empty"><Bot size={32} /><p>Chat with {agent?.name}</p></div>}
        {chatMessages.map((message, index) => (
          <div key={index} className={`agent-chat-message ${message.role}`}>
            <span className="agent-chat-avatar">{message.role === 'user' ? <UserRound size={14} /> : <Bot size={14} />}</span>
            <div>
              {message.role === 'assistant' ? <ReactMarkdown>{message.content}</ReactMarkdown> : <p>{message.content}</p>}
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
        {isExecuting && <div className="agent-chat-message assistant"><span className="agent-chat-avatar"><Bot size={14} /></span><div className="agent-chat-thinking"><Loader2 size={14} className="agent-spin" /><span>Thinking...</span></div></div>}
      </div>
      <div className="agent-chat-composer">
        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()} placeholder="Send a message..." disabled={isExecuting} />
        <button onClick={send} disabled={isExecuting || !input.trim()}><Send size={16} /></button>
      </div>
    </div>
  )
}
