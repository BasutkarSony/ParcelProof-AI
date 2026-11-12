import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PackingStationView } from '../main.jsx'

vi.mock('../style.css', () => ({ default: {} }))

describe('Packing station loading and empty states', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the paid-order loading state instead of showing an empty state too early', () => {
    render(
      <PackingStationView
        orders={[]}
        activeShipmentId={null}
        setActiveShipmentId={() => {}}
        navigateTo={() => {}}
        prefetchedManifest={null}
        workspaceLoading
      />
    )

    expect(screen.getByText('Loading your paid orders…')).toBeInTheDocument()
    expect(screen.queryByText('No paid orders ready to pack')).not.toBeInTheDocument()
  })

  it('shows the original paid product name instead of private matching instructions', async () => {
    const order = {
      order_id: 'SHP-2001',
      checkout_order_id: 'PAYPAL-2001',
      status: 'ON_HOLD',
      buyer_name: 'Demo buyer',
      amount: 18,
      currency: 'USD',
      items: [{ sku: 'MUG-001', name: 'Blue Botanical Ceramic Mug', quantity: 1 }],
    }
    const manifest = {
      id: 'manifest-2001',
      shipment_order_id: order.order_id,
      status: 'FINALIZED',
      manifest_hash: 'sha256-example',
      items: [{
        sku: 'MUG-001',
        description: 'PRIVATE MATCHING INSTRUCTIONS: inspect glaze, rim, motif placement and handle shape.',
        expected_qty: 1,
        fragile: false,
      }],
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ inspections: [] }),
    })))

    render(
      <PackingStationView
        orders={[order]}
        activeShipmentId={order.order_id}
        setActiveShipmentId={() => {}}
        navigateTo={() => {}}
        prefetchedManifest={{ shipmentId: order.order_id, manifest }}
        workspaceLoading={false}
      />
    )

    expect(await screen.findByText('Blue Botanical Ceramic Mug')).toBeInTheDocument()
    expect(screen.getByText('1x')).toBeInTheDocument()
    expect(screen.queryByText(/PRIVATE MATCHING INSTRUCTIONS/)).not.toBeInTheDocument()
  })

  it('shows a clear next step when loading is finished and no paid orders exist', () => {
    render(
      <PackingStationView
        orders={[]}
        activeShipmentId={null}
        setActiveShipmentId={() => {}}
        navigateTo={() => {}}
        prefetchedManifest={null}
        workspaceLoading={false}
      />
    )

    expect(screen.getByRole('heading', { name: 'No paid orders ready to pack' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Orders' })).toBeInTheDocument()
  })
})
