<script setup lang="ts">
const props = defineProps<{
  modelValue?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [string | undefined]
}>()

// The native color swatch only round-trips plain 6-digit hex — anything else the text side
// holds (rgba(...), a bare CSS keyword like "white", 3/4/8-digit hex, all valid per the
// backend's sanitizeColor pattern) falls back to a neutral swatch rather than fighting it.
const HEX6_PATTERN = /^#[0-9a-fA-F]{6}$/
const swatchValue = computed(() => (props.modelValue && HEX6_PATTERN.test(props.modelValue) ? props.modelValue : '#000000'))

function onSwatchInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function onTextInput(event: Event) {
  const value = (event.target as HTMLInputElement).value.trim()
  emit('update:modelValue', value === '' ? undefined : value)
}
</script>

<template>
  <div class="app-color-input">
    <input type="color" class="app-color-swatch" :value="swatchValue" @input="onSwatchInput" aria-label="Pick color" />
    <input
      type="text"
      class="app-color-text"
      :value="modelValue ?? ''"
      :placeholder="placeholder ?? 'none'"
      @input="onTextInput"
    />
  </div>
</template>

<style scoped>
.app-color-input {
  display: flex;
  align-items: stretch;
  gap: var(--space-1);
}
.app-color-swatch {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
}
.app-color-swatch::-webkit-color-swatch-wrapper {
  padding: 2px;
}
.app-color-swatch::-webkit-color-swatch {
  border: none;
  border-radius: 2px;
}
.app-color-text {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, Menlo, monospace;
  font-size: var(--text-sm);
  padding: 4px var(--space-2);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
}
.app-color-text:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}
</style>
