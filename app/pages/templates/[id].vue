<script setup lang="ts">
import type { ReportContext, TemplateElement } from '~/composables/useTemplatesApi'

const route = useRoute()
const router = useRouter()
const { fetchTemplate, createTemplate, updateTemplate, previewPdf, fetchReportContext, uploadImage } = useTemplatesApi()

const reportContext = ref<ReportContext | null>(null)
fetchReportContext()
  .then((context) => (reportContext.value = context))
  .catch(() => {
    // Non-fatal — field elements just fall back to showing the raw {{ fieldPath }} placeholder.
  })

const isNew = route.params.id === 'new'
const templateId = ref<string>(isNew ? '' : (route.params.id as string))

const PAGE_WIDTH = 794
const PAGE_HEIGHT = 1123
const CANVAS_GUTTER = 24
const PREVIEW_DEBOUNCE_MS = 600

const name = ref('Untitled template')
const elements = ref<TemplateElement[]>([])
const selectedId = ref<string | null>(null)
const isSaving = ref(false)
const saveError = ref('')
const loadError = ref('')

const previewBlobUrl = ref('')
const previewError = ref('')
let previewDebounceTimer: ReturnType<typeof setTimeout> | null = null
// Guards against an older, slower-to-resolve preview request overwriting a newer one.
let previewRequestId = 0

const selectedElement = computed(() => elements.value.find((el) => el.id === selectedId.value) ?? null)

const canvasWrapperEl = ref<HTMLElement | null>(null)
const wrapperSize = reactive({ width: 0, height: 0 })
let resizeObserver: ResizeObserver | null = null

// See app/utils/templateEditorMath.ts for the scale calculation itself (unit tested there).
const canvasScale = computed(() =>
  computeCanvasScale({
    wrapperWidth: wrapperSize.width,
    wrapperHeight: wrapperSize.height,
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT
  })
)

onMounted(() => {
  if (!canvasWrapperEl.value) return
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    wrapperSize.width = entry.contentRect.width
    wrapperSize.height = entry.contentRect.height
  })
  resizeObserver.observe(canvasWrapperEl.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

const TOOLTIP_GAP = 8
const tooltipEl = ref<HTMLElement | null>(null)
const tooltipSize = reactive({ width: 0, height: 0 })
let tooltipResizeObserver: ResizeObserver | null = null

// The tooltip is created/destroyed each time selection changes (v-if), so re-attach the
// observer whenever the underlying element changes rather than once in onMounted.
watch(tooltipEl, (el) => {
  tooltipResizeObserver?.disconnect()
  tooltipResizeObserver = null
  if (!el) return
  tooltipResizeObserver = new ResizeObserver(() => {
    // Use offsetWidth/Height (border-box, matching the element's real on-screen footprint)
    // rather than contentRect (excludes padding/border) — clamping needs the true footprint.
    tooltipSize.width = el.offsetWidth
    tooltipSize.height = el.offsetHeight
  })
  tooltipResizeObserver.observe(el)
})

onBeforeUnmount(() => {
  tooltipResizeObserver?.disconnect()
})

// See app/utils/templateEditorMath.ts for the flip/clamp logic itself (unit tested there).
const tooltipStyle = computed(() => {
  if (!selectedElement.value) return {}

  const { left, top } = computeTooltipPosition({
    elementX: selectedElement.value.x,
    elementY: selectedElement.value.y,
    elementHeight: selectedElement.value.height,
    canvasScale: canvasScale.value,
    tooltipWidth: tooltipSize.width,
    tooltipHeight: tooltipSize.height,
    pageWidth: PAGE_WIDTH,
    gap: TOOLTIP_GAP
  })

  return { left: `${left}px`, top: `${top}px` }
})

// Chrome's built-in PDF viewer defaults to "fit width", which crops the bottom of a tall
// A4 page. #view=Fit forces "fit whole page" so the entire page is always visible at once.
const previewViewerUrl = computed(() => (previewBlobUrl.value ? `${previewBlobUrl.value}#view=Fit` : ''))

// The scalar fields available on the report data context (see backend ReportsService.buildReportContext).
const scalarFieldOptions = ['generatedAt', 'totalValue']
const productColumnOptions = ['sku', 'name', 'category', 'quantity', 'unitPrice', 'value', 'isLowStock']

async function refreshPreview() {
  const requestId = ++previewRequestId
  previewError.value = ''
  try {
    const blob = await previewPdf({ pageWidth: PAGE_WIDTH, pageHeight: PAGE_HEIGHT, elements: elements.value })
    if (requestId !== previewRequestId) return // a newer request already started

    const nextUrl = URL.createObjectURL(blob)
    if (previewBlobUrl.value) URL.revokeObjectURL(previewBlobUrl.value)
    previewBlobUrl.value = nextUrl
  } catch (err) {
    if (requestId === previewRequestId) previewError.value = 'Could not render the preview.'
  }
}

function schedulePreview() {
  if (previewDebounceTimer) clearTimeout(previewDebounceTimer)
  previewDebounceTimer = setTimeout(refreshPreview, PREVIEW_DEBOUNCE_MS)
}

watch(elements, schedulePreview, { deep: true })

onBeforeUnmount(() => {
  if (previewDebounceTimer) clearTimeout(previewDebounceTimer)
  if (previewBlobUrl.value) URL.revokeObjectURL(previewBlobUrl.value)
})

async function loadExisting() {
  if (isNew) return
  loadError.value = ''
  try {
    const template = await fetchTemplate(templateId.value)
    name.value = template.name
    elements.value = template.elements
  } catch (err) {
    loadError.value = 'Could not load this template.'
  }
}

onMounted(async () => {
  await loadExisting()
  // loadExisting() reassigns `elements`, which the deep watcher above also reacts to;
  // cancel that scheduled duplicate so the initial preview only renders once.
  if (previewDebounceTimer) clearTimeout(previewDebounceTimer)
  refreshPreview()
})

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

// See app/utils/templateEditorMath.ts for computeStagger (unit tested there).
function nextStagger() {
  return computeStagger(elements.value.length)
}

function addElement(type: 'text' | 'field' | 'table') {
  const stagger = nextStagger()
  const base = { id: makeId(), x: 40 + stagger, y: 40 + stagger, width: 160, height: 24, fontSize: 12 }

  if (type === 'text') {
    elements.value.push({ ...base, type, content: 'Label' })
  } else if (type === 'field') {
    elements.value.push({ ...base, type, fieldPath: 'totalValue' })
  } else {
    elements.value.push({
      ...base,
      type,
      width: 320,
      height: 120,
      itemsPath: 'products',
      columns: [
        { label: 'SKU', fieldPath: 'sku' },
        { label: 'Name', fieldPath: 'name' },
        { label: 'Qty', fieldPath: 'quantity' }
      ]
    })
  }

  selectedId.value = base.id
}

const imageInputEl = ref<HTMLInputElement | null>(null)
const imageUploadError = ref('')
// Distinguishes "adding a brand-new image element" from "replacing the selected element's
// image" — both reuse the same hidden <input type="file">.
let imageUploadTargetId: string | null = null

function triggerAddImage() {
  imageUploadTargetId = null
  imageInputEl.value?.click()
}

function triggerReplaceImage() {
  if (!selectedId.value) return
  imageUploadTargetId = selectedId.value
  imageInputEl.value?.click()
}

async function handleImageFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-selecting the same file later
  if (!file) return

  imageUploadError.value = ''
  try {
    const { dataUri } = await uploadImage(file)

    if (imageUploadTargetId) {
      const target = elements.value.find((el) => el.id === imageUploadTargetId)
      if (target) target.imageData = dataUri
    } else {
      const stagger = nextStagger()
      const id = makeId()
      elements.value.push({
        id,
        type: 'image',
        x: 40 + stagger,
        y: 40 + stagger,
        width: 160,
        height: 120,
        imageData: dataUri
      })
      selectedId.value = id
    }
  } catch (err: any) {
    imageUploadError.value = err?.data?.message?.toString() ?? 'Failed to upload image'
  }
}

function selectElement(id: string) {
  selectedId.value = id
}

function updateSelected(patch: Partial<TemplateElement>) {
  if (!selectedElement.value) return
  Object.assign(selectedElement.value, patch)
}

function removeSelected() {
  if (!selectedId.value) return
  elements.value = elements.value.filter((el) => el.id !== selectedId.value)
  selectedId.value = null
}

function addColumn() {
  selectedElement.value?.columns?.push({ label: '', fieldPath: 'sku' })
}

function removeColumn(index: number) {
  selectedElement.value?.columns?.splice(index, 1)
}

async function handleSave() {
  isSaving.value = true
  saveError.value = ''
  try {
    const payload = { name: name.value, pageWidth: PAGE_WIDTH, pageHeight: PAGE_HEIGHT, elements: elements.value }
    if (isNew || !templateId.value) {
      const created = await createTemplate(payload)
      templateId.value = created._id
      await router.replace(`/templates/${created._id}`)
    } else {
      await updateTemplate(templateId.value, payload)
    }
  } catch (err: any) {
    saveError.value = err?.data?.message?.toString() ?? 'Failed to save template'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <main class="editor">
    <header class="toolbar card">
      <NuxtLink class="btn btn-secondary" to="/templates">&larr; Templates</NuxtLink>
      <input v-model="name" class="field-input name-input" placeholder="Template name" />
      <button class="btn btn-primary" :disabled="isSaving" @click="handleSave">{{ isSaving ? 'Saving…' : 'Save' }}</button>
      <span v-if="!templateId" class="hint-text">Not saved yet — the preview still reflects your current edits</span>
    </header>

    <p v-if="saveError" class="error-text">{{ saveError }}</p>
    <p v-if="loadError" class="error-text">{{ loadError }}</p>

    <div class="workspace">
      <aside class="palette card">
        <h3>Add element</h3>
        <button class="btn btn-secondary" @click="addElement('text')">+ Text label</button>
        <button class="btn btn-secondary" @click="addElement('field')">+ Data field</button>
        <button class="btn btn-secondary" @click="addElement('table')">+ Table</button>
        <button class="btn btn-secondary" @click="triggerAddImage">+ Image</button>
        <input
          ref="imageInputEl"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          class="hidden-file-input"
          @change="handleImageFileSelected"
        />
        <p v-if="imageUploadError" class="error-text">{{ imageUploadError }}</p>
      </aside>

      <div ref="canvasWrapperEl" class="canvas-wrapper" :style="{ width: `${PAGE_WIDTH + CANVAS_GUTTER * 2}px` }">
        <div class="canvas-scale-box" :style="{ width: `${PAGE_WIDTH * canvasScale}px`, height: `${PAGE_HEIGHT * canvasScale}px` }">
          <div
            class="canvas"
            :style="{ width: `${PAGE_WIDTH}px`, height: `${PAGE_HEIGHT}px`, transform: `scale(${canvasScale})` }"
            @pointerdown="selectedId = null"
          >
            <TemplateCanvasElement
              v-for="el in elements"
              :key="el.id"
              :element="el"
              :selected="el.id === selectedId"
              :scale="canvasScale"
              :report-context="reportContext"
              @select="selectElement(el.id)"
              @move="(pos) => updateSelected(pos)"
              @resize="(size) => updateSelected(size)"
            />
          </div>

          <div
            v-if="selectedElement"
            ref="tooltipEl"
            class="element-tooltip"
            :style="tooltipStyle"
          >
            <span class="type-badge">{{ selectedElement.type }}</span>

            <template v-if="selectedElement.type === 'text'">
              <label>Content</label>
              <input
                :value="selectedElement.content"
                @input="updateSelected({ content: ($event.target as HTMLInputElement).value })"
              />
            </template>

            <template v-else-if="selectedElement.type === 'field'">
              <label>Field</label>
              <select :value="selectedElement.fieldPath" @change="updateSelected({ fieldPath: ($event.target as HTMLSelectElement).value })">
                <option v-for="opt in scalarFieldOptions" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </template>

            <template v-else-if="selectedElement.type === 'table'">
              <label>Items</label>
              <input :value="selectedElement.itemsPath" disabled class="items-path" />
              <label>Columns</label>
              <div class="columns-inline">
                <div v-for="(col, index) in selectedElement.columns" :key="index" class="column-row">
                  <input v-model="col.label" placeholder="Label" class="column-label" />
                  <select v-model="col.fieldPath">
                    <option v-for="opt in productColumnOptions" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                  <button class="btn btn-danger btn-sm" @click="removeColumn(index)">x</button>
                </div>
                <button class="btn btn-secondary small-button" @click="addColumn">+ Column</button>
              </div>
            </template>

            <template v-else-if="selectedElement.type === 'image'">
              <img v-if="selectedElement.imageData" :src="selectedElement.imageData" class="image-thumb" alt="" />
              <button class="btn btn-secondary small-button" @click="triggerReplaceImage">Replace image</button>
            </template>

            <template v-if="selectedElement.type !== 'image'">
              <label>Size</label>
              <input
                type="number"
                class="font-size-input"
                :value="selectedElement.fontSize"
                @input="updateSelected({ fontSize: Number(($event.target as HTMLInputElement).value) })"
              />
            </template>

            <button class="btn btn-danger small-button" @click="removeSelected">Delete</button>
          </div>
        </div>
      </div>

      <aside class="preview card" :style="{ width: `${PAGE_WIDTH + CANVAS_GUTTER * 2}px` }">
        <p v-if="previewError" class="error-text preview-message">{{ previewError }}</p>
        <p v-else-if="!previewBlobUrl" class="hint-text preview-message">Add an element to see a PDF preview here.</p>
        <iframe v-else :src="previewViewerUrl" class="preview-frame"></iframe>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.editor {
  padding: var(--space-4);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
}
.name-input {
  flex: 1;
  max-width: 300px;
}
.element-tooltip {
  /* position/top/left come from the computed tooltipStyle (JS-measured, flips/clamps to
     stay on-canvas) — only cosmetic properties are set here. */
  position: absolute;
  z-index: 50;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  max-width: 360px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}
.element-tooltip label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.type-badge {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--color-primary);
  color: var(--color-primary-contrast);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
}
.element-tooltip input,
.element-tooltip select {
  font-family: inherit;
  font-size: var(--text-sm);
  padding: 4px var(--space-2);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
}
.font-size-input {
  width: 60px;
}
.items-path {
  width: 100px;
}
.columns-inline {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}
.column-row {
  display: flex;
  gap: var(--space-1);
  align-items: center;
}
.column-label {
  width: 90px;
}
.workspace {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
  overflow-x: auto;
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
}
.palette {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
}
.palette h3 {
  margin-bottom: var(--space-1);
}
.preview {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  height: 80vh;
  padding: var(--space-3);
  box-sizing: border-box;
}
.hidden-file-input {
  display: none;
}
.image-thumb {
  max-width: 120px;
  max-height: 80px;
  object-fit: contain;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.canvas-wrapper {
  /* Structural sizing (padding: 24px matches the CANVAS_GUTTER constant used in
     canvasScale's math, height: 80vh matches .preview) — do not change these. Only
     cosmetic properties (border color, radius, shadow) are safe to restyle here. */
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  height: 80vh;
  box-sizing: border-box;
}
.canvas-scale-box {
  position: relative;
  flex-shrink: 0;
}
.canvas {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  background: #fff;
  box-shadow: var(--shadow-md);
}
.preview-frame {
  width: 100%;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.small-button {
  padding: 4px var(--space-2);
  font-size: var(--text-xs);
}
.preview-message {
  padding: 0 var(--space-2);
}
</style>
