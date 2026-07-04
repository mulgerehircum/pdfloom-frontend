interface AuthResponse {
  accessToken: string
}

export function useAuthApi() {
  const { apiFetch, token } = useApiFetch()

  async function login(username: string, password: string) {
    const res = await apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { username, password } })
    token.value = res.accessToken
  }

  async function register(username: string, password: string) {
    const res = await apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: { username, password } })
    token.value = res.accessToken
  }

  function logout() {
    token.value = null
  }

  const isLoggedIn = computed(() => !!token.value)

  return { login, register, logout, isLoggedIn }
}
