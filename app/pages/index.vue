<script setup lang="ts">
import type { CreateMovementPayload, CreateProductPayload, Product } from '~/composables/useInventoryApi'

const { fetchProducts, createProduct, deleteProduct, recordMovement, stockPdfUrl } = useInventoryApi()

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

async function handleCreateProduct() {
  createError.value = ''
  try {
    await createProduct(newProduct)
    newProduct.name = ''
    newProduct.sku = ''
    newProduct.category = ''
    newProduct.quantity = 0
    newProduct.unitPrice = 0
    newProduct.lowStockThreshold = 5
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

const movement = reactive<CreateMovementPayload>({ product: '', type: 'IN', quantity: 1, reason: '' })
const movementError = ref('')
const movementSuccess = ref('')

async function handleRecordMovement() {
  movementError.value = ''
  movementSuccess.value = ''
  try {
    await recordMovement(movement)
    movementSuccess.value = `Recorded ${movement.type} of ${movement.quantity} unit(s)`
    movement.quantity = 1
    movement.reason = ''
    await loadProducts()
  } catch (err: any) {
    movementError.value = err?.data?.message?.toString() ?? 'Failed to record movement'
  }
}

function isLowStock(product: Product) {
  return product.quantity <= product.lowStockThreshold
}
</script>

<template>
  <main class="page">
    <div class="page-header">
      <h1>Inventory Manager</h1>
      <NuxtLink class="btn btn-secondary" to="/templates">PDF Templates &rarr;</NuxtLink>
    </div>

    <section class="panel card">
      <h2>Products</h2>
      <p v-if="isLoading" class="hint-text">Loading…</p>
      <p v-else-if="loadError" class="error-text">{{ loadError }}</p>
      <table v-else class="table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Name</th>
            <th>Category</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product._id">
            <td>{{ product.sku }}</td>
            <td>{{ product.name }}</td>
            <td>{{ product.category || '-' }}</td>
            <td>{{ product.quantity }}</td>
            <td>{{ product.unitPrice.toFixed(2) }}</td>
            <td>
              <span class="badge" :class="isLowStock(product) ? 'badge-danger' : 'badge-success'">
                {{ isLowStock(product) ? 'Low stock' : 'OK' }}
              </span>
            </td>
            <td><button class="btn btn-danger btn-sm" @click="handleDelete(product._id, product.name)">Delete</button></td>
          </tr>
          <tr v-if="!products.length">
            <td colspan="7" class="hint-text">No products yet — add one below.</td>
          </tr>
        </tbody>
      </table>

      <a class="btn btn-secondary" :href="stockPdfUrl()" target="_blank" rel="noopener">Download stock report (PDF)</a>
    </section>

    <section class="panel card">
      <h2>Add product</h2>
      <form class="form" @submit.prevent="handleCreateProduct">
        <input v-model="newProduct.name" class="field-input" placeholder="Name" required />
        <input v-model="newProduct.sku" class="field-input" placeholder="SKU" required />
        <input v-model="newProduct.category" class="field-input" placeholder="Category" />
        <input v-model.number="newProduct.quantity" type="number" min="0" class="field-input qty-input" placeholder="Quantity" />
        <input
          v-model.number="newProduct.unitPrice"
          type="number"
          min="0"
          step="0.01"
          class="field-input qty-input"
          placeholder="Unit price"
          required
        />
        <input
          v-model.number="newProduct.lowStockThreshold"
          type="number"
          min="0"
          class="field-input qty-input"
          placeholder="Low stock threshold"
        />
        <button type="submit" class="btn btn-primary">Create</button>
      </form>
      <p v-if="createError" class="error-text">{{ createError }}</p>
    </section>

    <section class="panel card">
      <h2>Record stock movement</h2>
      <form class="form" @submit.prevent="handleRecordMovement">
        <select v-model="movement.product" class="field-input" required>
          <option value="" disabled>Select product</option>
          <option v-for="product in products" :key="product._id" :value="product._id">
            {{ product.sku }} - {{ product.name }}
          </option>
        </select>
        <select v-model="movement.type" class="field-input">
          <option value="IN">IN</option>
          <option value="OUT">OUT</option>
          <option value="ADJUSTMENT">ADJUSTMENT</option>
        </select>
        <input v-model.number="movement.quantity" type="number" min="1" class="field-input qty-input" placeholder="Quantity" required />
        <input v-model="movement.reason" class="field-input" placeholder="Reason (optional)" />
        <button type="submit" class="btn btn-primary">Record</button>
      </form>
      <p v-if="movementError" class="error-text">{{ movementError }}</p>
      <p v-if="movementSuccess" class="success-text">{{ movementSuccess }}</p>
    </section>
  </main>
</template>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
}
.panel {
  margin-bottom: var(--space-5);
  padding: var(--space-5);
}
.panel h2 {
  margin-bottom: var(--space-4);
}
.table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-4);
}
.table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
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
.form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}
.qty-input {
  width: 130px;
}
.success-text {
  color: var(--color-success);
  font-size: var(--text-sm);
}
</style>
