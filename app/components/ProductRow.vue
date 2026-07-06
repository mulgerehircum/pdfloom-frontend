<script setup lang="ts">
import type { Product } from '~/composables/useInventoryApi'

defineProps<{
  product: Product
  density: 'compact' | 'cozy'
}>()

defineEmits<{
  edit: []
  adjust: []
  delete: []
}>()
</script>

<template>
  <div class="product-row" :class="density">
    <div class="product-cell">
      <div class="product-name">{{ product.name }}</div>
      <div class="product-sku">{{ product.sku }}</div>
    </div>
    <div class="category-cell">{{ product.category || '-' }}</div>
    <div class="qty-cell">{{ product.quantity }}</div>
    <div class="price-cell">${{ product.unitPrice.toFixed(2) }}</div>
    <div class="row-actions-cell">
      <button type="button" class="row-icon-btn" title="Edit product" aria-label="Edit product" @click="$emit('edit')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button type="button" class="row-icon-btn" title="Adjust stock" aria-label="Adjust stock" @click="$emit('adjust')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <line x1="4" y1="6" x2="20" y2="6" />
          <circle cx="14" cy="6" r="2" fill="currentColor" stroke="none" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <circle cx="8" cy="12" r="2" fill="currentColor" stroke="none" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="16" cy="18" r="2" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <button type="button" class="row-icon-btn danger" title="Delete" aria-label="Delete" @click="$emit('delete')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.product-row {
  display: grid;
  grid-template-columns: 1.8fr 1fr 120px 76px 112px;
  column-gap: var(--space-3);
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  /* Density controls vertical rhythm only — never font sizes or column widths. */
  padding: var(--space-3) 4px;
}
.product-row.compact {
  padding: 6px 4px;
}
.product-name {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-text);
}
.product-sku {
  font: var(--text-xs) ui-monospace, Menlo, monospace;
  color: var(--color-text-faint);
  margin-top: 3px;
}
.category-cell {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.qty-cell {
  /* Read-only — quantity only ever changes through the "Adjust stock" form below, so every
     change is a deliberate, auditable movement rather than a silent inline overwrite. */
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}
.price-cell {
  font-size: var(--text-sm);
  color: var(--color-text);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.row-actions-cell {
  display: flex;
  gap: 5px;
  justify-content: flex-end;
}
.row-icon-btn {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.row-icon-btn:hover {
  background: var(--color-bg);
  color: var(--color-text);
}
.row-icon-btn.danger {
  border-color: var(--color-danger-soft);
  color: var(--color-danger);
}
.row-icon-btn.danger:hover {
  background: var(--color-danger-soft);
}
</style>
