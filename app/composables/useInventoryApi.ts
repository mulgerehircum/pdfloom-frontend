export interface Product {
  _id: string
  name: string
  sku: string
  category?: string
  quantity: number
  unitPrice: number
  lowStockThreshold: number
  createdAt: string
  updatedAt: string
}

export interface StockMovement {
  _id: string
  product: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  reason?: string
  createdAt: string
}

export interface CreateProductPayload {
  name: string
  sku: string
  category?: string
  quantity?: number
  unitPrice: number
  lowStockThreshold?: number
}

export interface CreateMovementPayload {
  product: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  reason?: string
}

export function useInventoryApi() {
  const { public: { apiBase } } = useRuntimeConfig()

  const fetchProducts = () => $fetch<Product[]>(`${apiBase}/products`)

  const fetchLowStock = () => $fetch<Product[]>(`${apiBase}/products/low-stock`)

  const createProduct = (payload: CreateProductPayload) =>
    $fetch<Product>(`${apiBase}/products`, { method: 'POST', body: payload })

  const deleteProduct = (id: string) => $fetch(`${apiBase}/products/${id}`, { method: 'DELETE' })

  const recordMovement = (payload: CreateMovementPayload) =>
    $fetch<StockMovement>(`${apiBase}/stock/movements`, { method: 'POST', body: payload })

  const fetchMovements = (productId: string) => $fetch<StockMovement[]>(`${apiBase}/stock/movements/${productId}`)

  const stockPdfUrl = () => `${apiBase}/reports/stock-pdf`

  return { fetchProducts, fetchLowStock, createProduct, deleteProduct, recordMovement, fetchMovements, stockPdfUrl }
}
