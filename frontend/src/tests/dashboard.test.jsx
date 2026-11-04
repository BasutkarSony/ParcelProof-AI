import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from '../main.jsx'

vi.mock('../style.css', () => ({ default: {} }))

const mockOrders = [
  {
    order_id: 'ORD-1001',
    status: 'SHIPPED',
    carrier: 'OTHER',
    tracking_number: 'DEMO123456',
    amount: 149,
    currency: 'USD',
    transaction_id: 'CAPTURE-1001',
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

    expect((await screen.findAllByText('ORD-1001')).length).toBeGreaterThan(0)
    expect(screen.getByText('SHIPMENTS IN QUEUE')).toBeInTheDocument()
    expect(screen.getByText('DATA-QUALITY VALIDATED')).toBeInTheDocument()
  })
})
