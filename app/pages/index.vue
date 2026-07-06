<script setup lang="ts">
import type { CreateProductPayload, Product, UpdateProductPayload } from '~/composables/useInventoryApi'

const { fetchProducts, createProduct, updateProduct, deleteProduct, recordMovement } = useInventoryApi()

const products = ref<Product[]>([])
const loadError = ref('')
const isLoading = ref(false)
// Only the very first load replaces the table with a "Loading…" line. Every later refresh
// (after creating a product or recording a movement) keeps the existing table on screen
// instead of swapping it out and back in, which was causing everything below it to jump
// up and down each time.
const hasLoadedOnce = ref(false)

async function loadProducts() {
  isLoading.value = !hasLoadedOnce.value
  loadError.value = ''
  try {
    products.value = await fetchProducts()
  } catch (err) {
    loadError.value = 'Could not reach the inventory API. Is it running on the configured URL?'
  } finally {
    isLoading.value = false
    hasLoadedOnce.value = true
  }
}

onMounted(loadProducts)

const newProduct = reactive<CreateProductPayload>({
  name: '',
  sku: '',
  category: '',
  quantity: 0,
  unitPrice: 0,
  lowStockThreshold: 5
})
const createError = ref('')
const showAddModal = ref(false)
const newProductErrors = reactive({ name: '', sku: '', unitPrice: '' })

function openAddModal() {
  createError.value = ''
  newProductErrors.name = ''
  newProductErrors.sku = ''
  newProductErrors.unitPrice = ''
  showAddModal.value = true
}

function closeAddModal() {
  showAddModal.value = false
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && showAddModal.value) closeAddModal()
}

onMounted(() => window.addEventListener('keydown', handleEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', handleEscape))

// Name/SKU/Unit price are the only required fields — Quantity and Low stock threshold are
// plain numbers that default to a valid value (0 / 5), so there's nothing to reject there.
function validateNewProduct(): boolean {
  newProductErrors.name = newProduct.name.trim() ? '' : 'Name is required.'
  newProductErrors.sku = newProduct.sku.trim() ? '' : 'SKU is required.'
  newProductErrors.unitPrice = typeof newProduct.unitPrice === 'number' && newProduct.unitPrice >= 0 ? '' : 'Unit price is required.'
  return !newProductErrors.name && !newProductErrors.sku && !newProductErrors.unitPrice
}

async function handleCreateProduct() {
  createError.value = ''
  if (!validateNewProduct()) return
  try {
    await createProduct(newProduct)
    newProduct.name = ''
    newProduct.sku = ''
    newProduct.category = ''
    newProduct.quantity = 0
    newProduct.unitPrice = 0
    newProduct.lowStockThreshold = 5
    showAddModal.value = false
    await loadProducts()
  } catch (err: any) {
    createError.value = err?.data?.message?.toString() ?? 'Failed to create product'
  }
}

async function handleDelete(id: string, name: string) {
  if (!confirm(`Delete "${name}"? This can't be undone.`)) return
  await deleteProduct(id)
  await loadProducts()
}

function isLowStock(product: Product) {
  return product.quantity <= product.lowStockThreshold
}

const searchQuery = ref('')

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return products.value
  return products.value.filter(
    (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q)
  )
})

// Grouping (and the summary line's counts/value below) intentionally reuses the existing
// per-product lowStockThreshold rule rather than a hardcoded "quantity === 0" — the redesign
// reorganizes how the same data is presented, it doesn't change what counts as low stock.
const restockingProducts = computed(() => filteredProducts.value.filter(isLowStock))
const inStockProducts = computed(() => filteredProducts.value.filter((p) => !isLowStock(p)))

// One shape for both swimlanes so the template renders them from a single v-for instead of
// duplicating the group-header + row-list markup twice.
const groups = computed(() => [
  { key: 'restocking', label: 'Needs restocking', tone: 'danger' as const, products: restockingProducts.value },
  { key: 'instock', label: 'In stock', tone: 'primary' as const, products: inStockProducts.value }
])

// Summary line describes the whole inventory, not just the current search's matches.
const totalCount = computed(() => products.value.length)
const restockingCount = computed(() => products.value.filter(isLowStock).length)
const inventoryValue = computed(() => products.value.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0))

// UI preference, not server data — cookie (not localStorage) keeps it consistent with how
// theme is persisted elsewhere in this app, and avoids an SSR/client hydration mismatch.
const density = useCookie<'compact' | 'cozy'>('productDensity', { default: () => 'cozy' })

// Only one row's action panel (edit or adjust) is open at a time.
const expandedProductId = ref<string | null>(null)
const expandedMode = ref<'edit' | 'adjust' | null>(null)

function isExpanded(product: Product, mode: 'edit' | 'adjust') {
  return expandedProductId.value === product._id && expandedMode.value === mode
}

const editForm = reactive<UpdateProductPayload>({})
const editError = ref('')

function openEdit(product: Product) {
  expandedProductId.value = product._id
  expandedMode.value = 'edit'
  editError.value = ''
  editForm.name = product.name
  editForm.category = product.category ?? ''
  editForm.unitPrice = product.unitPrice
  editForm.lowStockThreshold = product.lowStockThreshold
}

async function handleSaveEdit(id: string) {
  editError.value = ''
  try {
    await updateProduct(id, editForm)
    expandedProductId.value = null
    expandedMode.value = null
    await loadProducts()
  } catch (err: any) {
    editError.value = err?.data?.message?.toString() ?? 'Failed to update product'
  }
}

const adjustForm = reactive({ type: 'IN' as 'IN' | 'OUT' | 'ADJUSTMENT', quantity: 1, reason: '' })
const adjustError = ref('')

function openAdjust(product: Product) {
  expandedProductId.value = product._id
  expandedMode.value = 'adjust'
  adjustError.value = ''
  adjustForm.type = 'IN'
  adjustForm.quantity = 1
  adjustForm.reason = ''
}

async function handleRecordMovement(productId: string) {
  adjustError.value = ''
  try {
    await recordMovement({ product: productId, type: adjustForm.type, quantity: adjustForm.quantity, reason: adjustForm.reason })
    expandedProductId.value = null
    expandedMode.value = null
    await loadProducts()
  } catch (err: any) {
    adjustError.value = err?.data?.message?.toString() ?? 'Failed to record movement'
  }
}

function closeExpanded() {
  expandedProductId.value = null
  expandedMode.value = null
}
</script>

<template>
  <main class="page">
    <h1>Inventory Manager</h1>
    <p class="summary-line">
      {{ totalCount }} products ·
      <span class="summary-restock">{{ restockingCount }} need restocking</span>
      · ${{ inventoryValue.toFixed(2) }} in stock value
    </p>

    <p v-if="isLoading" class="hint-text">Loading…</p>
    <p v-else-if="loadError" class="error-text">{{ loadError }}</p>

    <template v-else>
      <div class="toolbar">
        <div class="search-field">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input v-model="searchQuery" class="search-input" placeholder="Search products…" aria-label="Search products" />
        </div>
        <div class="density-toggle" role="group" aria-label="Row density">
          <button type="button" class="density-btn" :class="{ active: density === 'compact' }" @click="density = 'compact'">Compact</button>
          <button type="button" class="density-btn" :class="{ active: density === 'cozy' }" @click="density = 'cozy'">Cozy</button>
        </div>
        <button class="btn btn-primary add-product-btn" @click="openAddModal">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add product
        </button>
      </div>

      <div class="column-header-row">
        <div class="col-header">Product</div>
        <div class="col-header">Category</div>
        <div class="col-header col-header-center">Quantity</div>
        <div class="col-header col-header-right">Price</div>
        <div class="col-header"></div>
      </div>

      <div v-for="group in groups" :key="group.key" class="product-group">
        <div class="group-header">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="`var(--color-${group.tone})`" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
          <span class="group-label">{{ group.label }}</span>
          <span class="badge" :class="group.tone === 'danger' ? 'badge-danger' : 'badge-success'">{{ group.products.length }}</span>
        </div>

        <template v-for="product in group.products" :key="product._id">
          <ProductRow
            :product="product"
            :density="density"
            @edit="openEdit(product)"
            @adjust="openAdjust(product)"
            @delete="handleDelete(product._id, product.name)"
          />
          <div v-if="isExpanded(product, 'edit')" class="expanded-row">
            <form class="inline-form" @submit.prevent="handleSaveEdit(product._id)">
              <input v-model="editForm.name" class="field-input inline-form-name" placeholder="Name" required />
              <input v-model="editForm.category" class="field-input inline-form-category" placeholder="Category" />
              <input
                v-model.number="editForm.unitPrice"
                type="number"
                min="0"
                step="0.01"
                class="field-input inline-form-price"
                placeholder="Price"
                required
              />
              <!-- Not in the handoff's field list (Name/Category/Price only) — kept because
                   it's not editable anywhere else, and it's what the grouping rule reads. -->
              <input
                v-model.number="editForm.lowStockThreshold"
                type="number"
                min="0"
                class="field-input inline-form-threshold"
                placeholder="Low stock threshold"
                title="Low stock threshold"
              />
              <button type="submit" class="btn btn-primary btn-sm">Save</button>
              <button type="button" class="btn btn-secondary btn-sm" @click="closeExpanded">Cancel</button>
            </form>
            <p v-if="editError" class="error-text">{{ editError }}</p>
          </div>
          <div v-if="isExpanded(product, 'adjust')" class="expanded-row">
            <form class="inline-form" @submit.prevent="handleRecordMovement(product._id)">
              <AppSelect v-model="adjustForm.type" class="inline-form-type" :options="['IN', 'OUT']" />
              <input
                v-model.number="adjustForm.quantity"
                type="number"
                min="1"
                class="field-input inline-form-qty"
                placeholder="Quantity"
                required
              />
              <input v-model="adjustForm.reason" class="field-input inline-form-reason" placeholder="Reason (optional)" />
              <button type="submit" class="btn btn-primary btn-sm">Record</button>
              <button type="button" class="btn btn-secondary btn-sm" @click="closeExpanded">Cancel</button>
            </form>
            <p v-if="adjustError" class="error-text">{{ adjustError }}</p>
          </div>
        </template>

        <p v-if="!group.products.length" class="hint-text empty-group">
          {{ products.length ? 'No matches.' : 'No products yet — add one above.' }}
        </p>
      </div>

      <div class="page-footer">
        <ReportTemplatePicker />
      </div>
    </template>

    <div v-if="showAddModal" class="modal-overlay" @click.self="closeAddModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Add product</h2>
          <button class="btn btn-secondary btn-sm" @click="closeAddModal">Close</button>
        </div>
        <form class="add-product-form" @submit.prevent="handleCreateProduct">
          <div class="field-group">
            <label>Name <span class="required-asterisk">*</span></label>
            <input v-model="newProduct.name" class="field-input" placeholder="e.g. Widget" />
            <p v-if="newProductErrors.name" class="error-text">{{ newProductErrors.name }}</p>
          </div>

          <div class="field-row field-row-2">
            <div class="field-group">
              <label>SKU <span class="required-asterisk">*</span></label>
              <input v-model="newProduct.sku" class="field-input field-input-mono" placeholder="WID-1" />
              <p v-if="newProductErrors.sku" class="error-text">{{ newProductErrors.sku }}</p>
            </div>
            <div class="field-group">
              <label>Category</label>
              <input v-model="newProduct.category" class="field-input" placeholder="Optional" />
            </div>
          </div>

          <div class="field-row field-row-3">
            <div class="field-group">
              <label>Quantity</label>
              <input v-model.number="newProduct.quantity" type="number" min="0" class="field-input" />
            </div>
            <div class="field-group">
              <label>Price <span class="required-asterisk">*</span></label>
              <div class="price-input-wrap">
                <span class="price-prefix">$</span>
                <input v-model.number="newProduct.unitPrice" type="number" min="0" step="0.01" class="field-input price-input" />
              </div>
              <p v-if="newProductErrors.unitPrice" class="error-text">{{ newProductErrors.unitPrice }}</p>
            </div>
            <div class="field-group">
              <label title="Low stock threshold">Low stock at</label>
              <input v-model.number="newProduct.lowStockThreshold" type="number" min="0" class="field-input" />
            </div>
          </div>

          <div class="required-legend">
            <span class="required-asterisk">*</span>
            <span>Required field</span>
          </div>

          <button type="submit" class="btn btn-primary add-product-submit">Create</button>
        </form>
        <p v-if="createError" class="error-text">{{ createError }}</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.page {
  max-width: 740px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}
h1 {
  margin: 0;
}
.summary-line {
  margin: var(--space-2) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.summary-restock {
  color: var(--color-danger);
  font-weight: 600;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-5) 0 var(--space-5);
}
.search-field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-faint);
}
.search-field:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}
.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--text-sm);
}
.search-input::placeholder {
  color: var(--color-text-faint);
}
.density-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}
.density-btn {
  padding: 6px var(--space-3);
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
}
.density-btn.active {
  background: var(--color-primary);
  color: var(--color-primary-contrast);
}
.add-product-btn {
  white-space: nowrap;
  border-radius: var(--radius-md);
}

.column-header-row {
  display: grid;
  grid-template-columns: 1.8fr 1fr 120px 76px 112px;
  column-gap: var(--space-3);
  padding: 0 4px var(--space-2);
}
.col-header {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-faint);
}
.col-header-center {
  text-align: center;
}
.col-header-right {
  text-align: right;
}

.product-group {
  margin-bottom: var(--space-4);
}
.group-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 4px;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}
.group-label {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text);
}
.empty-group {
  padding: var(--space-3) 4px;
}

.expanded-row {
  padding: var(--space-3) 4px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}
.inline-form {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.inline-form-name {
  flex: 1.5;
}
.inline-form-category {
  flex: 1;
}
.inline-form-price {
  width: 84px;
  flex-shrink: 0;
}
.inline-form-threshold {
  width: 100px;
  flex-shrink: 0;
}
.inline-form-type {
  flex-shrink: 0;
}
.inline-form-qty {
  width: 90px;
  flex-shrink: 0;
}
.inline-form-reason {
  flex: 1;
}
.form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}
.qty-input {
  width: 130px;
}
.form-vertical {
  flex-direction: column;
  align-items: stretch;
}
.form-vertical .field-input {
  width: 100%;
}
.success-text {
  color: var(--color-success);
  font-size: var(--text-sm);
}

.add-product-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.add-product-form .field-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.add-product-form label {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}
.add-product-form .field-input {
  width: 100%;
}
.field-input-mono {
  font-family: ui-monospace, Menlo, monospace;
}
.required-asterisk {
  color: var(--color-danger);
  font-size: var(--text-xs);
}
.field-row {
  display: grid;
  gap: var(--space-3);
}
.field-row-2 {
  grid-template-columns: 1fr 1fr;
}
.field-row-3 {
  grid-template-columns: 1fr 1fr 1fr;
}
.price-input-wrap {
  position: relative;
}
.price-prefix {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--text-sm);
  color: var(--color-text-faint);
  pointer-events: none;
}
.price-input {
  padding-left: 20px !important;
}
.required-legend {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: -4px;
}
.required-legend span:last-child {
  font-size: 11.5px;
  color: var(--color-text-faint);
}
.add-product-submit {
  width: 100%;
}

.page-footer {
  padding-top: var(--space-3);
}
</style>
