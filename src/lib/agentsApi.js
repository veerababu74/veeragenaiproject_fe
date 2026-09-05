// veeragenaiproject_agents_be — one deployment hosting every agent project,
// each mounted under /<slug> (simpleagent, insidellm). So there is one root
// here and one rewrite in vercel.json, and a project's client is this factory
// called with its slug. See BACKENDS.md.

const AGENTS_API_ROOT = (import.meta.env.VITE_AGENTS_API_URL || '/agents-api')
  .replace(/\/+$/, '')

// Reading a catalogue should fail fast; embedding a document is a chain of
// calls to an embedding provider and a vector store and needs far longer.
const DEFAULT_TIMEOUT_MS = 30000
const UPLOAD_TIMEOUT_MS = 240000

export function createAgentsApi(slug) {
  const base = `${AGENTS_API_ROOT}/${slug}`
  const url = (path) => `${base}${path.startsWith('/') ? path : `/${path}`}`

  async function request(path, options = {}) {
    const isFormData = options.body instanceof FormData
    let response
    try {
      response = await fetch(url(path), {
        credentials: 'include',
        headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
        ...options,
        signal: options.signal ?? AbortSignal.timeout(isFormData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
      })
    } catch (networkError) {
      if (networkError.name === 'TimeoutError') throw new Error('The server took too long to respond. Please try again.')
      throw new Error('Cannot reach the agents server. Please make sure it is running.')
    }

    if (response.status === 204) return null

    let data = null
    if ((response.headers.get('content-type') || '').includes('application/json')) {
      try { data = await response.json() } catch { data = null }
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

  /** Run something over server-sent events, calling `onEvent` for each frame.
   *  No timeout: the stream is itself the progress signal, and a run with
   *  several tool calls is legitimately slow. */
  async function stream(path, body, onEvent, signal) {
    let response
    try {
      response = await fetch(url(path), {
        method: 'POST', credentials: 'include', signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      throw new Error('Cannot reach the agents server. Please make sure it is running.')
    }

    if (!response.ok || !response.body) {
      let detail = ''
      try { detail = (await response.json())?.detail } catch { /* non-JSON error body */ }
      throw new Error(detail || `Server error ${response.status}: ${response.statusText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
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

  return { request, stream }
}
