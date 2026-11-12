import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { InspectionsReviewView, PackingStationView } from '../main.jsx'

vi.mock('../style.css', () => ({ default: {} }))

const order = {
  order_id: 'SHP-1001',
  checkout_order_id: 'CHECKOUT-1001',
  status: 'ON_HOLD',
  buyer_name: 'Demo Buyer',
  amount: 18,
  currency: 'USD',
  paypal_capture_id: 'CAPTURE-1001',
}

const manifest = {
  id: 'manifest-1001',
  shipment_order_id: 'SHP-1001',
  status: 'FINALIZED',
  manifest_hash: 'sha256-manifest',
  items: [{ id: 'item-1', sku: 'MUG-001', description: 'Blue botanical mug', expected_qty: 1 }],
}

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
})

function renderReviewPage(search = '') {
  window.history.replaceState({}, '', `/inspections${search}`)
  const fetchMock = vi.fn(async url => {
    if (String(url).includes('/api/shipments/SHP-1001/manifest')) return jsonResponse(manifest)
    if (String(url).includes('/api/manifests/manifest-1001/inspections')) {
      return jsonResponse({
        inspections: [{
          inspection_id: 'inspection-1',
          inspection_status: 'PENDING_HUMAN_REVIEW',
          created_at: '2026-11-12T10:00:00Z',
          latest_review: null,
        }],
      })
    }
    if (String(url).includes('/api/inspections/inspection-1')) {
      return jsonResponse({
        inspection_id: 'inspection-1',
        manifest_id: 'manifest-1001',
        inspection_status: 'PENDING_HUMAN_REVIEW',
        photos: [],
        review_history: [],
        ai_result: {
          inspection_summary: 'One blue mug is visible.',
          item_checks: [],
          product_reference_context: [],
          image_quality: { overall: 'GOOD' },
          additional_observations: {},
          engine_metadata: {},
        },
      })
    }
    return jsonResponse({ detail: 'Not found' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  const setActiveShipmentId = vi.fn()
  render(
    <InspectionsReviewView
      orders={[order]}
      setOrders={vi.fn()}
      paypal={{ submission_enabled: false }}
      activeShipmentId="SHP-1001"
      setActiveShipmentId={setActiveShipmentId}
      navigateTo={vi.fn()}
    />
  )
  return { fetchMock, setActiveShipmentId }
}

describe('Human review correction loop', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.history.replaceState({}, '', '/')
  })

  it('requires a reason before a correction can be submitted', async () => {
    renderReviewPage()
    expect(await screen.findByRole('heading', { name: 'Does this order look right?' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Your decision' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Needs fixing' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add a note explaining what needs to be fixed before requesting a correction.'
    )
    expect(screen.getByLabelText('What needs to be fixed?')).toBeVisible()
  })

  it('restores the order and shows validation feedback after a native form redirect', async () => {
    const { setActiveShipmentId } = renderReviewPage(
      '?shipment_id=SHP-1001&inspection_id=inspection-1&review_error=Add%20a%20note'
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Add a note')
    expect(setActiveShipmentId).toHaveBeenCalledWith('SHP-1001')
    expect(screen.getByLabelText('What needs to be fixed?')).toBeVisible()
  })

  it('shows the saved correction reason when the merchant returns to packing', async () => {
    const fetchMock = vi.fn(async url => {
      if (String(url).includes('/api/shipments/SHP-1001/manifest')) return jsonResponse(manifest)
      if (String(url).includes('/api/manifests/manifest-1001/inspections')) {
        return jsonResponse({
          inspections: [{
            inspection_id: 'inspection-1',
            inspection_status: 'NEEDS_CORRECTION',
            latest_review: {
              decision: 'NEEDS_CORRECTION',
              notes: 'Replace the blue botanical design with the navy floral version.',
              reviewer_label: 'Merchant',
            },
          }],
        })
      }
      return jsonResponse({ detail: 'Not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    render(
      <PackingStationView
        orders={[order]}
        activeShipmentId="SHP-1001"
        setActiveShipmentId={vi.fn()}
        navigateTo={vi.fn()}
      />
    )

    expect(await screen.findByText(/Replace the blue botanical design with the navy floral version/)).toBeInTheDocument()
  })
})
