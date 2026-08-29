const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
    ...options,
  })
  if (response.status === 204) return null
  const data = await response.json()
  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item) => {
          const field = item.loc?.at(-1)?.replaceAll('_', ' ')
          return field ? `${field}: ${item.msg}` : item.msg
        }).join(', ')
      : data.detail
    throw new Error(detail || 'Something went wrong')
  }
  return data
}