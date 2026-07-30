export async function apiFetch(path, options = {}) {
  const headers = options.body instanceof FormData
    ? { ...(options.headers || {}) }
    : {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      }

  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers,
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message = payload?.error || payload?.message || `Request failed (${response.status})`
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}

export function getJson(path) {
  return apiFetch(path)
}

export function postJson(path, body) {
  return apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function putJson(path, body) {
  return apiFetch(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}
