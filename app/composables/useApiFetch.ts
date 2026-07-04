export function useAuthToken() {
  return useCookie<string | null>('auth_token', { maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' })
}

// Wraps $fetch with the API base URL and the auth token header, so every composable that
// talks to the backend gets Authorization for free instead of repeating it everywhere.
export function useApiFetch() {
  const { public: { apiBase } } = useRuntimeConfig()
  const token = useAuthToken()

  function apiFetch<T>(path: string, opts: Record<string, any> = {}): Promise<T> {
    return $fetch<T>(`${apiBase}${path}`, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        ...(token.value ? { Authorization: `Bearer ${token.value}` } : {})
      }
    })
  }

  return { apiFetch, apiBase, token }
}
