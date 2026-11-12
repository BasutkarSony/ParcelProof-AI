import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ShipmentsManifestView } from '../main.jsx'

vi.mock('../style.css', () => ({ default: {} }))

const paidOrder = {
  order_id: 'SHP-1001',
  checkout_order_id: 'CHECKOUT-1001',
  status: 'ON_HOLD',
  buyer_name: 'Test buyer',
  amount: 18,
  currency: 'USD',
}

const draftManifest = {
  id: 'manifest-1001',
  shipment_order_id: 'SHP-1001',
  status: 'DRAFT',
  manifest_hash: null,
  items: [
    { id: 'item-1', sku: 'MUG-001', description: 'Ceramic coffee mug, blue botanical design', expected_qty: 1 },
    { id: 'item-2', sku: 'BOX-001', description: 'Protective gift box', expected_qty: 1 },
  ],
}

const finalizedManifest = { ...draftManifest, status: 'FINALIZED', manifest_hash: 'sha256-example' }

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(data),
})

describe('Paid order item confirmation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows paid order items and finalizes them with one action', async () => {
    const navigateTo = vi.fn()
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (String(url).includes('/api/shipments/SHP-1001/manifest') && options.method !== 'POST') {
        return jsonResponse(draftManifest)
      }
      if (String(url).includes('/api/manifests/manifest-1001/finalize') && options.method === 'POST') {
        return jsonResponse(finalizedManifest)
      }
      return jsonResponse({ detail: 'Not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ShipmentsManifestView
        orders={[paidOrder]}
        activeShipmentId="SHP-1001"
        navigateTo={navigateTo}
      />
    )

    expect(await screen.findByRole('heading', { name: 'Are these the right items?' })).toBeInTheDocument()
    expect(screen.getByText('Ceramic coffee mug, blue botanical design')).toBeInTheDocument()
    expect(screen.getByText('Protective gift box')).toBeInTheDocument()
    expect(screen.queryByLabelText(/SKU/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Unit value/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Dispatch Notes/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Items look right — continue/ }))

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith('/packing', {
        shipmentId: 'SHP-1001',
        manifest: finalizedManifest,
      })
    })
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
  })
})
