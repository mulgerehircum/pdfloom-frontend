export type ElementType = 'text' | 'field' | 'table' | 'image'

export interface TableColumn {
  label: string
  fieldPath: string
}

export interface TemplateElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  fontSize?: number
  content?: string
  fieldPath?: string
  itemsPath?: string
  columns?: TableColumn[]
  imageData?: string
}

export interface Template {
  _id: string
  name: string
  pageWidth: number
  pageHeight: number
  elements: TemplateElement[]
  compiledTemplate: string
  createdAt: string
  updatedAt: string
}

export interface SaveTemplatePayload {
  name: string
  pageWidth?: number
  pageHeight?: number
  elements: TemplateElement[]
}

export interface PreviewTemplatePayload {
  pageWidth?: number
  pageHeight?: number
  elements: TemplateElement[]
}

// Mirrors the backend's ReportContext (src/reports/reports.service.ts) — the actual data
// a {{ fieldPath }} placeholder resolves to at PDF-render time.
export interface ReportContext {
  generatedAt: string
  totalValue: string
  products: Array<Record<string, unknown>>
}

export function useTemplatesApi() {
  const { public: { apiBase } } = useRuntimeConfig()

  const fetchTemplates = () => $fetch<Template[]>(`${apiBase}/templates`)

  const fetchTemplate = (id: string) => $fetch<Template>(`${apiBase}/templates/${id}`)

  const createTemplate = (payload: SaveTemplatePayload) =>
    $fetch<Template>(`${apiBase}/templates`, { method: 'POST', body: payload })

  const updateTemplate = (id: string, payload: SaveTemplatePayload) =>
    $fetch<Template>(`${apiBase}/templates/${id}`, { method: 'PATCH', body: payload })

  const deleteTemplate = (id: string) => $fetch(`${apiBase}/templates/${id}`, { method: 'DELETE' })

  const customPdfUrl = (templateId: string) => `${apiBase}/reports/custom/${templateId}/pdf`

  const previewPdf = (payload: PreviewTemplatePayload) =>
    $fetch<Blob>(`${apiBase}/reports/preview-pdf`, { method: 'POST', body: payload, responseType: 'blob' })

  const fetchReportContext = () => $fetch<ReportContext>(`${apiBase}/reports/context`)

  const uploadImage = (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return $fetch<{ dataUri: string }>(`${apiBase}/templates/upload-image`, { method: 'POST', body: formData })
  }

  return {
    fetchTemplates,
    fetchTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    customPdfUrl,
    previewPdf,
    fetchReportContext,
    uploadImage
  }
}
