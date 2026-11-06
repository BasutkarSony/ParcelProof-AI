import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ExportDocumentWorkflow } from '../main.jsx'

vi.mock('../style.css', () => ({ default: {} }))

const shipment = {
  order_id: 'SHP-TEST-01',
  checkout_order_id: 'checkout-01',
  paypal_capture_id: 'capture-01',
  transaction_id: 'capture-01',
  amount: 12.5,
  currency: 'USD'
}

const documentRecord = {
  document_id: 'document-01',
  shipment_order_id: 'SHP-TEST-01',
  document_type: 'COMMERCIAL_INVOICE',
  document_status: 'AWAITING_REVIEW',
  extraction_status: 'NOT_CONFIGURED',
  original_filename: 'invoice.pdf',
  mime_type: 'application/pdf',
  size_bytes: 128,
  sha256: 'a'.repeat(64),
  extracted_data: null,
  confirmed_data: null,
  extraction_error: null,
  created_at: '2026-11-06T12:00:00Z'
}

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(data)
})

describe('Export document workflow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/documents')) return jsonResponse({ documents: [] })
      if (String(url).endsWith('/reconciliations')) return jsonResponse({ reconciliations: [] })
      return jsonResponse({ detail: 'Not found' }, 404)
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uploads, confirms and reconciles an export document through the shipment workflow', async () => {
    const fetchMock = globalThis.fetch
    const file = new File(['%PDF-1.4 test'], 'invoice.pdf', { type: 'application/pdf' })

    fetchMock.mockImplementation(async (url, options = {}) => {
      if (String(url).endsWith('/documents') && options.method === 'POST') {
        return jsonResponse({
          document: documentRecord,
          message: 'The original document is saved. Enter fields manually or configure Gemini to extract a draft.'
        }, 201)
      }
      if (String(url).endsWith('/confirm') && options.method === 'PUT') {
        const body = JSON.parse(options.body)
        return jsonResponse({
          ...documentRecord,
          document_status: 'CONFIRMED',
          confirmed_data: { ...body.document, merchant_confirmed: true },
          reviewer_label: 'Merchant'
        })
      }
      if (String(url).endsWith('/reconcile') && options.method === 'POST') {
        return jsonResponse({
          reconciliation_id: 'run-01',
          overall_status: 'REVIEW_REQUIRED',
          summary: { matched: 2, mismatches: 0, not_checked: 1 },
          checks: [],
          findings: [],
          engine_version: '0.1.0'
        })
      }
      if (String(url).endsWith('/documents')) return jsonResponse({ documents: [documentRecord] })
      if (String(url).endsWith('/reconciliations')) return jsonResponse({ reconciliations: [] })
      return jsonResponse({ detail: 'Not found' }, 404)
    })

    render(<ExportDocumentWorkflow shipment={shipment} />)

    expect(await screen.findByText(/No export document has been added/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Choose document/), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload document' }))

    expect(await screen.findByText('Manual field entry')).toBeInTheDocument()
    expect(await screen.findByText('invoice.pdf')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Recipient name'), { target: { value: 'Test Buyer' } })
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm document fields' }))

    await waitFor(() => expect(screen.getByText('Merchant-confirmed fields saved.')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Run reconciliation' }))

    expect(await screen.findByText('REVIEW REQUIRED')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url, options]) => (
      String(url).endsWith('/reconcile') && options?.method === 'POST'
    ))).toBe(true)
  })

  it('keeps reconciliation disabled until the merchant confirms the extracted fields', async () => {
    const extracted = {
      ...documentRecord,
      extraction_status: 'EXTRACTED',
      extracted_data: {
        document_type: 'COMMERCIAL_INVOICE',
        document_number: 'INV-01',
        currency: 'USD',
        total_amount: '12.50',
        recipient_name: 'Buyer',
        recipient_address: {},
        items: [{ sku: 'SKU-1', description: 'Notebook', quantity: 1 }],
        extraction_notes: [],
        merchant_confirmed: false
      }
    }
    globalThis.fetch.mockImplementation(async (url) => {
      if (String(url).endsWith('/documents')) return jsonResponse({ documents: [extracted] })
      if (String(url).endsWith('/reconciliations')) return jsonResponse({ reconciliations: [] })
      return jsonResponse({ detail: 'Not found' }, 404)
    })

    render(<ExportDocumentWorkflow shipment={shipment} />)
    expect(await screen.findByText('invoice.pdf')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run reconciliation' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm document fields' }))
  })
})
