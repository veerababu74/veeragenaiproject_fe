// veeragenaiproject_be2 — hosts every lab behind one deployment, each mounted
// at /<slug> (embedlab, decodelab, guardlab). One root here, one rewrite in
// vercel.json, and a lab's client is this factory called with its slug.
// See BACKENDS.md.
//
// Chunking Lab shares this host but keeps its own client: it predates the split
// and its router carries its own /chunking prefix rather than a slug mount.

const LABS_API_ROOT = (import.meta.env.VITE_LABS_API_URL || '/labs-api').replace(/\/+$/, '')

// Reading a catalogue should fail fast. Embedding a corpus is a chain of calls
// to one provider per model and needs a far longer budget.
const DEFAULT_TIMEOUT_MS = 20000
const SLOW_TIMEOUT_MS = 120000
const isSlow = (path) => path.startsWith('/compare')

export function createLabsApi(slug) {
  const base = `${LABS_API_ROOT}/${slug}`

  async function request(path, options = {}) {
    const normalized = path.startsWith('/') ? path : `/${path}`
    let response
    try {
      response = await fetch(`${base}${normalized}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
        signal: options.signal ?? AbortSignal.timeout(
          isSlow(normalized) ? SLOW_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
      })
    } catch (networkError) {
      if (networkError.name === 'TimeoutError') {
        throw new Error('The server took too long to respond. Please try again.')
      }
      throw new Error('Cannot reach the labs server. Please make sure it is running.')
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

  return { request }
}
