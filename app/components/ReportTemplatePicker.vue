<script setup lang="ts">
import type { Template } from '~/composables/useTemplatesApi'

const { fetchTemplates, fetchTemplatePreviewImage, customPdfUrl } = useTemplatesApi()
const { isLoggedIn } = useAuthApi()

const isOpen = ref(false)
const templates = ref<Template[]>([])
const hasLoadedOnce = ref(false)
const loadError = ref('')
const needsLogin = ref(false)
// Blob object URLs, keyed by template id — revoked on unmount to avoid leaking memory.
const previewUrls = reactive<Record<string, string>>({})

const rootEl = ref<HTMLElement | null>(null)

async function loadOnce() {
  if (hasLoadedOnce.value) return
  hasLoadedOnce.value = true

  // Templates are private to their creator (GET /templates requires auth) — check up front
  // rather than letting the request fail, so a logged-out visitor sees a "Log in" prompt
  // instead of a generic error.
  if (!isLoggedIn.value) {
    needsLogin.value = true
    return
  }

  try {
    templates.value = await fetchTemplates()
  } catch (err: any) {
    // Covers the rarer case of a stale/expired token: isLoggedIn only checks that a token
    // cookie exists, not that the backend still considers it valid.
    if (err?.statusCode === 401 || err?.data?.statusCode === 401) {
      needsLogin.value = true
    } else {
      loadError.value = 'Could not load templates.'
    }
    return
  }
  // Fetched at 2x the CSS display size (30px) for a crisp look on high-DPI screens, same
  // reasoning as the template editor's own page thumbnails. Each fetch is independent —
  // one template's preview failing (e.g. a transient render error) shouldn't blank the rest.
  await Promise.all(
    templates.value.map(async (template) => {
      try {
        const blob = await fetchTemplatePreviewImage(template._id, 60)
        previewUrls[template._id] = URL.createObjectURL(blob)
      } catch {
        // Left unset — the template falls back to the placeholder box in the template.
      }
    })
  )
}

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) loadOnce()
}

function close() {
  isOpen.value = false
}

function selectTemplate(template: Template) {
  window.open(customPdfUrl(template._id), '_blank', 'noopener')
  close()
}

function onClickOutside(event: MouseEvent) {
  if (!rootEl.value?.contains(event.target as Node)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
  Object.values(previewUrls).forEach((url) => URL.revokeObjectURL(url))
})
</script>

<template>
  <div ref="rootEl" class="template-picker">
    <button type="button" class="btn btn-secondary" @click="toggle">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      Choose report template
      <svg width="9" height="6" viewBox="0 0 10 6" fill="none" class="picker-chevron" aria-hidden="true">
        <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div v-if="isOpen" class="template-picker-popover">
      <div v-if="needsLogin" class="template-picker-empty">
        <p>Log in to see your PDF templates.</p>
        <NuxtLink class="btn btn-primary btn-sm" to="/login" @click="close">Log in</NuxtLink>
      </div>

      <p v-else-if="loadError" class="error-text picker-error">{{ loadError }}</p>

      <template v-else-if="templates.length">
        <div class="template-picker-list">
          <div
            v-for="template in templates"
            :key="template._id"
            class="template-picker-row"
            role="button"
            tabindex="0"
            @click="selectTemplate(template)"
            @keydown.enter="selectTemplate(template)"
          >
            <NuxtLink class="template-picker-thumb" :to="`/templates/${template._id}`" title="Open in editor" @click.stop>
              <img v-if="previewUrls[template._id]" :src="previewUrls[template._id]" alt="" />
              <div v-else class="template-picker-thumb-placeholder">
                <span class="ph-line ph-line-title"></span>
                <span class="ph-line"></span>
                <span class="ph-line"></span>
                <span class="ph-line ph-line-short"></span>
                <span class="ph-block"></span>
              </div>
              <span class="template-picker-thumb-overlay">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </span>
            </NuxtLink>
            <span class="template-picker-name">{{ template.name }}</span>
          </div>
        </div>
        <div class="template-picker-footer">
          <NuxtLink class="template-picker-new" to="/templates/new" @click="close">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New template…
          </NuxtLink>
        </div>
      </template>

      <div v-else class="template-picker-empty">
        <p>You don't have any PDF templates yet.</p>
        <NuxtLink class="btn btn-primary btn-sm" to="/templates/new" @click="close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create one in PDF Generator
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-picker {
  position: relative;
  display: inline-block;
}
.picker-chevron {
  margin-left: 2px;
}
.template-picker-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  width: 260px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 10;
}
.picker-error {
  padding: var(--space-3);
}
.template-picker-list {
  padding: var(--space-1);
}
.template-picker-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
}
.template-picker-row:hover,
.template-picker-row:focus-visible {
  background: var(--color-bg);
  outline: none;
}
.template-picker-thumb {
  position: relative;
  flex-shrink: 0;
  width: 30px;
  height: 38px;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: #fff;
  overflow: hidden;
}
.template-picker-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.template-picker-thumb-placeholder {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 3px;
  height: 100%;
  box-sizing: border-box;
}
.ph-line {
  height: 2px;
  width: 100%;
  border-radius: 1px;
  background: var(--color-border);
}
.ph-line-title {
  height: 3px;
  width: 70%;
  background: var(--color-text-faint);
  margin-bottom: 1px;
}
.ph-line-short {
  width: 60%;
}
.ph-block {
  height: 5px;
  width: 100%;
  border-radius: 1px;
  background: var(--color-primary-soft);
  margin-top: 2px;
}
.template-picker-thumb-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.12s ease;
}
.template-picker-thumb:hover .template-picker-thumb-overlay {
  opacity: 1;
}
.template-picker-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.template-picker-footer {
  border-top: 1px solid var(--color-border);
  padding: var(--space-1);
}
.template-picker-new {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
  text-decoration: none;
  box-sizing: border-box;
}
.template-picker-new:hover {
  background: var(--color-bg);
}
.template-picker-empty {
  padding: var(--space-5) var(--space-4);
  text-align: center;
}
.template-picker-empty p {
  margin: 0 0 var(--space-3);
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--color-text-muted);
}
</style>
