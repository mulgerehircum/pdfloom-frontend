<script setup lang="ts">
import type { Template } from '~/composables/useTemplatesApi'

const { fetchTemplates, deleteTemplate, customPdfUrl } = useTemplatesApi()
const { isLoggedIn } = useAuthApi()

const templates = ref<Template[]>([])
const loadError = ref('')

// Templates are private to their creator (see templates.controller.ts) — there's nothing to
// list at all when logged out, and re-fetch whenever login state changes so logging in/out
// on this page (not just on load) immediately reflects the right owner's templates.
async function load() {
  if (!isLoggedIn.value) {
    templates.value = []
    return
  }
  loadError.value = ''
  try {
    templates.value = await fetchTemplates()
  } catch (err) {
    loadError.value = 'Could not reach the inventory API.'
  }
}

onMounted(load)
watch(isLoggedIn, load)

async function handleDelete(id: string, name: string) {
  if (!confirm(`Delete "${name}"? This can't be undone.`)) return
  await deleteTemplate(id)
  await load()
}
</script>

<template>
  <main class="page">
    <div class="header">
      <h1>PDF Templates</h1>
      <NuxtLink class="btn btn-primary" to="/templates/new">+ New template</NuxtLink>
    </div>

    <p v-if="!isLoggedIn" class="hint-text spaced">
      Log in (top right) to see and manage your saved templates, or create a new one.
      <svg class="pointer-arrow" width="280" height="90" viewBox="0 0 280 90" fill="none" aria-hidden="true">
        <path d="M0 60 C 4 20, 230 14, 256 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <path d="M254 27 L266 17 L254 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </p>
    <p v-else-if="loadError" class="error-text spaced">{{ loadError }}</p>

    <section v-else class="panel card">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Elements</th>
            <th>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="template in templates" :key="template._id">
            <td>{{ template.name }}</td>
            <td>{{ template.elements.length }}</td>
            <td>{{ new Date(template.updatedAt).toLocaleString() }}</td>
            <td class="actions">
              <NuxtLink class="btn btn-secondary btn-sm" :to="`/templates/${template._id}`">Edit</NuxtLink>
              <a class="btn btn-secondary btn-sm" :href="customPdfUrl(template._id)" target="_blank" rel="noopener">PDF</a>
              <button class="btn btn-danger btn-sm" @click="handleDelete(template._id, template.name)">Delete</button>
            </td>
          </tr>
          <tr v-if="!templates.length">
            <td colspan="4" class="hint-text">No templates yet — create one.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <NuxtLink class="btn btn-secondary" to="/">&larr; Back to inventory</NuxtLink>
  </main>
</template>

<style scoped>
.page {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
}
.panel {
  margin-bottom: var(--space-5);
  padding: var(--space-5);
}
/* Same bottom margin as .panel so the gap before "Back to inventory" is consistent whether
   the page is showing the templates table, this empty-state hint, or a load error. */
.spaced {
  margin-bottom: var(--space-5);
}
.pointer-arrow {
  /* Inline right after the text (not absolutely positioned) so it starts exactly where
     "...new one." ends, regardless of viewport width. Negative margins pull its own layout
     footprint back in so it doesn't inflate the paragraph's line height, while the curve
     itself still visually rises above the line to point at the "+ New template" button. */
  display: inline-block;
  vertical-align: middle;
  margin: -70px 0 -14px var(--space-2);
  color: var(--color-primary);
}
.table {
  width: 100%;
  border-collapse: collapse;
}
.table th {
  text-align: left;
  padding: var(--space-3);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}
.table td {
  text-align: left;
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.table tbody tr:last-child td {
  border-bottom: none;
}
.actions {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}
</style>
