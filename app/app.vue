<script setup lang="ts">
const route = useRoute()
const { isLoggedIn, logout } = useAuthApi()
const router = useRouter()

async function handleLogout() {
  logout()
  await router.push('/')
}
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <div v-if="route.path !== '/login' && !route.path.startsWith('/templates/')" class="auth-bar">
      <button v-if="isLoggedIn" class="btn btn-secondary" @click="handleLogout">Log out</button>
      <NuxtLink v-else class="btn btn-secondary" to="/login">Log in</NuxtLink>
    </div>
    <NuxtPage />
  </div>
</template>

<style scoped>
.auth-bar {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-3) var(--space-5) 0;
  max-width: 960px;
  margin: 0 auto;
}
</style>
