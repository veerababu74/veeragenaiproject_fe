// agent_orchestration_backend — its own deployment, hosting only the Agent
// Orchestrator. See BACKENDS.md.
const AGENT_API_URL = (import.meta.env.VITE_ORCHESTRATOR_API_URL || '/orchestrator-api')
  .replace(/\/+$/, '')

// A CRUD call should fail fast, but running an agent is a chain of LLM calls -
// with delegation it can be several agents deep, each with its own tool calls -
// so it needs a far longer budget than the rest of the API.
const DEFAULT_TIMEOUT_MS = 30000
const RUN_TIMEOUT_MS = 300000
const isRunPath = (path) => path.startsWith('/execute') || path.startsWith('/rag/upload')

export async function agentApi(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  let response
  try {
    response = await fetch(`${AGENT_API_URL}${normalizedPath}`, {
      credentials: 'include',
      headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
      ...options,
      signal: options.signal ?? AbortSignal.timeout(isRunPath(normalizedPath) ? RUN_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
    })
  } catch (networkErr) {
    if (networkErr.name === 'TimeoutError') {
      throw new Error('The server took too long to respond. Please try again.')
    }
    throw new Error('Cannot reach the Agent Orchestrator server. Please make sure it is running.')
  }

  if (response.status === 204) return null

  let data = null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const detail = Array.isArray(data?.detail)
      ? data.detail.map((item) => {
          const field = item.loc?.at(-1)?.replaceAll('_', ' ')
          return field ? `${field}: ${item.msg}` : item.msg
        }).join(', ')
      : data?.detail
    throw new Error(detail || `Server error ${response.status}: ${response.statusText}`)
  }

  return data
}

export async function agentUpload(path, formData) {
  return agentApi(path, { method: 'POST', body: formData })
}

/** Run an agent over server-sent events, calling `onEvent` for each step the
 *  backend emits (start, token, delegation, done, error). Resolves once the
 *  stream closes. No timeout: the stream itself is the progress signal. */
export async function agentStream(path, body, onEvent, signal) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  let response
  try {
    response = await fetch(`${AGENT_API_URL}${normalizedPath}`, {
      method: 'POST', credentials: 'include', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Cannot reach the Agent Orchestrator server. Please make sure it is running.')
  }

  if (!response.ok || !response.body) {
    let detail = ''
    try { detail = (await response.json())?.detail } catch { /* non-JSON error body */ }
    throw new Error(detail || `Server error ${response.status}: ${response.statusText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE frames are separated by a blank line; keep any partial tail buffered.
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const payload = frame.split('\n').filter((line) => line.startsWith('data: ')).map((line) => line.slice(6)).join('')
      if (!payload) continue
      try { onEvent(JSON.parse(payload)) } catch { /* ignore a malformed frame */ }
    }
  }
}
