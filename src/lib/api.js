const API_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL || 'http://localhost:8000'
  : '/api'

export async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
      ...options,
      signal: options.signal ?? AbortSignal.timeout(15000),
    })
  } catch (networkErr) {
    if (networkErr.name === 'TimeoutError') {
      throw new Error('The server took too long to respond. Please try again.')
    }
    throw new Error('Cannot reach the server. Please make sure the backend is running.')
  }

  if (response.status === 204) return null

  // Safely parse JSON — body may be empty on some error responses
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

// Streams newline-delimited JSON events; no timeout because graph builds run long.
export async function streamNdjson(path, options, onEvent) {
  const isFormData = options.body instanceof FormData
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
      ...options,
    })
  } catch {
    throw new Error('Cannot reach the server. Please make sure the backend is running.')
  }

  if (!response.ok) {
    let detail = null
    try {
      detail = (await response.json())?.detail
    } catch {
      detail = null
    }
    throw new Error(
      (Array.isArray(detail) ? detail.map((item) => item.msg).join(', ') : detail) ||
        `Server error ${response.status}: ${response.statusText}`,
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line))
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer))
}
