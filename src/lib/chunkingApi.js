const CHUNKING_API_URL = import.meta.env.DEV
  ? import.meta.env.VITE_CHUNKING_API_URL || 'http://localhost:8001'
  : import.meta.env.VITE_CHUNKING_API_URL || '/chunking-api'

export async function chunkingApi(path, options = {}) {
  const isFormData = options.body instanceof FormData
  let response
  try {
    response = await fetch(`${CHUNKING_API_URL}${path}`, {
      credentials: 'include',
      headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
      ...options,
      signal: options.signal ?? AbortSignal.timeout(60000), // 60s for LLM calls
    })
  } catch (networkErr) {
    if (networkErr.name === 'TimeoutError') {
      throw new Error('The server took too long to respond. LLM-based strategies may take longer.')
    }
    throw new Error('Cannot reach the Chunking Lab server. Please make sure it is running.')
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
