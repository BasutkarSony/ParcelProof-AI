import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PackingStationView } from '../main.jsx'

vi.mock('../style.css', () => ({ default: {} }))

const mockOrder = {
  order_id: 'ORD-1001',
  checkout_order_id: 'CHECKOUT-1001',
  status: 'SHIPPED',
  carrier: 'OTHER',
  tracking_number: 'DEMO123456',
  amount: 149,
  currency: 'USD',
  transaction_id: 'CAPTURE-1001',
}

const mockManifest = {
  id: 'manifest-1',
  status: 'FINALIZED',
  shipment_order_id: 'ORD-1001',
  manifest_hash: 'abc123',
  items: [{ description: 'Test item', expected_qty: 1 }],
}

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
})

function setupPackingStation(inspectionResponses) {
  const responses = [...inspectionResponses]
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (String(url).includes('/api/shipments/ORD-1001/manifest')) {
      return jsonResponse(mockManifest)
    }
    if (String(url).includes('/api/manifests/manifest-1/inspections') && options.method === 'POST') {
      return responses.shift() || jsonResponse({ detail: 'Unexpected inspection request' }, 500)
    }
    return jsonResponse({ detail: 'Not found' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)

  const navigateTo = vi.fn()
  render(
    <PackingStationView
      orders={[mockOrder]}
      activeShipmentId="ORD-1001"
      setActiveShipmentId={vi.fn()}
      navigateTo={navigateTo}
    />
  )

  return { fetchMock, navigateTo }
}

async function selectPhoto() {
  const file = new File(['packing-photo'], 'packing.jpg', { type: 'image/jpeg' })
  const input = document.getElementById('packing-photo-input')
  await waitFor(() => expect(input).toBeEnabled())
  fireEvent.change(input, { target: { files: [file] } })
  expect(await screen.findByText('1 / 5 Photos')).toBeInTheDocument()
}

describe('AI inspection retry behavior', () => {
  beforeEach(() => {
    const NativeURL = globalThis.URL
    class TestURL extends NativeURL {
      static createObjectURL = vi.fn(() => 'blob:packing-photo')
      static revokeObjectURL = vi.fn()
    }
    vi.stubGlobal('URL', TestURL)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('offers retry after HTTP 503 and succeeds when retried', async () => {
    const { fetchMock, navigateTo } = setupPackingStation([
      jsonResponse({ detail: 'Gemini service is temporarily unavailable' }, 503),
      jsonResponse({
        id: 'inspection-1',
        inspection_id: 'inspection-1',
        inspection_status: 'PENDING_HUMAN_REVIEW',
        photo_count: 1,
        model_used: 'gemini-3.8-flash',
      }, 201),
    ])

    expect(await screen.findByRole('heading', { name: 'Pack this order' })).toBeInTheDocument()
    await selectPhoto()
    fireEvent.click(screen.getByRole('button', { name: 'Check this order' }))

    expect(await screen.findByText('Gemini service is temporarily unavailable')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry Inspection' }))

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith('/inspections', { shipmentId: 'ORD-1001' })
    })
    expect(screen.queryByRole('button', { name: 'Retry Inspection' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2)
  })

  it('labels HTTP 429 as a quota/rate-limit retry and succeeds after the user retries', async () => {
    const { fetchMock, navigateTo } = setupPackingStation([
      jsonResponse({ detail: 'Gemini rate limit or quota was reached (HTTP 429). Wait for the quota reset.' }, 429),
      jsonResponse({
        id: 'inspection-2',
        inspection_id: 'inspection-2',
        inspection_status: 'PENDING_HUMAN_REVIEW',
        photo_count: 1,
        model_used: 'gemini-3.8-flash',
      }, 201),
    ])

    expect(await screen.findByRole('heading', { name: 'Pack this order' })).toBeInTheDocument()
    await selectPhoto()
    fireEvent.click(screen.getByRole('button', { name: 'Check this order' }))

    expect(await screen.findByText(/HTTP 429/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry after limit resets' }))

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith('/inspections', { shipmentId: 'ORD-1001' })
    })
    expect(screen.queryByRole('button', { name: 'Retry after limit resets' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2)
  })

  it.each([
    [422, 'Manifest is not finalized'],
    [409, 'An inspection is already in progress'],
  ])('does not offer retry for HTTP %i validation/conflict errors', async (status, detail) => {
    const { navigateTo } = setupPackingStation([jsonResponse({ detail }, status)])

    expect(await screen.findByRole('heading', { name: 'Pack this order' })).toBeInTheDocument()
    await selectPhoto()
    fireEvent.click(screen.getByRole('button', { name: 'Check this order' }))

    expect(await screen.findByText(detail)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry Inspection' })).not.toBeInTheDocument()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('shows an HTTP recovery message when the 503 response body is empty', async () => {
    setupPackingStation([{
      ok: false,
      status: 503,
      text: async () => '',
    }])

    expect(await screen.findByRole('heading', { name: 'Pack this order' })).toBeInTheDocument()
    await selectPhoto()
    fireEvent.click(screen.getByRole('button', { name: 'Check this order' }))

    expect(await screen.findByText(/HTTP 503/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry Inspection' })).toBeInTheDocument()
  })
})
