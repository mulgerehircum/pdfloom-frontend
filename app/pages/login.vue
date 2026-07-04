<script setup lang="ts">
const { login, register } = useAuthApi()
const router = useRouter()

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const error = ref('')
const isSubmitting = ref(false)

async function handleSubmit() {
  error.value = ''
  isSubmitting.value = true
  try {
    if (mode.value === 'login') {
      await login(username.value, password.value)
    } else {
      await register(username.value, password.value)
    }
    await router.push('/')
  } catch (err: any) {
    error.value = err?.data?.message?.toString() ?? 'Something went wrong'
  } finally {
    isSubmitting.value = false
  }
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
}
</script>

<template>
  <main class="page">
    <div class="card auth-card">
      <h1>{{ mode === 'login' ? 'Sign in' : 'Create an account' }}</h1>
      <p class="subtitle">Only needed to save PDF templates — browsing and editing work without an account.</p>
      <form @submit.prevent="handleSubmit">
        <input v-model="username" class="field-input" placeholder="Username" required autocomplete="username" />
        <input
          v-model="password"
          type="password"
          class="field-input"
          placeholder="Password"
          required
          autocomplete="current-password"
        />
        <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register' }}
        </button>
      </form>
      <p v-if="error" class="error-text">{{ error }}</p>
      <button class="btn-link toggle-link" @click="toggleMode">
        {{ mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in' }}
      </button>
      <p class="hint-text seed-hint">Default seeded user: <code>admin</code> / <code>admin123</code></p>
    </div>
  </main>
</template>

<style scoped>
.page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-4);
}
.auth-card {
  width: 340px;
  padding: var(--space-6);
  box-shadow: var(--shadow-lg);
}
.subtitle {
  margin: var(--space-2) 0 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}
form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: var(--space-5) 0 var(--space-3);
}
.toggle-link {
  font-size: var(--text-sm);
}
.seed-hint {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.seed-hint code {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}
</style>
