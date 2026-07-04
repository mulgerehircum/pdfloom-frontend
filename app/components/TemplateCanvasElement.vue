<script setup lang="ts">
import type { ReportContext, TemplateElement } from '~/composables/useTemplatesApi'

const props = defineProps<{
  element: TemplateElement
  selected: boolean
  scale: number
  reportContext: ReportContext | null
}>()

const emit = defineEmits<{
  select: []
  move: [{ x: number; y: number }]
  resize: [{ width: number; height: number }]
}>()

// Shows (and measures) the real resolved value for a field, not the raw {{ fieldPath }}
// placeholder — the placeholder is a different length than the actual rendered value
// (e.g. "generatedAt" resolves to "Jul 4, 2026, 1:27 AM"), which was causing auto-fit
// boxes sized off the placeholder to clip the real text once rendered into the PDF.
function fieldDisplayValue(fieldPath?: string) {
  if (!fieldPath) return '{{ ? }}'
  const value = props.reportContext?.[fieldPath as keyof ReportContext]
  if (value === undefined) return ['{{', fieldPath, '}}'].join(' ')
  return String(value)
}

// Text/field boxes always fit their own content exactly (matching how the PDF renders
// them — see template-compiler.ts), so they render at natural size and report that size
// back to the parent model rather than being manually resizable.
const autoFitsContent = computed(() => props.element.type === 'text' || props.element.type === 'field')

const canvasElementEl = ref<HTMLElement | null>(null)
let bodyResizeObserver: ResizeObserver | null = null

watch(
  canvasElementEl,
  (el) => {
    bodyResizeObserver?.disconnect()
    bodyResizeObserver = null
    if (!el || !autoFitsContent.value) return
    bodyResizeObserver = new ResizeObserver(() => {
      const width = el.offsetWidth
      const height = el.offsetHeight
      if (width !== props.element.width || height !== props.element.height) {
        emit('resize', { width, height })
      }
    })
    bodyResizeObserver.observe(el)
  },
  { immediate: true }
)

onBeforeUnmount(() => bodyResizeObserver?.disconnect())

function onDragStart(startEvent: PointerEvent) {
  startEvent.stopPropagation()
  emit('select')
  const startX = startEvent.clientX
  const startY = startEvent.clientY
  const originX = props.element.x
  const originY = props.element.y

  function onMove(moveEvent: PointerEvent) {
    const dx = (moveEvent.clientX - startX) / props.scale
    const dy = (moveEvent.clientY - startY) / props.scale
    emit('move', { x: Math.max(0, Math.round(originX + dx)), y: Math.max(0, Math.round(originY + dy)) })
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onResizeStart(startEvent: PointerEvent) {
  startEvent.stopPropagation()
  emit('select')
  const startX = startEvent.clientX
  const startY = startEvent.clientY
  const originWidth = props.element.width
  const originHeight = props.element.height

  function onMove(moveEvent: PointerEvent) {
    const dx = (moveEvent.clientX - startX) / props.scale
    const dy = (moveEvent.clientY - startY) / props.scale
    emit('resize', { width: Math.max(20, Math.round(originWidth + dx)), height: Math.max(20, Math.round(originHeight + dy)) })
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
</script>

<template>
  <div
    ref="canvasElementEl"
    class="canvas-element"
    :class="{ selected }"
    :style="{
      left: `${element.x}px`,
      top: `${element.y}px`,
      width: autoFitsContent ? 'auto' : `${element.width}px`,
      height: autoFitsContent ? 'auto' : `${element.height}px`,
      fontSize: `${element.fontSize ?? 12}px`
    }"
    @pointerdown="onDragStart"
  >
    <div class="element-body" :class="{ 'no-padding': element.type === 'image' }">
      <template v-if="element.type === 'text'">{{ element.content || 'Text' }}</template>
      <template v-else-if="element.type === 'field'">{{ fieldDisplayValue(element.fieldPath) }}</template>
      <template v-else-if="element.type === 'table'">
        <table class="table-preview">
          <thead>
            <tr>
              <th v-for="col in element.columns" :key="col.label">{{ col.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in 2" :key="n">
              <td v-for="col in element.columns" :key="col.label">{{ col.fieldPath }}</td>
            </tr>
          </tbody>
        </table>
      </template>
      <template v-else-if="element.type === 'image'">
        <img v-if="element.imageData" :src="element.imageData" class="image-preview" alt="" />
        <div v-else class="image-placeholder">No image</div>
      </template>
    </div>
    <div v-if="selected && !autoFitsContent" class="resize-handle" @pointerdown="onResizeStart"></div>
  </div>
</template>

<style scoped>
.canvas-element {
  position: absolute;
  box-sizing: border-box;
  border: 2px dashed #a3adc2;
  background: rgba(79, 109, 245, 0.06);
  cursor: move;
  user-select: none;
  overflow: hidden;
}
.canvas-element.selected {
  border-style: solid;
  border-color: var(--color-primary);
}
.element-body {
  padding: 2px 4px;
  pointer-events: none;
  height: 100%;
  box-sizing: border-box;
  white-space: nowrap;
}
.table-preview {
  white-space: normal;
  border-collapse: collapse;
  width: 100%;
  font-size: 0.85em;
  color: var(--color-text-muted);
}
.table-preview th,
.table-preview td {
  border: 1px solid var(--color-border);
  padding: 2px 4px;
  text-align: left;
}
.no-padding {
  padding: 0;
}
.image-preview {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-faint);
  font-size: 0.85em;
}
.resize-handle {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 10px;
  height: 10px;
  background: var(--color-primary);
  border-radius: 2px;
  cursor: nwse-resize;
}
</style>
