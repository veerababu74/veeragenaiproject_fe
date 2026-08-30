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
    })
  } catch (networkErr) {
    // Backend is down or network unreachable
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