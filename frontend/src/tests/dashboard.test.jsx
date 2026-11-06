import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../main.jsx'

vi.mock('../style.css', () => ({ default: {} }))

const mockOrders = [
  {
    order_id: 'SHP-1001',
    checkout_order_id: 'CHECKOUT-1001',
    status: 'ON_HOLD',
    carrier: null,
    tracking_number: null,
    amount: 12.5,
    currency: 'USD',
    transaction_id: 'CAPTURE-1001',
    paypal_capture_id: 'CAPTURE-1001',
  },
  {
    order_id: 'ORD-1001',
    status: 'SHIPPED',
    carrier: 'OTHER',
    tracking_number: 'DEMO123456',
    amount: 149,
    currency: 'USD',
    transaction_id: 'SANDBOX-TXN-1001',
  },
]

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
})

describe('Dashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/api/orders')) {
        return jsonResponse({ orders: mockOrders })
      }
      if (String(url).endsWith('/api/paypal/status')) {
        return jsonResponse({ configured: false, connected: false })
      }
      return jsonResponse({ detail: 'Not found' }, 404)
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads and displays the shipment returned by the backend', async () => {
    render(<App />)

    expect(await screen.findByText('SHP-1001')).toBeInTheDocument()
    expect(screen.getByText('Make every export')).toBeInTheDocument()
    expect(screen.getByText('document match.')).toBeInTheDocument()
    expect(screen.queryByText(/Carrier events and PayPal eligibility are not currently verified/)).not.toBeInTheDocument()
    expect(screen.getByText('PAYPAL-LINKED SHIPMENTS')).toBeInTheDocument()
    expect(screen.getByText('Shipments to review')).toBeInTheDocument()
    expect(screen.queryByText('ORD-1001')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Review SHP-1001/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Sample records/ }))
    expect(await screen.findByText('ORD-1001')).toBeInTheDocument()
    expect(screen.getByText('Sample record · Not a PayPal checkout')).toBeInTheDocument()
  })
})
