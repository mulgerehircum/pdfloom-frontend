<script setup lang="ts">
import type { Template } from '~/composables/useTemplatesApi'

const { fetchTemplates, deleteTemplate, customPdfUrl } = useTemplatesApi()

const templates = ref<Template[]>([])
const loadError = ref('')

async function load() {
  loadError.value = ''
  try {
    templates.value = await fetchTemplates()
  } catch (err) {
    loadError.value = 'Could not reach the inventory API.'
  }
}

onMounted(load)

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

    <p v-if="loadError" class="error-text">{{ loadError }}</p>

    <table v-else class="table card">
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
.table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-5);
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
