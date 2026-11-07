import React, { useEffect, useState, useMemo, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000')

// Read API responses defensively. Reverse proxies and interrupted requests can
// return empty or non-JSON bodies; never replace the real HTTP error with a
// JSON parser exception.
async function readApiJson(response) {
  const body = await response.text()
  if (!body) return {}
  try {
    return JSON.parse(body)
  } catch {
    return {
      detail: body.slice(0, 500) || `Server returned a non-JSON response (HTTP ${response.status}).`
    }
  }
}


// ─── ParcelProof AI — unified shell across all routes ───────────────────────────
// Routes:
//   /                    Shipment Evidence Review Dashboard
//   /manifests           Shipment Management & Product Manifests
//   /packing             Packing Station & AI Vision Inspection
//   /inspections         AI Inspection Results & Human Review
//   /checkout            PayPal Sandbox Buyer Checkout
//   /checkout/return     PayPal Payment Return / Capture
//   /checkout/cancel     PayPal Payment Cancellation

// ─── Shared Icons ─────────────────────────────────────────────────────────────
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const CartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
)

const PayPalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7.5 21H3L6.75 3h6.75c2.25 0 4.5 1.5 4.5 4.5 0 4.5-3.75 6-6.75 6H9L7.5 21zm3-10.5h1.5c1.5 0 2.25-.75 2.25-2.25S13.5 6 12 6H10.5l-1.125 5.25L10.5 10.5z" opacity=".6" />
    <path d="M11.25 21H6.75L10.5 6h6.75c2.25 0 4.5 1.5 4.5 4.5 0 4.5-3.75 6-6.75 6h-2.25L11.25 21zm3-10.5h1.5c1.5 0 2.25-.75 2.25-2.25S16.5 6 15 6h-1.5L12.375 10.5l2.625.001-.75-.001z" />
  </svg>
)

const SuccessCircleIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

const CancelCircleIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
)

const SpinnerIcon = () => (
  <svg className="spinner-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
)

const ManifestIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

const CameraIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

// ─── Shared Sidebar Component ─────────────────────────────────────────────────
function Sidebar({ currentPath, ordersCount, navigateTo }) {
  const isReview = currentPath === '/'
  const isManifests = currentPath === '/manifests'
  const isPacking = currentPath === '/packing'
  const isInspections = currentPath === '/inspections'
  const isCheckout = currentPath === '/checkout' || currentPath === '/checkout/return' || currentPath === '/checkout/cancel'

  return (
    <aside className="sidebar" aria-label="Application navigation">
      <div className="brand">
        <div className="brand-icon" aria-hidden="true">P</div>
        <div className="brand-title">
          <strong>ParcelProof AI</strong>
          <small>PAYPAL PACKING VERIFICATION</small>
        </div>
      </div>

      <nav aria-label="Main navigation">
        <div className="nav-section">PAYPAL PACKING WORKFLOW</div>
        <button
          className={`nav-item nav-item-btn ${isReview ? 'active' : ''}`}
          onClick={() => navigateTo('/')}
          aria-current={isReview ? 'page' : undefined}
        >
          <span aria-hidden="true">▣</span>
          <span>Shipment Review</span>
          <span className="nav-badge" aria-label={`${ordersCount} shipments`}>{ordersCount}</span>
        </button>
        <button
          className={`nav-item nav-item-btn ${isManifests ? 'active' : ''}`}
          onClick={() => navigateTo('/manifests')}
          aria-current={isManifests ? 'page' : undefined}
        >
          <span aria-hidden="true"><ManifestIcon /></span>
          <span>Manifests</span>
        </button>
        <button
          className={`nav-item nav-item-btn ${isPacking ? 'active' : ''}`}
          onClick={() => navigateTo('/packing')}
          aria-current={isPacking ? 'page' : undefined}
        >
          <span aria-hidden="true"><CameraIcon /></span>
          <span>Packing Station</span>
        </button>
        <button
          className={`nav-item nav-item-btn ${isInspections ? 'active' : ''}`}
          onClick={() => navigateTo('/inspections')}
          aria-current={isInspections ? 'page' : undefined}
        >
          <span aria-hidden="true"><EyeIcon /></span>
          <span>AI Inspections</span>
        </button>

        <div className="nav-section" style={{ marginTop: '16px' }}>SANDBOX TOOLS</div>
        <button
          className={`nav-item nav-item-btn ${isCheckout ? 'active' : ''}`}
          onClick={() => navigateTo('/checkout')}
          aria-current={isCheckout ? 'page' : undefined}
        >
          <span aria-hidden="true"><CartIcon /></span>
          <span>Sandbox Checkout</span>
        </button>
      </nav>

      <div className="side-card">
        <div className="side-card-header">
          <span className="pulse" aria-hidden="true"></span>
          <span>Your packing checklist</span>
        </div>
        <div className="side-card-body">
          Start with the paid order. Confirm the packing manifest, photograph the items before sealing, then review the AI observations and record your decision.
        </div>
      </div>

      <div className="sidebar-footer">
        <strong>PARCELPROOF</strong>
        <p>Payment-linked packing checks with a human decision.</p>
      </div>
    </aside>
  )
}

// ─── Main App Component ───────────────────────────────────────────────────────
export default function App() {
  const [orders, setOrders] = useState([])
  const [results, setResults] = useState({})
  const [aiResults, setAiResults] = useState({})
  const [validationRun, setValidationRun] = useState(false)
  const [aiAnalysisRun, setAiAnalysisRun] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paypal, setPaypal] = useState({ loading: true })
  const [oauthTesting, setOauthTesting] = useState(false)
  const [oauthVerified, setOauthVerified] = useState(false)
  const [oauthMessage, setOauthMessage] = useState('')

  // UI state for Dashboard
  const [activeTab, setActiveTab] = useState('paypal')
  const [searchQuery, setSearchQuery] = useState('')
  const [batchAiLoading, setBatchAiLoading] = useState(false)
  const [batchValidateLoading, setBatchValidateLoading] = useState(false)
  const [copiedPayload, setCopiedPayload] = useState(false)

  // Drawer & Remediation state
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [remediationForm, setRemediationForm] = useState({
    tracking_number: '',
    carrier: '',
    evidence_text: ''
  })
  const [inspectLoading, setInspectLoading] = useState(false)

  // Checkout state
  const [catalog, setCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [cart, setCart] = useState({})
  const [checkoutDetails, setCheckoutDetails] = useState({
    buyerName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    countryCode: 'IN'
  })
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [captureLoading, setCaptureLoading] = useState(false)
  const [captureResult, setCaptureResult] = useState(null)
  const [captureError, setCaptureError] = useState('')
  const [currentPath, setCurrentPath] = useState(window.location.pathname)

  // Shared active shipment context across workflows
  const [activeShipmentId, setActiveShipmentId] = useState(null)

  // Mount-only effect: register popstate listener & fetch initial shipments / paypal status
  useEffect(() => {
    const handleRouteChange = () => setCurrentPath(window.location.pathname)
    window.addEventListener('popstate', handleRouteChange)

    fetch(`${API_BASE}/api/orders`)
      .then(r => {
        if (!r.ok) throw new Error('Could not load shipments')
        return r.json()
      })
      .then(data => {
        const ords = data.orders || []
        setOrders(ords)
        setValidationRun(false)
        setAiAnalysisRun(false)
        if (ords.length > 0 && !activeShipmentId) {
          setActiveShipmentId(ords[0].order_id)
        }
      })
      .catch(() => setError('Cannot connect to the backend. Make sure it is running.'))
      .finally(() => setLoading(false))

    fetch(`${API_BASE}/api/paypal/status`)
      .then(r => {
        if (!r.ok) throw new Error('Could not load PayPal status')
        return r.json()
      })
      .then(data => setPaypal(data))
      .catch(() => setPaypal({ error: 'PayPal status unavailable' }))

    return () => window.removeEventListener('popstate', handleRouteChange)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Route-specific side effects
  useEffect(() => {
    if (currentPath === '/checkout') {
      loadCatalog()
    }
    if (currentPath === '/checkout/return') {
      handleCaptureReturn()
    }
  }, [currentPath]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Shipment Review functions ────────────────────────────────────────────
  async function validate(order) {
    setResults(old => ({ ...old, [order.order_id]: { loading: true } }))
    try {
      const response = await fetch(`${API_BASE}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      })
      if (!response.ok) throw new Error('Validation failed')
      const data = await response.json()
      setResults(old => ({ ...old, [order.order_id]: data }))
      return data
    } catch {
      const err = { error: 'Validation failed. Check the backend.' }
      setResults(old => ({ ...old, [order.order_id]: err }))
      return err
    }
  }

  async function analyzeOrderEvidence(order) {
    setAiResults(old => ({ ...old, [order.order_id]: { loading: true } }))
    try {
      const response = await fetch(`${API_BASE}/api/analyze-evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      })
      if (!response.ok) throw new Error('AI analysis failed')
      const data = await response.json()
      setAiResults(old => ({ ...old, [order.order_id]: data }))
      return data
    } catch {
      const errObj = { error: 'AI evidence analysis failed. Check the backend.' }
      setAiResults(old => ({ ...old, [order.order_id]: errObj }))
      return errObj
    }
  }

  async function handleValidateAll() {
    setBatchValidateLoading(true)
    for (const order of orders) {
      await validate(order)
    }
    setBatchValidateLoading(false)
    setValidationRun(true)
  }

  async function handleAnalyzeAll() {
    setBatchAiLoading(true)
    for (const order of orders) {
      await analyzeOrderEvidence(order)
    }
    setBatchAiLoading(false)
    setAiAnalysisRun(true)
  }

  async function testPayPalConnection() {
    setOauthTesting(true)
    try {
      const res = await fetch(`${API_BASE}/api/paypal/verify-connection`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        setOauthVerified(true)
        setOauthMessage('OAuth 2.0 Authenticated · Write Gate Locked')
      } else {
        setOauthVerified(false)
        setOauthMessage(data.detail || 'PayPal OAuth verification failed')
      }
    } catch {
      setOauthVerified(false)
      setOauthMessage('Unable to reach backend PayPal verification endpoint')
    } finally {
      setOauthTesting(false)
    }
  }

  function openInspector(order) {
    setSelectedOrder(order)
    setRemediationForm({
      tracking_number: order.tracking_number || '',
      carrier: order.carrier || 'FEDEX',
      carrier_name_other: order.carrier_name_other || '',
      status: order.status || 'DELIVERED',
      evidence_text: order.evidence_text || ''
    })
    setCopiedPayload(false)

    if (!aiResults[order.order_id]) {
      setInspectLoading(true)
      analyzeOrderEvidence(order).finally(() => setInspectLoading(false))
    }
    if (!results[order.order_id]) {
      validate(order)
    }
  }

  async function handleRemediationSubmit() {
    if (!selectedOrder) return
    setInspectLoading(true)

    const updatedOrder = {
      ...selectedOrder,
      tracking_number: remediationForm.tracking_number,
      carrier: remediationForm.carrier,
      carrier_name_other: remediationForm.carrier === 'OTHER' ? remediationForm.carrier_name_other : '',
      status: remediationForm.status || selectedOrder.status || 'SHIPPED',
      evidence_text: remediationForm.evidence_text
    }

    setOrders(prev => prev.map(o => o.order_id === updatedOrder.order_id ? updatedOrder : o))
    setSelectedOrder(updatedOrder)

    await Promise.all([
      validate(updatedOrder),
      analyzeOrderEvidence(updatedOrder)
    ])

    setInspectLoading(false)
  }

  function copyPayload(payload) {
    if (!payload) return
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    setCopiedPayload(true)
    setTimeout(() => setCopiedPayload(false), 2000)
  }

  // Calculations for stats
  const validatedCount = Object.values(results).filter(r => !r.loading && !r.error)
  const readyChecksCount = validationRun ? validatedCount.filter(r => r.result === 'PASS').length : null
  const blockedCount = validationRun ? validatedCount.filter(r => r.result === 'BLOCKED').length : null
  const aiList = Object.values(aiResults).filter(r => !r.loading && !r.error)
  const evidenceCompleteCount = aiAnalysisRun ? aiList.filter(r => r.evidence_tier === 'RECORD_COMPLETE').length : null

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        order.order_id?.toLowerCase().includes(q) ||
        order.transaction_id?.toLowerCase().includes(q) ||
        order.tracking_number?.toLowerCase().includes(q) ||
        order.shipping_address?.toLowerCase().includes(q) ||
        order.carrier?.toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (activeTab === 'paypal') return Boolean(order.checkout_order_id)
      if (activeTab === 'samples') return !order.checkout_order_id
      if (activeTab === 'delivered') return Boolean(order.checkout_order_id) && order.status === 'DELIVERED'
      return true
    })
  }, [orders, results, aiResults, activeTab, searchQuery])

  const currentAiResult = selectedOrder ? aiResults[selectedOrder.order_id] : null
  const currentValidation = selectedOrder ? results[selectedOrder.order_id] : null

  // ─── Checkout functions ───────────────────────────────────────────────────
  async function loadCatalog() {
    setCatalogLoading(true)
    setCatalogError('')
    try {
      const res = await fetch(`${API_BASE}/api/catalog`)
      if (!res.ok) throw new Error('Could not load product catalog')
      const data = await res.json()
      setCatalog(data.products || [])
    } catch {
      setCatalogError('Could not load product catalog. Make sure the backend is running.')
    } finally {
      setCatalogLoading(false)
    }
  }

  function addToCart(sku) {
    setCart(prev => ({ ...prev, [sku]: (prev[sku] || 0) + 1 }))
  }

  function removeFromCart(sku) {
    setCart(prev => {
      const next = { ...prev }
      if (next[sku] > 1) next[sku] -= 1
      else delete next[sku]
      return next
    })
  }

  function getCartItems() {
    return Object.entries(cart).map(([sku, quantity]) => ({ sku, quantity }))
  }

  function getCartTotal() {
    return getCartItems().reduce((sum, { sku, quantity }) => {
      const product = catalog.find(p => p.sku === sku)
      return sum + (product ? parseFloat(product.price) * quantity : 0)
    }, 0)
  }

  async function handleCheckout() {
    const items = getCartItems()
    if (items.length === 0) {
      setCheckoutError('Please add at least one item to your cart.')
      return
    }

    const buyerName = checkoutDetails.buyerName.trim()
    const addressLine1 = checkoutDetails.addressLine1.trim()
    const city = checkoutDetails.city.trim()
    const postalCode = checkoutDetails.postalCode.trim()
    const countryCode = checkoutDetails.countryCode.trim().toUpperCase()
    const regionRequiredCountries = ['AR', 'BR', 'CA', 'CN', 'ID', 'IN', 'JP', 'MX', 'TH', 'US']
    const regionRequired = regionRequiredCountries.includes(countryCode)
    if (
      !buyerName ||
      !addressLine1 ||
      !city ||
      !postalCode ||
      !/^[A-Z]{2}$/.test(countryCode) ||
      (regionRequired && !checkoutDetails.state.trim())
    ) {
      setCheckoutError('Enter the recipient name and all required delivery address fields, including state or region where required.')
      return
    }

    setCheckoutLoading(true)
    setCheckoutError('')
    try {
      const res = await fetch(`${API_BASE}/api/checkout/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          currency: 'USD',
          buyer_name: buyerName,
          shipping_address: {
            address_line_1: addressLine1,
            address_line_2: checkoutDetails.addressLine2.trim(),
            city,
            state: checkoutDetails.state.trim(),
            postal_code: postalCode,
            country_code: countryCode
          }
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail) || 'Checkout failed')
      }
      const data = await res.json()

      sessionStorage.setItem('parcelproof_order_id', data.order_id)
      sessionStorage.setItem('parcelproof_paypal_order_id', data.paypal_order_id)

      if (data.approval_url) {
        window.location.href = data.approval_url
      } else {
        setCheckoutError('PayPal did not provide an approval URL.')
      }
    } catch (err) {
      setCheckoutError(err.message || 'Checkout failed. Check the backend.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  async function handleCaptureReturn() {
    const orderId = sessionStorage.getItem('parcelproof_order_id')
    if (!orderId) {
      setCaptureError('No order found in session. Please start a new checkout.')
      return
    }

    setCaptureLoading(true)
    setCaptureError('')
    try {
      const res = await fetch(`${API_BASE}/api/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail) || 'Payment capture failed')
      }
      const data = await res.json()
      if (data.payment_status === 'PAID' || data.already_captured) {
        sessionStorage.removeItem('parcelproof_order_id')
        sessionStorage.removeItem('parcelproof_paypal_order_id')
      }
      setCaptureResult(data)

      // Refresh orders list so the new shipment is immediately available
      fetch(`${API_BASE}/api/orders`)
        .then(r => r.ok ? r.json() : null)
        .then(fresh => {
          if (fresh?.orders) {
            setOrders(fresh.orders)
            if (data.shipment_order_id) {
              setActiveShipmentId(data.shipment_order_id)
            }
          }
        })
        .catch(() => {})
    } catch (err) {
      setCaptureError(err.message || 'Payment capture failed. Check the backend.')
    } finally {
      setCaptureLoading(false)
    }
  }

  function navigateTo(path, opts = {}) {
    window.history.pushState({}, '', path)
    if (path === '/checkout') {
      setCart({})
      setCheckoutError('')
      setCatalogError('')
    }
    if (path === '/') {
      setCheckoutError('')
    }
    if (path === '/checkout/return') {
      setCaptureError('')
      setCaptureResult(null)
    }
    if (path === '/checkout/cancel') {
      setCaptureError('')
      setCaptureResult(null)
    }
    if (opts.shipmentId) {
      setActiveShipmentId(opts.shipmentId)
    }
    setCurrentPath(path)
  }

  // ─── Route views ──────────────────────────────────────────────────────────
  const isDashboard = currentPath === '/'

  return (
    <div className="app-shell">
      <Sidebar
        currentPath={currentPath}
        ordersCount={orders.length}
        navigateTo={navigateTo}
      />

      {/* Main workspace routing */}
      {currentPath === '/checkout' && (
        <CheckoutCatalogView
          catalog={catalog}
          catalogLoading={catalogLoading}
          catalogError={catalogError}
          cart={cart}
          checkoutLoading={checkoutLoading}
          checkoutError={checkoutError}
          checkoutDetails={checkoutDetails}
          setCheckoutDetails={setCheckoutDetails}
          loadCatalog={loadCatalog}
          addToCart={addToCart}
          removeFromCart={removeFromCart}
          getCartItems={getCartItems}
          getCartTotal={getCartTotal}
          handleCheckout={handleCheckout}
          navigateTo={navigateTo}
        />
      )}

      {currentPath === '/checkout/return' && (
        <CheckoutReturnView
          captureLoading={captureLoading}
          captureError={captureError}
          captureResult={captureResult}
          navigateTo={navigateTo}
        />
      )}

      {currentPath === '/checkout/cancel' && (
        <CheckoutCancelView navigateTo={navigateTo} />
      )}

      {currentPath === '/manifests' && (
        <ShipmentsManifestView
          orders={orders}
          activeShipmentId={activeShipmentId}
          setActiveShipmentId={setActiveShipmentId}
          navigateTo={navigateTo}
        />
      )}

      {currentPath === '/packing' && (
        <PackingStationView
          orders={orders}
          activeShipmentId={activeShipmentId}
          setActiveShipmentId={setActiveShipmentId}
          navigateTo={navigateTo}
        />
      )}

      {currentPath === '/inspections' && (
        <InspectionsReviewView
          orders={orders}
          setOrders={setOrders}
          paypal={paypal}
          activeShipmentId={activeShipmentId}
          setActiveShipmentId={setActiveShipmentId}
          navigateTo={navigateTo}
        />
      )}

      {isDashboard && (
        <ShipmentReviewMain
          orders={orders}
          filteredOrders={filteredOrders}
          results={results}
          aiResults={aiResults}
          loading={loading}
          error={error}
          paypal={paypal}
          oauthTesting={oauthTesting}
          oauthVerified={oauthVerified}
          oauthMessage={oauthMessage}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          batchAiLoading={batchAiLoading}
          batchValidateLoading={batchValidateLoading}
          readyChecksCount={readyChecksCount}
          blockedCount={blockedCount}
          evidenceCompleteCount={evidenceCompleteCount}
          validationRun={validationRun}
          aiAnalysisRun={aiAnalysisRun}
          testPayPalConnection={testPayPalConnection}
          handleAnalyzeAll={handleAnalyzeAll}
          handleValidateAll={handleValidateAll}
          validate={validate}
          openInspector={openInspector}
          navigateTo={navigateTo}
        />
      )}

      {/* Drawer: AI Evidence Inspector — only on dashboard */}
      {selectedOrder && isDashboard && (
        <div
          className="drawer-backdrop"
          onClick={() => setSelectedOrder(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Shipment Evidence Inspector"
        >
          <div className="drawer-pane" onClick={e => e.stopPropagation()}>
            <div className="drawer-top">
              <div className="drawer-title-wrap">
                <h3>Evidence &amp; Protection Inspector</h3>
                <small>
                  Order: <strong>{selectedOrder.order_id}</strong> · Transaction: {selectedOrder.transaction_id}
                </small>
              </div>
              <button
                className="btn-close"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close inspector"
              >
                ✕
              </button>
            </div>

            <div className="drawer-content">
              {inspectLoading || currentAiResult?.loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }} role="status" aria-live="polite">
                  Checking shipment record completeness…
                </div>
              ) : currentAiResult?.error ? (
                <div className="findings-box issues" role="alert">{currentAiResult.error}</div>
              ) : currentAiResult ? (
                <>
                  <div className="score-hero-box">
                    <div className="score-hero-info">
                      <div className="eyebrow" style={{ color: '#2b5220' }}>
                        SHIPMENT EVIDENCE QUALITY
                      </div>
                      <strong>{currentAiResult.evidence_label}</strong>
                      <p>
                        Operational completeness indicator only. It does not assess PayPal Seller Protection or verify carrier events.
                      </p>
                    </div>
                    <div
                      className={
                        'score-meter ' +
                        (currentAiResult.evidence_score >= 85 ? 'high' : currentAiResult.evidence_score >= 70 ? 'med' : 'low')
                      }
                      aria-label={`Evidence completeness score: ${currentAiResult.evidence_score} out of 100`}
                    >
                      {currentAiResult.evidence_score}
                    </div>
                  </div>

                  {currentValidation && currentValidation.result === 'BLOCKED' && (
                    <div className="findings-box issues" style={{ margin: 0 }} role="alert">
                      <strong>Data Quality Issues (Blocks PayPal Add Tracking Submission):</strong>
                      {currentValidation.issues?.map((iss, i) => (
                        <p key={i}>• {iss.message}</p>
                      ))}
                    </div>
                  )}

                  <div>
                    <div className="nav-section" style={{ color: 'var(--slate)', margin: '0 0 8px' }}>
                      Shipment Record Checks
                    </div>
                    <div className="matrix-container" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                      <div className="matrix-item">
                        <small>TRACKING NUMBER</small>
                        <span className={'matrix-status-tag ' + (currentAiResult.evidence_checks.tracking_number_recorded ? 'pill-pass' : 'pill-blocked')}>
                          {currentAiResult.evidence_checks.tracking_number_recorded ? 'RECORDED' : 'MISSING'}
                        </span>
                        <p>A tracking number is entered for this shipment.</p>
                      </div>
                      <div className="matrix-item">
                        <small>CARRIER</small>
                        <span className={'matrix-status-tag ' + (currentAiResult.evidence_checks.carrier_recorded ? 'pill-pass' : 'pill-blocked')}>
                          {currentAiResult.evidence_checks.carrier_recorded ? 'RECORDED' : 'MISSING'}
                        </span>
                        <p>The carrier name is entered; the carrier account is not connected.</p>
                      </div>
                      <div className="matrix-item">
                        <small>SHIPMENT DATE</small>
                        <span className={'matrix-status-tag ' + (currentAiResult.evidence_checks.shipment_date_recorded ? 'pill-pass' : 'pill-blocked')}>
                          {currentAiResult.evidence_checks.shipment_date_recorded ? 'RECORDED' : 'MISSING'}
                        </span>
                        <p>A shipment date is entered in the record.</p>
                      </div>
                      <div className="matrix-item">
                        <small>DELIVERY STATUS + DATE</small>
                        <span className={'matrix-status-tag ' + (currentAiResult.evidence_checks.delivered_status_and_date_recorded ? 'pill-pass' : 'pill-warn')}>
                          {currentAiResult.evidence_checks.delivered_status_and_date_recorded ? 'ENTERED AS DELIVERED' : 'NOT RECORDED'}
                        </span>
                        <p>Delivery details are not independently verified by a carrier feed.</p>
                      </div>
                      <div className="matrix-item">
                        <small>DESTINATION TEXT</small>
                        <span className={'matrix-status-tag ' + (currentAiResult.evidence_checks.destination_text_match ? 'pill-pass' : 'pill-warn')}>
                          {currentAiResult.evidence_checks.destination_text_match ? 'TEXT MATCH' : 'NOT MATCHED'}
                        </span>
                        <p>A text match is not proof that the carrier delivered to the transaction address.</p>
                      </div>
                      <div className="matrix-item">
                        <small>EXCEPTION KEYWORDS</small>
                        <span className={'matrix-status-tag ' + (currentAiResult.evidence_checks.exception_phrases_found?.length ? 'pill-warn' : 'pill-unchecked')}>
                          {currentAiResult.evidence_checks.exception_phrases_found?.length ? 'REVIEW' : 'NONE FOUND'}
                        </span>
                        <p>Keyword matches in notes need confirmation against the carrier's official tracking record.</p>
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '8px' }}>
                      {currentAiResult.evidence_checks.source_notice}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                      {currentAiResult.paypal_notice}
                    </p>
                  </div>

                  <div className="remediation-box">
                    <h4>Interactive Evidence Remediation Sandbox</h4>
                    <p>
                      Update merchant-entered tracking, delivery notes, or order details to test recalculation of the shipment record checks:
                    </p>

                    <div className="interactive-form-grid">
                      <div className="form-group">
                        <label htmlFor="rem-tracking">Tracking Number</label>
                        <input
                          id="rem-tracking"
                          type="text"
                          className="form-control"
                          value={remediationForm.tracking_number}
                          onChange={e => setRemediationForm({ ...remediationForm, tracking_number: e.target.value })}
                          placeholder="e.g. 781234567890"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="rem-carrier">Carrier</label>
                        <select
                          id="rem-carrier"
                          className="form-control"
                          value={remediationForm.carrier}
                          onChange={e => setRemediationForm({ ...remediationForm, carrier: e.target.value })}
                        >
                          <option value="FEDEX">FEDEX</option>
                          <option value="UPS">UPS</option>
                          <option value="USPS">USPS</option>
                          <option value="DHL">DHL</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                      </div>

                      {remediationForm.carrier === 'OTHER' && (
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label htmlFor="rem-carrier-name">Custom Carrier Name (Required by PayPal for OTHER)</label>
                          <input
                            id="rem-carrier-name"
                            type="text"
                            className="form-control"
                            value={remediationForm.carrier_name_other || ''}
                            onChange={e => setRemediationForm({ ...remediationForm, carrier_name_other: e.target.value })}
                            placeholder="e.g. OnTrac, LaserShip, Royal Mail"
                          />
                        </div>
                      )}

                    </div>

                    <div className="form-group" style={{ marginTop: '12px' }}>
                      <label htmlFor="rem-evidence">Shipment Notes (Merchant-Entered)</label>
                      <textarea
                        id="rem-evidence"
                        className="form-control"
                        rows="3"
                        value={remediationForm.evidence_text}
                        onChange={e => setRemediationForm({ ...remediationForm, evidence_text: e.target.value })}
                        placeholder="e.g. Carrier portal shows parcel delivered in Hyderabad; reference the carrier event ID if available."
                      />
                      <small style={{ display: 'block', fontSize: '10px', color: '#687e6d', marginTop: '4px' }}>
                        Notes entered here are not independently verified. Prefer a carrier-generated tracking record or electronic proof of delivery.
                      </small>
                    </div>

                    <div className="remediation-actions">
                      <button
                        className="btn-primary"
                        onClick={handleRemediationSubmit}
                        disabled={inspectLoading}
                      >
                        {inspectLoading ? 'Recalculating…' : 'Recalculate Evidence Checks ↻'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="nav-section" style={{ color: '#314738', margin: '0 0 8px' }}>
                      Audit Findings &amp; Recommendations
                    </div>
                    <div className="insights-wrap">
                      {currentAiResult.strengths?.map((item, idx) => (
                        <div className="insight-row strength" key={`s-${idx}`}>
                          <span className="insight-icon"><CheckIcon /></span>
                          <span>{item}</span>
                        </div>
                      ))}
                      {currentAiResult.risk_factors?.map((item, idx) => (
                        <div className="insight-row risk" key={`r-${idx}`}>
                          <span className="insight-icon"><AlertIcon /></span>
                          <span>{item}</span>
                        </div>
                      ))}
                      {currentAiResult.recommendations?.map((item, idx) => (
                        <div className="insight-row recom" key={`rec-${idx}`}>
                          <span className="insight-icon"><ArrowIcon /></span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="code-preview-card">
                    <div className="code-header">
                      <span>PAYPAL ORDERS V2 TRACKING PREVIEW ({currentAiResult.paypal_payload_preview?.endpoint || 'Orders v2'})</span>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '10px' }}
                        onClick={() => copyPayload(currentAiResult.paypal_payload_preview?.request_body)}
                        aria-label={copiedPayload ? 'Copied to clipboard' : 'Copy JSON payload to clipboard'}
                      >
                        {copiedPayload ? 'Copied ✓' : 'Copy JSON'}
                      </button>
                    </div>
                    <pre className="code-pre">
                      {JSON.stringify(currentAiResult.paypal_payload_preview?.request_body, null, 2)}
                    </pre>
                    <div className="safety-gate-notice">
                      <span style={{ display: 'grid', placeItems: 'center' }}><LockIcon /></span>
                      <span>
                        <strong>Preview only.</strong> Actual tracking submission is available from AI Inspections after the latest packing inspection is human-approved. The backend supplies the stored PayPal order ID, capture ID and paid order items. The Sandbox write gate remains locked until explicitly enabled.
                      </span>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shipment Review Main Component ───────────────────────────────────────────
function ShipmentReviewMain({
  orders,
  filteredOrders,
  results,
  aiResults,
  loading,
  error,
  paypal,
  oauthTesting,
  oauthVerified,
  oauthMessage,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  testPayPalConnection,
  validate,
  openInspector,
  navigateTo
}) {
  const paidPayPalOrders = orders.filter(order => Boolean(order.checkout_order_id))
  const shipmentDetailsMissing = paidPayPalOrders.filter(order => (
    !order.tracking_number || !order.carrier || order.carrier === 'UNASSIGNED'
  )).length
  const nextActionShipment = paidPayPalOrders[0] || null

  return (
    <main className="main" id="main-content">
      <header className="topbar">
        <div className="breadcrumb">
          <span>Workspace</span>
          <span>/</span>
          <strong>Shipment review</strong>
        </div>
        <div className="topbar-actions">
          <button
            className="pill-status"
            onClick={testPayPalConnection}
            disabled={oauthTesting}
            title="Click to test live PayPal Sandbox OAuth 2.0 authentication"
          >
            <span className={`pulse ${oauthVerified ? '' : 'warn'}`} aria-hidden="true"></span>
            <span>
              {oauthTesting
                ? 'Testing Sandbox Auth…'
                : oauthVerified
                ? oauthMessage
                : paypal.configured
                ? 'Connect PayPal Sandbox ↗'
                : 'PayPal Sandbox: Not Configured'}
            </span>
          </button>
          <div className="pill-status">
            <span style={{ color: '#275619', fontWeight: 700 }}>Tracking submission: Off</span>
          </div>
        </div>
      </header>

      <section className="hero export-hero" aria-label="PayPal-connected packing verification workflow">
        <div className="hero-copy">
          <div className="eyebrow">
            <span aria-hidden="true">●</span> PAYPAL-CONNECTED PACKING VERIFICATION
          </div>
          <h1>
            Catch packing mistakes
            <br />
            <span>before dispatch.</span>
          </h1>
          <p>
            ParcelProof links a captured PayPal payment to the exact items ordered, then compares pre-seal packing photos with the finalized manifest. AI highlights possible discrepancies; you make the final decision.
          </p>
          <div className="export-hero-actions">
            {nextActionShipment ? (
              <button
                className="btn-primary"
                onClick={() => navigateTo('/manifests', { shipmentId: nextActionShipment.order_id })}
              >
                Continue {nextActionShipment.order_id} →
              </button>
            ) : (
              <button className="btn-primary" onClick={() => navigateTo('/checkout')}>
                Create PayPal Sandbox checkout →
              </button>
            )}
            <span>AI observations are advisory. A merchant reviews the photos and decides.</span>
          </div>
        </div>

        <div className="hero-art-card export-flow-card" aria-label="Payment, packing manifest and pre-seal photo review steps">
          <div className="export-flow-step">
            <span>01</span>
            <div><strong>PayPal payment</strong><small>Captured order and purchased items</small></div>
            <b>Verified</b>
          </div>
          <div className="export-flow-connector"></div>
          <div className="export-flow-step">
            <span>02</span>
            <div><strong>Packing manifest</strong><small>Confirm item descriptions and quantities</small></div>
            <b>Finalized</b>
          </div>
          <div className="export-flow-connector"></div>
          <div className="export-flow-step">
            <span>03</span>
            <div><strong>Packing photos</strong><small>Photograph items before sealing</small></div>
            <b>Upload</b>
          </div>
          <div className="export-flow-connector"></div>
          <div className="export-flow-step">
            <span>04</span>
            <div><strong>AI and human review</strong><small>Review observations and record your decision</small></div>
            <b>Decide</b>
          </div>
          <div className="art-tag">PAYMENT · MANIFEST · PHOTOS · HUMAN DECISION</div>
        </div>
      </section>

      <section className="architecture-banner export-explainer">
        <div className="arch-info">
          <div className="arch-badge">HOW IT WORKS</div>
          <div className="arch-text">
            <strong>One paid order. One traceable packing review.</strong>
            <p>
              The paid order becomes the packing checklist. Before sealing the parcel, the operator photographs the contents. AI compares visible items with the finalized manifest, while a merchant reviews the original photos and makes the decision.
            </p>
          </div>
        </div>
      </section>

      <section className="packing-checks-section" aria-labelledby="packing-checks-title">
        <div className="packing-checks-header">
          <div>
            <div className="eyebrow">PACKING REVIEW</div>
            <h3 id="packing-checks-title">What the AI checks before you decide</h3>
            <p>These checks stay visible because they explain the product's main job.</p>
          </div>
        </div>
        <div className="arch-grid">
          <div className="arch-card"><strong>Visible items</strong>Compares what can be seen in the packing photos with the finalized manifest.</div>
          <div className="arch-card"><strong>Possible discrepancies</strong>Highlights items or quantities that may be missing, incorrect or uncertain.</div>
          <div className="arch-card"><strong>Photo and manifest record</strong>Keeps the original photo references and finalized manifest fingerprint with the inspection.</div>
          <div className="arch-card"><strong>Human decision</strong>A merchant reviews the original photos and chooses approve, request correction or reject.</div>
        </div>
      </section>

      <section className="stats-grid export-stats-grid" aria-label="Packing workflow overview">
        <div className="stat-card">
          <span>PAYPAL-LINKED SHIPMENTS</span>
          <strong>{paidPayPalOrders.length.toString().padStart(2, '0')}</strong>
          <small>Paid orders with a shipment record</small>
        </div>
        <div className="stat-card">
          <span>NEED DISPATCH DETAILS</span>
          <strong className={shipmentDetailsMissing > 0 ? 'red' : 'green'}>{shipmentDetailsMissing.toString().padStart(2, '0')}</strong>
          <small>Carrier or tracking details still need to be added</small>
        </div>
        <div className="stat-card">
          <span>PACKING PHOTOS</span>
          <strong>1–5</strong>
          <small>Photos reviewed before the parcel is sealed</small>
        </div>
        <div className="stat-card">
          <span>PACKING DECISION</span>
          <strong className="export-stat-word">HUMAN</strong>
          <small>A merchant reviews AI observations and decides</small>
        </div>
      </section>

      <section className="queue-header">
        <div className="queue-title">
          <div className="eyebrow">YOUR WORKSPACE</div>
          <h2>Shipments to review</h2>
          <p>Select a paid order to confirm its manifest, check the packed items and record a human review.</p>
        </div>
      </section>

      {error && (
        <div className="findings-box issues" role="alert" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div className="filter-bar" role="toolbar" aria-label="Filter shipments">
        <div className="filter-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'paypal'}
            className={`filter-tab ${activeTab === 'paypal' ? 'active' : ''}`}
            onClick={() => setActiveTab('paypal')}
          >
            PayPal orders <span>{paidPayPalOrders.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'samples'}
            className={`filter-tab ${activeTab === 'samples' ? 'active' : ''}`}
            onClick={() => setActiveTab('samples')}
          >
            Sample records <span>{orders.length - paidPayPalOrders.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'delivered'}
            className={`filter-tab ${activeTab === 'delivered' ? 'active' : ''}`}
            onClick={() => setActiveTab('delivered')}
          >
            Delivered <span>{paidPayPalOrders.filter(order => order.status === 'DELIVERED').length}</span>
          </button>
        </div>
        <div className="search-input-wrap">
          <span className="search-icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            type="search"
            className="search-input"
            placeholder="Search shipments or PayPal orders…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search shipments"
          />
        </div>
      </div>

      {loading ? (
        <div className="order-card" style={{ textAlign: 'center', padding: '40px' }} role="status" aria-live="polite">
          Loading shipment queue…
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="order-card" style={{ textAlign: 'center', padding: '40px' }} role="status">
          {activeTab === 'paypal'
            ? 'No PayPal-linked shipments yet. Create a Sandbox checkout to start a packing record.'
            : activeTab === 'delivered'
            ? 'No PayPal-linked shipments are marked delivered yet.'
            : 'No sample records match this filter.'}
        </div>
      ) : (
        <div className="orders-grid">
          {filteredOrders.map((order, index) => {
            const result = results[order.order_id]
            const status = result?.result
            const ai = aiResults[order.order_id]
            const scoreClass = ai?.evidence_score >= 85 ? 'high' : ai?.evidence_score >= 70 ? 'med' : 'low'

            return (
              <article className="order-card" key={order.order_id}>
                <div className="order-top">
                  <div className="order-seq" aria-hidden="true">0{index + 1}</div>
                  <div className="order-meta">
                    <div className="order-meta-head">
                      <strong>{order.order_id}</strong>
                      {order.checkout_order_id && (
                        <span className="pill pill-pass" style={{ fontSize: '10px', padding: '2px 6px', marginLeft: '6px' }}>
                          PAID CHECKOUT
                        </span>
                      )}
                      <small>PayPal Txn: {order.transaction_id || order.paypal_capture_id || '—'}</small>
                      {order.checkout_order_id && (
                        <small style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Order: {order.checkout_order_id.slice(0, 8)}… · Capture: {order.paypal_capture_id || '—'}
                        </small>
                      )}
                    </div>
                  </div>
                  <div className="status-badges">
                    {ai && !ai.loading && !ai.error && (
                      <span className={`score-chip ${scoreClass}`} title={ai.evidence_label}>
                        Evidence Score: {ai.evidence_score}/100
                      </span>
                    )}
                    <span
                      className={
                        'pill ' +
                        (status === 'PASS'
                          ? 'pill-pass'
                          : status === 'BLOCKED'
                          ? 'pill-blocked'
                          : status === 'WARNING'
                          ? 'pill-warn'
                          : 'pill-unchecked')
                      }
                    >
                      {result?.loading ? 'CHECKING…' : order.checkout_order_id ? 'PAYMENT CAPTURED' : status || 'NOT CHECKED'}
                    </span>
                  </div>
                </div>

                <div className="details-grid">
                  <div className="detail-col">
                    <small>Tracking Number</small>
                    <strong className={!order.tracking_number ? 'missing' : ''}>
                      {order.tracking_number || 'Not added'}
                    </strong>
                  </div>
                  <div className="detail-col">
                    <small>Carrier</small>
                    <strong>
                      {order.carrier === 'OTHER' ? order.carrier_name_other || 'OTHER' : order.carrier === 'UNASSIGNED' || !order.carrier ? 'Not assigned' : order.carrier}
                    </strong>
                  </div>
                  <div className="detail-col">
                    <small>Shipment Status</small>
                    <strong>{order.status === 'ON_HOLD' ? 'Awaiting dispatch' : order.status?.replaceAll('_', ' ')}</strong>
                  </div>
                  <div className="detail-col">
                    <small>Order Value</small>
                    <strong>
                      {order.amount ? `$${Number(order.amount).toFixed(2)} ${order.currency || 'USD'}` : '—'}
                    </strong>
                  </div>
                  <div className="detail-col">
                    <small>Recipient</small>
                    <strong>{order.buyer_name || '—'}</strong>
                  </div>
                  <div className="detail-col">
                    <small>Delivery address</small>
                    <strong>{order.shipping_address || '—'}</strong>
                  </div>
                </div>

                {order.evidence_text && (
                  <div className="evidence-snippet">
                    <strong>{order.checkout_order_id ? 'Order activity:' : 'Shipment note:'}</strong>
                    {order.evidence_text}
                  </div>
                )}

                {result?.issues?.length > 0 && (
                  <div className="findings-box issues">
                    <strong>✕ Issues Requiring Resolution:</strong>
                    {result.issues.map((issue, i) => (
                      <p key={i}>• {issue.message}</p>
                    ))}
                  </div>
                )}

                {result?.warnings?.length > 0 && (
                  <div className="findings-box warnings">
                    <strong>! Review Recommended:</strong>
                    {result.warnings.map((warn, i) => (
                      <p key={i}>• {warn.message}</p>
                    ))}
                  </div>
                )}

                {status === 'PASS' && (
                  <div className="pass-callout">
                    ✓ Shipment fields passed basic format checks. This does not verify dispatch or delivery.
                  </div>
                )}

                <div className="card-footer-row">
                  <span>
                    {order.checkout_order_id
                      ? 'Payment captured · Check the manifest before packing'
                      : 'Sample record · Not a PayPal checkout'}
                  </span>
                  <div className="card-footer-actions">
                    {order.checkout_order_id ? (
                      <button
                        className="btn-primary"
                        onClick={() => navigateTo('/manifests', { shipmentId: order.order_id })}
                      >
                        Open packing manifest →
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn-secondary"
                          onClick={() => navigateTo('/manifests', { shipmentId: order.order_id })}
                        >
                          Open sample manifest ↗
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => validate(order)}
                          disabled={result?.loading}
                        >
                          {result?.loading ? 'Checking…' : 'Validate →'}
                        </button>
                        <button
                          className="btn-secondary btn-ai"
                          onClick={() => openInspector(order)}
                        >
                          Inspect &amp; Remediate ↗
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <footer>
        <div>
          <strong>PARCELPROOF</strong> · PayPal packing verification
        </div>
        <p>
          Link the paid order to the packing manifest, review the pre-seal photos and record a human decision.
        </p>
      </footer>
    </main>
  )
}

// ─── Shipment & Manifest Management View ──────────────────────────────────────
function ShipmentsManifestView({ orders, activeShipmentId, setActiveShipmentId, navigateTo }) {
  const [manifest, setManifest] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [finalizeLoading, setFinalizeLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')

  // Form draft state for editing/creating items
  const [draftItems, setDraftItems] = useState([
    { sku: '', description: '', expected_qty: 1, unit_value: '', fragile: false }
  ])
  const [draftNotes, setDraftNotes] = useState('')

  const selectedShipment = useMemo(() => {
    return orders.find(o => o.order_id === activeShipmentId) || orders[0] || null
  }, [orders, activeShipmentId])

  // Load manifest when activeShipmentId changes
  useEffect(() => {
    let ignore = false
    async function fetchManifest() {
      if (!selectedShipment) return
      setLoading(true)
      setError('')
      setSaveSuccess('')
      try {
        const res = await fetch(`${API_BASE}/api/shipments/${selectedShipment.order_id}/manifest`)
        if (ignore) return
        if (res.status === 404) {
          setManifest(null)
          setDraftItems([
            { sku: '', description: '', expected_qty: 1, unit_value: '', fragile: false }
          ])
          setDraftNotes('')
        } else if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || 'Could not load manifest')
        } else {
          const data = await res.json()
          if (ignore) return
          setManifest(data)
          setDraftItems(
            data.items.map(it => ({
              id: it.id,
              sku: it.sku || '',
              description: it.description || '',
              expected_qty: it.expected_qty,
              unit_value: it.unit_value_cents !== null && it.unit_value_cents !== undefined
                ? (it.unit_value_cents / 100).toFixed(2)
                : '',
              fragile: Boolean(it.fragile)
            }))
          )
          setDraftNotes(data.notes || '')
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Error loading manifest')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    fetchManifest()
    return () => {
      ignore = true
    }
  }, [selectedShipment?.order_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('review_status')
    const error = params.get('review_error')
    if (status) setReviewFeedback(`Human review recorded: ${status.replaceAll('_', ' ')}.`)
    if (error) setReviewError(error)
    if (status || error) {
      params.delete('review_status')
      params.delete('review_error')
      params.delete('inspection_id')
      const query = params.toString()
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
    }
  }, [])

  function handleAddItem() {
    setDraftItems(prev => [
      ...prev,
      { sku: '', description: '', expected_qty: 1, unit_value: '', fragile: false }
    ])
  }

  function handleRemoveItem(index) {
    if (draftItems.length <= 1) return
    setDraftItems(prev => prev.filter((_, idx) => idx !== index))
  }

  function handleItemChange(index, field, value) {
    setDraftItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  async function handleSaveManifest() {
    if (!selectedShipment) return
    setError('')
    setSaveSuccess('')

    // Strict validation
    for (let i = 0; i < draftItems.length; i++) {
      const it = draftItems[i]
      if (!it.description.trim()) {
        setError(`Item #${i + 1}: Description is required.`)
        return
      }

      // Quantity validation using Number.isSafeInteger to reject fractional, NaN, zero, and negative
      const rawQty = it.expected_qty
      if (typeof rawQty === 'string' && rawQty.trim() === '') {
        setError(`Item #${i + 1}: Expected quantity is required.`)
        return
      }
      const numQty = Number(rawQty)
      if (!Number.isSafeInteger(numQty) || numQty <= 0) {
        setError(`Item #${i + 1}: Expected quantity must be a positive integer (received "${rawQty}").`)
        return
      }

      // Unit value validation: finite, non-negative number before converting to cents
      if (it.unit_value !== '' && it.unit_value !== null && it.unit_value !== undefined) {
        const valStr = String(it.unit_value).trim()
        if (valStr !== '') {
          const numVal = Number(valStr)
          if (!Number.isFinite(numVal) || numVal < 0) {
            setError(`Item #${i + 1}: Unit value must be a finite, non-negative number (received "${it.unit_value}").`)
            return
          }
        }
      }
    }

    const payloadItems = draftItems.map(it => {
      const numQty = Number(it.expected_qty)
      const valStr = it.unit_value !== '' && it.unit_value !== null && it.unit_value !== undefined ? String(it.unit_value).trim() : ''
      const parsedUnitValue = valStr !== '' && Number.isFinite(Number(valStr))
        ? Math.round(Number(valStr) * 100)
        : null

      return {
        sku: it.sku?.trim() || null,
        description: it.description.trim(),
        expected_qty: numQty,
        unit_value_cents: parsedUnitValue,
        fragile: Boolean(it.fragile)
      }
    })

    const payload = {
      items: payloadItems,
      notes: draftNotes.trim() || null
    }

    setSaveLoading(true)
    try {
      let res
      if (manifest && manifest.id && manifest.status === 'DRAFT') {
        // Update existing DRAFT
        res = await fetch(`${API_BASE}/api/manifests/${manifest.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        // Create initial manifest for this shipment
        res = await fetch(`${API_BASE}/api/shipments/${selectedShipment.order_id}/manifest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save manifest')
      }

      setManifest(data)
      setSaveSuccess('Manifest saved as DRAFT successfully.')
      setTimeout(() => setSaveSuccess(''), 3000)
    } catch (err) {
      setError(err.message || 'Error saving manifest.')
    } finally {
      setSaveLoading(false)
    }
  }

  async function handleFinalizeManifest() {
    if (!manifest || !manifest.id) return
    setError('')
    setSaveSuccess('')
    setFinalizeLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/manifests/${manifest.id}/finalize`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to finalize manifest')
      }
      setManifest(data)
      setSaveSuccess('Manifest FINALIZED! Cryptographic SHA-256 fingerprint generated.')
    } catch (err) {
      setError(err.message || 'Error finalizing manifest.')
    } finally {
      setFinalizeLoading(false)
    }
  }

  const isFinalized = manifest?.status === 'FINALIZED'
  const manifestTotalValue = draftItems.reduce((acc, it) => {
    const val = parseFloat(it.unit_value) || 0
    const qty = parseInt(it.expected_qty, 10) || 0
    return acc + (val * qty)
  }, 0)

  return (
    <main className="main" id="main-content">
      <header className="topbar">
        <div className="breadcrumb">
          <span>Workspace</span>
          <span>/</span>
          <strong>Shipment Management &amp; Manifests</strong>
        </div>
        <div className="topbar-actions">
          <button
            className="btn-secondary"
            onClick={() => navigateTo('/')}
          >
            ← Back to Evidence Review
          </button>
        </div>
      </header>

      <div className="manifest-layout">
        {/* Left: Shipment Selector List */}
        <aside className="manifest-shipments-sidebar" aria-label="Select Shipment">
          <div className="sidebar-section-title">
            <span>ACTIVE SHIPMENTS</span>
            <small>{orders.length} Records</small>
          </div>
          <div className="manifest-shipment-cards">
            {orders.map(order => {
              const isSelected = selectedShipment?.order_id === order.order_id
              return (
                <button
                  key={order.order_id}
                  className={`manifest-shipment-card ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setActiveShipmentId(order.order_id)
                  }}
                >
                  <div className="m-card-top">
                    <strong>{order.order_id}</strong>
                    <span className="m-card-status">{order.status}</span>
                  </div>
                  <div className="m-card-details">
                    <span>Carrier: {order.carrier || 'N/A'}</span>
                    <span>Tracking: {order.tracking_number ? `${order.tracking_number.slice(0, 10)}…` : 'Missing'}</span>
                  </div>
                  <div className="m-card-dest">{order.shipping_address || 'No destination'}</div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Right: Manifest Editor & Details */}
        <section className="manifest-editor-panel" aria-label="Manifest Details">
          {selectedShipment ? (
            <>
              {/* Shipment Header Banner */}
              <div className="manifest-header-card">
                <div className="m-header-left">
                  <div className="eyebrow">SHIPMENT PRODUCT MANIFEST</div>
                  <h2>{selectedShipment.order_id}</h2>
                  <p>
                    Carrier: <strong>{selectedShipment.carrier || 'Unspecified'}</strong> ·
                    Txn: <code>{selectedShipment.transaction_id || selectedShipment.paypal_capture_id || '—'}</code> ·
                    Order Total: <strong>${Number(selectedShipment.amount || 0).toFixed(2)} {selectedShipment.currency || 'USD'}</strong>
                    {selectedShipment.checkout_order_id && (
                      <> · Order: <code>{selectedShipment.checkout_order_id.slice(0, 8)}…</code></>
                    )}
                  </p>
                </div>
                <div className="m-header-right">
                  {manifest ? (
                    <div className="manifest-status-badge-wrap">
                      <span className={`pill ${isFinalized ? 'pill-pass' : 'pill-warn'}`}>
                        {manifest.status}
                      </span>
                      {isFinalized && (
                        <div className="finalized-lock-tag">
                          <LockIcon /> Sealed &amp; Hashed
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="pill pill-unchecked">NO MANIFEST</span>
                  )}
                </div>
              </div>

              {/* SHA-256 Fingerprint Callout for Finalized Manifests */}
              {isFinalized && manifest.manifest_hash && (
                <div className="hash-display-banner">
                  <div className="hash-info">
                    <span className="hash-label">CRYPTOGRAPHIC SHA-256 FINGERPRINT</span>
                    <code className="hash-code">{manifest.manifest_hash}</code>
                    <small className="hash-explanation">
                      Deterministic manifest hash binds declared items, quantities, and values. Manifest is immutably locked against tampering.
                    </small>
                  </div>

                </div>
              )}

              {/* Alert notifications */}
              {error && (
                <div className="findings-box issues" role="alert" style={{ marginBottom: '16px' }}>
                  {error}
                </div>
              )}
              {saveSuccess && (
                <div className="pass-callout" role="status" style={{ marginBottom: '16px' }}>
                  ✓ {saveSuccess}
                </div>
              )}

              {/* Manifest Items Table / Form */}
              <div className="manifest-items-card">
                <div className="items-card-header">
                  <div>
                    <h3>Declared Manifest Items</h3>
                    <p>Confirm each paid-order item and quantity. SKU is your internal reference, not a code the AI expects to read from the product. Add only useful distinguishing details to the description.</p>
                  </div>
                  <div className="items-header-stats">
                    <span className="stat-pill">Items: {draftItems.length}</span>
                    <span className="stat-pill">Est. Value: ${manifestTotalValue.toFixed(2)}</span>
                  </div>
                </div>

                {loading ? (
                  <div className="checkout-state-box" style={{ padding: '30px' }} role="status">
                    <div className="checkout-state-icon loading-spinner"><SpinnerIcon /></div>
                    <p>Loading manifest details…</p>
                  </div>
                ) : (
                  <>
                    <div className="manifest-table-wrap">
                      <table className="manifest-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th style={{ width: '130px' }}>SKU (internal)</th>
                            <th>Product description &amp; identifying details *</th>
                            <th style={{ width: '100px' }}>Qty *</th>
                            <th style={{ width: '120px' }}>Unit Value ($)</th>
                            <th style={{ width: '80px' }}>Fragile</th>
                            {!isFinalized && <th style={{ width: '60px' }}>Action</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {draftItems.map((item, idx) => (
                            <tr key={idx}>
                              <td className="row-num">{idx + 1}</td>
                              <td>
                                {isFinalized ? (
                                  <span className="field-readonly">{item.sku || '—'}</span>
                                ) : (
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={item.sku}
                                    placeholder="SKU-100"
                                    onChange={e => handleItemChange(idx, 'sku', e.target.value)}
                                  />
                                )}
                              </td>
                              <td>
                                {isFinalized ? (
                                  <span className="field-readonly">{item.description}</span>
                                ) : (
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={item.description}
                                    placeholder="Product name + useful identifying details…"
                                    onChange={e => handleItemChange(idx, 'description', e.target.value)}
                                  />
                                )}
                              </td>
                              <td>
                                {isFinalized ? (
                                  <span className="field-readonly bold">{item.expected_qty}</span>
                                ) : (
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="form-control text-center"
                                    value={item.expected_qty}
                                    onChange={e => handleItemChange(idx, 'expected_qty', e.target.value)}
                                  />
                                )}
                              </td>
                              <td>
                                {isFinalized ? (
                                  <span className="field-readonly">
                                    {item.unit_value ? `$${parseFloat(item.unit_value).toFixed(2)}` : '—'}
                                  </span>
                                ) : (
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-control text-right"
                                    placeholder="0.00"
                                    value={item.unit_value}
                                    onChange={e => handleItemChange(idx, 'unit_value', e.target.value)}
                                  />
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {isFinalized ? (
                                  item.fragile ? <span className="tag-fragile">FRAGILE</span> : <span className="text-muted">—</span>
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={item.fragile}
                                    onChange={e => handleItemChange(idx, 'fragile', e.target.checked)}
                                    className="fragile-checkbox"
                                  />
                                )}
                              </td>
                              {!isFinalized && (
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    className="btn-trash"
                                    onClick={() => handleRemoveItem(idx)}
                                    disabled={draftItems.length <= 1}
                                    title="Remove item"
                                  >
                                    ✕
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {!isFinalized && (
                      <div className="add-row-action">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleAddItem}
                        >
                          + Add Item Row
                        </button>
                      </div>
                    )}

                    {/* Manifest Notes */}
                    <div className="form-group" style={{ marginTop: '20px' }}>
                      <label htmlFor="manifest-notes">Packing / Dispatch Notes (Optional)</label>
                      {isFinalized ? (
                        <div className="field-readonly-box">{draftNotes || 'No notes provided.'}</div>
                      ) : (
                        <textarea
                          id="manifest-notes"
                          className="form-control"
                          rows="2"
                          placeholder="e.g. Dual-wall cardboard box, tamper-evident tape applied, fragile markings on exterior."
                          value={draftNotes}
                          onChange={e => setDraftNotes(e.target.value)}
                        />
                      )}
                    </div>

                    {/* Manifest Action Bar */}
                    <div className="manifest-actions-bar">
                      <div className="manifest-actions-info">
                        {isFinalized ? (
                          <span className="text-muted">
                            Manifest finalized on {new Date(manifest.updated_at).toLocaleString()}. Items cannot be modified.
                          </span>
                        ) : (
                          <span className="text-muted">
                            Save changes as a draft, or finalize to compute SHA-256 fingerprint for packing station.
                          </span>
                        )}
                      </div>
                      <div className="manifest-actions-buttons">
                        {!isFinalized ? (
                          <>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={handleSaveManifest}
                              disabled={saveLoading || finalizeLoading}
                            >
                              {saveLoading ? 'Saving Draft…' : 'Save Draft'}
                            </button>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={handleFinalizeManifest}
                              disabled={saveLoading || finalizeLoading || !manifest}
                              title={!manifest ? 'Please save as draft first' : 'Finalize and generate SHA-256 fingerprint'}
                            >
                              {finalizeLoading ? 'Finalizing…' : 'Finalize & Fingerprint'}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => navigateTo('/packing', { shipmentId: selectedShipment.order_id })}
                          >
                            Proceed to Packing Station →
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="checkout-state-box" style={{ padding: '60px' }}>
              <p>No shipments available.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}


// ─── Payment-to-export document reconciliation ───────────────────────────────
function emptyExportDocument(documentType) {
  return {
    document_type: documentType,
    document_number: '',
    currency: '',
    total_amount: '',
    recipient_name: '',
    recipient_address: {
      address_line_1: '', address_line_2: '', city: '', state: '',
      postal_code: '', country_code: ''
    },
    items: [],
    extraction_notes: [],
    merchant_confirmed: false
  }
}

export function ExportDocumentWorkflow({ shipment }) {
  const [documents, setDocuments] = useState([])
  const [history, setHistory] = useState([])
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [documentType, setDocumentType] = useState('COMMERCIAL_INVOICE')
  const [selectedFile, setSelectedFile] = useState(null)
  const [draft, setDraft] = useState(() => emptyExportDocument('COMMERCIAL_INVOICE'))
  const [isDirty, setIsDirty] = useState(true)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [result, setResult] = useState(null)

  const selectedDocument = documents.find(item => item.document_id === selectedDocumentId) || null

  async function loadRecords() {
    const [documentResponse, historyResponse] = await Promise.all([
      fetch(`${API_BASE}/api/shipments/${encodeURIComponent(shipment.order_id)}/documents`),
      fetch(`${API_BASE}/api/shipments/${encodeURIComponent(shipment.order_id)}/reconciliations`)
    ])
    const [documentData, historyData] = await Promise.all([
      readApiJson(documentResponse), readApiJson(historyResponse)
    ])
    if (!documentResponse.ok) throw new Error(documentData.detail || 'Could not load export documents.')
    if (!historyResponse.ok) throw new Error(historyData.detail || 'Could not load reconciliation history.')
    setDocuments(Array.isArray(documentData.documents) ? documentData.documents : [])
    setHistory(Array.isArray(historyData.reconciliations) ? historyData.reconciliations : [])
  }

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      setLoading(true)
      setError('')
      try {
        const [documentResponse, historyResponse] = await Promise.all([
          fetch(`${API_BASE}/api/shipments/${encodeURIComponent(shipment.order_id)}/documents`),
          fetch(`${API_BASE}/api/shipments/${encodeURIComponent(shipment.order_id)}/reconciliations`)
        ])
        const [documentData, historyData] = await Promise.all([
          readApiJson(documentResponse), readApiJson(historyResponse)
        ])
        if (cancelled) return
        if (!documentResponse.ok) throw new Error(documentData.detail || 'Could not load export documents.')
        if (!historyResponse.ok) throw new Error(historyData.detail || 'Could not load reconciliation history.')
        const nextDocuments = Array.isArray(documentData.documents) ? documentData.documents : []
        setDocuments(nextDocuments)
        setHistory(Array.isArray(historyData.reconciliations) ? historyData.reconciliations : [])
        setSelectedDocumentId(current => (
          current && nextDocuments.some(item => item.document_id === current)
            ? current
            : nextDocuments[0]?.document_id || ''
        ))
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load export records.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    refresh()
    setResult(null)
    setNotice('')
    setSelectedFile(null)
    return () => { cancelled = true }
  }, [shipment.order_id])

  useEffect(() => {
    if (!selectedDocument) {
      setDraft(emptyExportDocument(documentType))
      setIsDirty(true)
      setResult(null)
      return
    }
    const confirmed = selectedDocument.confirmed_data
    const extracted = selectedDocument.extracted_data
    setDraft(confirmed || extracted || emptyExportDocument(selectedDocument.document_type))
    setIsDirty(selectedDocument.document_status !== 'CONFIRMED')
    setDocumentType(selectedDocument.document_type)
    setResult(null)
  }, [selectedDocumentId]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateField(field, value) {
    setDraft(current => ({ ...current, [field]: value, merchant_confirmed: false }))
    setIsDirty(true)
    setResult(null)
  }

  function updateAddress(field, value) {
    setDraft(current => ({
      ...current,
      recipient_address: { ...(current.recipient_address || {}), [field]: value },
      merchant_confirmed: false
    }))
    setIsDirty(true)
    setResult(null)
  }

  function updateItem(index, field, value) {
    setDraft(current => ({
      ...current,
      items: (current.items || []).map((item, i) => i === index ? { ...item, [field]: value } : item),
      merchant_confirmed: false
    }))
    setIsDirty(true)
    setResult(null)
  }

  function addItem() {
    setDraft(current => ({
      ...current,
      items: [...(current.items || []), {
        sku: '', description: '', quantity: null, unit_amount: '', line_total: ''
      }],
      merchant_confirmed: false
    }))
    setIsDirty(true)
    setResult(null)
  }

  function removeItem(index) {
    setDraft(current => ({
      ...current,
      items: (current.items || []).filter((_, i) => i !== index),
      merchant_confirmed: false
    }))
    setIsDirty(true)
    setResult(null)
  }

  async function uploadDocument() {
    if (!selectedFile) {
      setError('Choose an invoice or packing list first.')
      return
    }
    setUploading(true)
    setError('')
    setNotice('')
    setResult(null)
    try {
      const body = new FormData()
      body.append('file', selectedFile)
      body.append('document_type', documentType)
      const response = await fetch(
        `${API_BASE}/api/shipments/${encodeURIComponent(shipment.order_id)}/documents`,
        { method: 'POST', body }
      )
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.detail || 'Document upload failed.')
      const item = data.document
      setDocuments(current => [item, ...current.filter(existing => existing.document_id !== item.document_id)])
      setSelectedDocumentId(item.document_id)
      setDraft(item.extracted_data || emptyExportDocument(item.document_type))
      setIsDirty(true)
      setSelectedFile(null)
      setNotice(data.message || 'Document saved. Review its fields before continuing.')
    } catch (err) {
      setError(err.message || 'Document upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function confirmFields() {
    if (!selectedDocument) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(selectedDocument.document_id)}/confirm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: { ...draft, document_type: selectedDocument.document_type }, reviewer_label: 'Merchant' })
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.detail || 'Could not confirm document fields.')
      setDocuments(current => current.map(item => item.document_id === data.document_id ? data : item))
      setIsDirty(false)
      setNotice('Document fields confirmed by the merchant. You can now run reconciliation.')
      setResult(null)
    } catch (err) {
      setError(err.message || 'Could not confirm document fields.')
    } finally {
      setSaving(false)
    }
  }

  async function runReconciliation() {
    if (!selectedDocument || selectedDocument.document_status !== 'CONFIRMED' || isDirty) return
    setReconciling(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`${API_BASE}/api/shipments/${encodeURIComponent(shipment.order_id)}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: selectedDocument.document_id })
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.detail || 'Reconciliation could not be completed.')
      setResult(data)
      setNotice('Reconciliation saved to this shipment record.')
      await loadRecords()
    } catch (err) {
      setError(err.message || 'Reconciliation could not be completed.')
    } finally {
      setReconciling(false)
    }
  }

  function showPastResult(run) {
    setResult(run.result || null)
    setNotice(`Showing saved reconciliation from ${new Date(run.created_at).toLocaleString()}.`)
  }

  const isConfirmed = selectedDocument?.document_status === 'CONFIRMED' && !isDirty
  const statusLabel = selectedDocument
    ? selectedDocument.document_status.replaceAll('_', ' ')
    : 'NO DOCUMENTS'
  const checks = result?.checks || []
  const latestHistory = history.slice(0, 5)

  return (
    <section className="export-workflow-card" aria-label="Export document reconciliation">
      <div className="export-workflow-heading">
        <div>
          <div className="eyebrow">PAYMENT-TO-EXPORT RECONCILIATION</div>
          <h3>Export documents</h3>
          <p>Compare the paid PayPal order and finalized packing manifest with the commercial invoice or packing list.</p>
        </div>
        <span className={`pill ${isConfirmed ? 'pill-pass' : 'pill-warn'}`}>{statusLabel}</span>
      </div>

      <div className="export-sources-row">
        <div><small>PAYPAL CHECKOUT</small><strong>{shipment.checkout_order_id?.slice(0, 12)}…</strong></div>
        <div><small>PAYMENT CAPTURE</small><strong>{shipment.paypal_capture_id || shipment.transaction_id || '—'}</strong></div>
        <div><small>MANIFEST</small><strong>{'FINALIZED · HASHED'}</strong></div>
      </div>

      {error && <div className="findings-box issues" role="alert">{error}</div>}
      {notice && <div className="export-notice" role="status">{notice}</div>}

      <div className="export-upload-row">
        <div className="export-upload-controls">
          <label className="export-field">
            <span>Document type</span>
            <select className="form-control" value={documentType} onChange={event => setDocumentType(event.target.value)}>
              <option value="COMMERCIAL_INVOICE">Commercial invoice</option>
              <option value="PACKING_LIST">Packing list</option>
            </select>
          </label>
          <label className="export-field export-file-field">
            <span>Choose document (PDF, JPEG, PNG or WebP · max 10 MB)</span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={event => setSelectedFile(event.target.files?.[0] || null)}
            />
          </label>
        </div>
        <button className="btn-primary" type="button" onClick={uploadDocument} disabled={uploading || !selectedFile}>
          {uploading ? 'Uploading & extracting…' : 'Upload document'}
        </button>
      </div>

      {loading ? (
        <div className="export-empty-state" role="status">Loading shipment export records…</div>
      ) : documents.length > 0 ? (
        <div className="export-document-list" aria-label="Uploaded documents">
          {documents.map(item => (
            <button
              type="button"
              key={item.document_id}
              className={`export-document-chip ${item.document_id === selectedDocumentId ? 'active' : ''}`}
              onClick={() => { setSelectedDocumentId(item.document_id); setNotice(''); setError('') }}
            >
              <span>{item.document_type === 'COMMERCIAL_INVOICE' ? 'Invoice' : 'Packing list'}</span>
              <strong>{item.original_filename}</strong>
              <small>{item.document_status.replaceAll('_', ' ')} · {item.extraction_status.replaceAll('_', ' ')}</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="export-empty-state">
          No export document has been added to this shipment yet. Upload a PDF or image, or enter the fields manually below.
        </div>
      )}

      {selectedDocument && (
        <div className="export-review-panel">
          <div className="export-review-heading">
            <div>
              <h4>Review extracted fields</h4>
              <p>Original: {selectedDocument.original_filename} · SHA-256: <code>{selectedDocument.sha256?.slice(0, 16)}…</code></p>
            </div>
            <a href={`${API_BASE}/api/documents/${encodeURIComponent(selectedDocument.document_id)}/file`} target="_blank" rel="noreferrer">
              Open original
            </a>
          </div>

          {!selectedDocument.extracted_data && selectedDocument.extraction_status !== 'EXTRACTED' && (
            <div className="findings-box warnings">
              <strong>Manual field entry</strong>
              <p>{selectedDocument.extraction_error || 'AI extraction is not configured or did not complete. The original file is saved; fill in the document fields below.'}</p>
            </div>
          )}
          {selectedDocument.extracted_data?.extraction_notes?.length > 0 && (
            <div className="findings-box warnings">
              <strong>Extraction notes — verify these carefully</strong>
              {selectedDocument.extracted_data.extraction_notes.map((note, index) => <p key={index}>• {note}</p>)}
            </div>
          )}

          <div className="export-form-grid">
            <label className="export-field">
              <span>Document number</span>
              <input className="form-control" value={draft.document_number || ''} onChange={event => updateField('document_number', event.target.value)} />
            </label>
            <label className="export-field">
              <span>Currency</span>
              <input className="form-control" maxLength="3" placeholder="USD" value={draft.currency || ''} onChange={event => updateField('currency', event.target.value.toUpperCase())} />
            </label>
            <label className="export-field">
              <span>{draft.document_type === 'PACKING_LIST' ? 'Document total (optional)' : 'Invoice total'}</span>
              <input className="form-control" type="number" min="0" step="0.01" value={draft.total_amount ?? ''} onChange={event => updateField('total_amount', event.target.value)} />
            </label>
            <label className="export-field">
              <span>Recipient name</span>
              <input className="form-control" value={draft.recipient_name || ''} onChange={event => updateField('recipient_name', event.target.value)} />
            </label>
          </div>

          <div className="export-address-section">
            <strong>Recipient address</strong>
            <div className="export-form-grid">
              {[
                ['address_line_1', 'Address line 1'],
                ['address_line_2', 'Address line 2'],
                ['city', 'City'],
                ['state', 'State / region'],
                ['postal_code', 'Postal code'],
                ['country_code', 'Country code']
              ].map(([field, label]) => (
                <label className="export-field" key={field}>
                  <span>{label}</span>
                  <input className="form-control" value={draft.recipient_address?.[field] || ''} onChange={event => updateAddress(field, event.target.value)} />
                </label>
              ))}
            </div>
          </div>

          <div className="export-items-section">
            <div className="export-items-heading">
              <div><strong>Document line items</strong><small>Match by SKU where available, otherwise by description.</small></div>
              <button type="button" className="btn-secondary" onClick={addItem}>+ Add line</button>
            </div>
            {(draft.items || []).length === 0 ? (
              <div className="export-empty-state">No lines extracted. Add the items printed on the document.</div>
            ) : (
              <div className="export-lines-table-wrap">
                <table className="export-lines-table">
                  <thead><tr><th>SKU</th><th>Description</th><th>Qty</th><th>Unit value</th><th>Line total</th><th></th></tr></thead>
                  <tbody>
                    {(draft.items || []).map((item, index) => (
                      <tr key={index}>
                        <td><input aria-label={`Line ${index + 1} SKU`} className="form-control" value={item.sku || ''} onChange={event => updateItem(index, 'sku', event.target.value)} /></td>
                        <td><input aria-label={`Line ${index + 1} description`} className="form-control" value={item.description || ''} onChange={event => updateItem(index, 'description', event.target.value)} /></td>
                        <td><input aria-label={`Line ${index + 1} quantity`} className="form-control" type="number" min="1" step="1" value={item.quantity ?? ''} onChange={event => updateItem(index, 'quantity', event.target.value === '' ? null : Number(event.target.value))} /></td>
                        <td><input aria-label={`Line ${index + 1} unit value`} className="form-control" type="number" min="0" step="0.01" value={item.unit_amount ?? ''} onChange={event => updateItem(index, 'unit_amount', event.target.value)} /></td>
                        <td><input aria-label={`Line ${index + 1} line total`} className="form-control" type="number" min="0" step="0.01" value={item.line_total ?? ''} onChange={event => updateItem(index, 'line_total', event.target.value)} /></td>
                        <td><button type="button" className="export-remove-line" aria-label={`Remove line ${index + 1}`} onClick={() => removeItem(index)}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="export-review-actions">
            <span>{isConfirmed ? 'Merchant-confirmed fields saved.' : 'These fields are a draft until you confirm them.'}</span>
            <div>
              <button className="btn-secondary" type="button" onClick={confirmFields} disabled={saving || !isDirty}>
                {saving ? 'Saving…' : 'Confirm document fields'}
              </button>
              <button className="btn-primary" type="button" onClick={runReconciliation} disabled={reconciling || !isConfirmed}>
                {reconciling ? 'Reconciling…' : 'Run reconciliation'}
              </button>
            </div>
          </div>
          <p className="export-review-disclaimer">
            AI extraction is not verification. Review the original document before confirming. A reconciliation match is an operational consistency check, not customs clearance, carrier proof, PayPal Seller Protection eligibility or legal/export compliance advice.
          </p>
        </div>
      )}

      {result && (
        <div className="export-result-panel" aria-live="polite">
          <div className="export-result-header">
            <div><small>RECONCILIATION RESULT</small><strong>{result.overall_status?.replaceAll('_', ' ') || 'REVIEW REQUIRED'}</strong></div>
            <span>{result.summary?.matched || 0} matched · {result.summary?.mismatches || 0} mismatches · {result.summary?.not_checked || 0} not checked</span>
          </div>
          {(result.findings || []).map((check, index) => (
            <div className={`export-check-row ${check.status === 'MISMATCH' ? 'mismatch' : 'review'}`} key={`${check.code || 'check'}-${index}`}>
              <div><strong>{check.field || check.code}</strong><small>{check.message}</small></div>
              <span>{check.status?.replaceAll('_', ' ')}</span>
              {check.recommended_action && <p>{check.recommended_action}</p>}
            </div>
          ))}
        </div>
      )}

      {latestHistory.length > 0 && (
        <div className="export-history">
          <strong>Saved reconciliation history</strong>
          {latestHistory.map(run => (
            <button type="button" key={run.id} onClick={() => showPastResult(run)}>
              <span>{new Date(run.created_at).toLocaleString()}</span>
              <b>{run.overall_status?.replaceAll('_', ' ')}</b>
              <small>{run.document_id ? 'View saved result' : 'Historical run'}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}


// ─── Packing Station Workflow View ────────────────────────────────────────────
export function PackingStationView({ orders, activeShipmentId, setActiveShipmentId, navigateTo }) {
  const [manifest, setManifest] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Upload state
  const [selectedPhotos, setSelectedPhotos] = useState([]) // array of { file, previewUrl, id, sizeFormatted }
  const [photoShipmentId, setPhotoShipmentId] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('') // 'uploading' | 'analyzing'
  const [inspectionResult, setInspectionResult] = useState(null)
  const [lastInspectionStatus, setLastInspectionStatus] = useState(null) // HTTP status of last provider failure (503 outage or 429 rate/quota limit)
  const validationRun = useState(false)
  const aiAnalysisRun = useState(false)
  const inspectionInFlight = useRef(false) // synchronous guard against concurrent duplicate submissions

  const selectedShipment = useMemo(() => {
    return orders.find(o => o.order_id === activeShipmentId) || orders[0] || null
  }, [orders, activeShipmentId])

  // Synchronize photosRef inside an effect instead of render
  const photosRef = React.useRef([])
  useEffect(() => {
    photosRef.current = selectedPhotos
  }, [selectedPhotos])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      for (const p of photosRef.current) {
        if (p?.previewUrl) URL.revokeObjectURL(p.previewUrl)
      }
    }
  }, [])

  function switchShipment(orderId) {
    if (uploading) return
    // Revoke any existing object URLs
    for (const p of selectedPhotos) {
      if (p?.previewUrl) URL.revokeObjectURL(p.previewUrl)
    }
    setSelectedPhotos([])
    setPhotoShipmentId(null)
    setInspectionResult(null)
    setUploadError('')
    setProcessingStatus('')
    setManifest(null)
    setError('')
    setLoading(true)
    setActiveShipmentId(orderId)
  }

  // When selected shipment changes: clear existing photos/state and fetch its manifest
  const prevShipmentIdRef = React.useRef(selectedShipment?.order_id)
  useEffect(() => {
    if (prevShipmentIdRef.current !== selectedShipment?.order_id) {
      prevShipmentIdRef.current = selectedShipment?.order_id
      for (const p of photosRef.current) {
        if (p?.previewUrl) URL.revokeObjectURL(p.previewUrl)
      }
      setSelectedPhotos([])
      setPhotoShipmentId(null)
      setInspectionResult(null)
      setUploadError('')
      setProcessingStatus('')
      setManifest(null)
      setError('')
      setLoading(true)
    }

    let ignore = false
    async function fetchManifest() {
      if (!selectedShipment) return
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_BASE}/api/shipments/${selectedShipment.order_id}/manifest`)
        if (ignore) return
        if (res.status === 404) {
          setManifest(null)
        } else if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || 'Could not load manifest')
        } else {
          const data = await res.json()
          if (!ignore) setManifest(data)
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Error loading manifest')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    fetchManifest()
    return () => {
      ignore = true
    }
  }, [selectedShipment])

  // Format file size
  async function handleTrackingSubmit() {
    if (!selectedShipment || trackingSubmitting) return
    setTrackingSubmitting(true)
    setTrackingError('')
    setTrackingFeedback('')
    try {
      const res = await fetch(`${API_BASE}/api/shipments/${selectedShipment.order_id}/submit-tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracking_number: trackingNumber.trim(),
          carrier: trackingCarrier,
          carrier_name_other: trackingCarrier === 'OTHER' ? trackingCarrierOther.trim() : '',
          notify_payer: notifyPayer
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 502) {
          // The request may have reached PayPal before a network interruption.
          // Preserve the exact details so any retry is idempotent.
          setOrders(prev => prev.map(order =>
            order.order_id === selectedShipment.order_id
              ? {
                  ...order,
                  tracking_number: trackingNumber.trim(),
                  carrier: trackingCarrier,
                  carrier_name_other: trackingCarrier === 'OTHER' ? trackingCarrierOther.trim() : 'UNASSIGNED',
                  tracking_submission_status: 'FAILED'
                }
              : order
          ))
        }
        throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail) || 'Could not submit tracking to PayPal.')
      }
      setOrders(prev => prev.map(order =>
        order.order_id === selectedShipment.order_id
          ? {
              ...order,
              tracking_number: data.tracking_number || trackingNumber.trim(),
              carrier: data.carrier || trackingCarrier,
              carrier_name_other: trackingCarrier === 'OTHER' ? trackingCarrierOther.trim() : 'UNASSIGNED',
              status: 'SHIPPED',
              tracking_submission_status: 'SUBMITTED',
              paypal_tracking_submitted_at: data.submitted_at || order.paypal_tracking_submitted_at
            }
          : order
      ))
      setTrackingFeedback(data.already_submitted
        ? 'This tracking number was already submitted to PayPal.'
        : 'Tracking successfully submitted to PayPal Sandbox.')
    } catch (err) {
      setTrackingError(err.message || 'Could not submit tracking to PayPal.')
    } finally {
      setTrackingSubmitting(false)
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // Handle local photo selection with validation
  function handlePhotoSelect(e) {
    setUploadError('')
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const maxAllowed = 5
    if (selectedPhotos.length + files.length > maxAllowed) {
      setUploadError(`Maximum 5 photos allowed per inspection. You currently have ${selectedPhotos.length} selected.`)
      return
    }

    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']
    const maxBytes = 10 * 1024 * 1024 // 10MB

    const newItems = []
    for (const f of files) {
      if (!acceptedTypes.includes(f.type)) {
        setUploadError(`File '${f.name}' has unsupported format. Only JPEG, PNG, and WebP images are allowed.`)
        return
      }
      if (f.size > maxBytes) {
        setUploadError(`File '${f.name}' exceeds the 10 MB per-file limit (${formatBytes(f.size)}).`)
        return
      }
      newItems.push({
        file: f,
        previewUrl: URL.createObjectURL(f),
        id: Math.random().toString(36).substring(2, 9),
        name: f.name,
        sizeFormatted: formatBytes(f.size),
        sizeBytes: f.size
      })
    }

    setSelectedPhotos(prev => [...prev, ...newItems])
    setPhotoShipmentId(selectedShipment.order_id)
    // Reset file input value so same files can be re-selected if removed
    e.target.value = ''
  }

  function handleRemovePhoto(id) {
    setSelectedPhotos(prev => {
      const target = prev.find(p => p.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      const next = prev.filter(p => p.id !== id)
      if (next.length === 0) {
        setPhotoShipmentId(null)
      }
      return next
    })
  }

  async function handleSubmitInspection() {
    if (loading) {
      setUploadError('Please wait for the shipment manifest to finish loading.')
      return
    }
    if (!manifest || manifest.status !== 'FINALIZED') {
      setUploadError('A finalized manifest is required before submitting for packing inspection.')
      return
    }
    // Integrity check: Ensure manifest belongs to selected shipment
    if (!manifest.shipment_order_id || manifest.shipment_order_id !== selectedShipment.order_id) {
      setUploadError(`Manifest shipment mismatch: manifest belongs to ${manifest.shipment_order_id || 'unknown'}, but active shipment is ${selectedShipment.order_id}.`)
      return
    }
    if (selectedPhotos.length === 0) {
      setUploadError('Please select at least 1 photograph of the packing station.')
      return
    }
    // Fail-closed photo shipment check: must strictly match current shipment whenever photos are present
    if (!photoShipmentId || photoShipmentId !== selectedShipment.order_id) {
      setUploadError('The selected photographs do not match the current shipment. Please re-select photos.')
      return
    }

    // Synchronous in-flight guard: prevent rapid repeated clicks from starting
    // two inspection requests before React re-renders and updates `uploading`.
    if (inspectionInFlight.current) {
      return
    }
    inspectionInFlight.current = true

    setUploading(true)
    setUploadError('')
    setProcessingStatus('uploading')

    const formData = new FormData()
    for (const item of selectedPhotos) {
      formData.append('photos', item.file)
    }

    try {
      setProcessingStatus('analyzing')
      const res = await fetch(`${API_BASE}/api/manifests/${manifest.id}/inspections`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const data = await readApiJson(res)
        const detail = typeof data.detail === 'string'
          ? data.detail
          : (data.detail ? JSON.stringify(data.detail) : '')
        const err = new Error(
          detail || `Packing inspection request failed (HTTP ${res.status}). The server returned no readable error message. Your finalized manifest is unchanged; retry the inspection after the service recovers.`
        )
        err.status = res.status
        // Provider outages and rate/quota limits can be retried after the indicated wait.
        // Validation errors (422), conflicts (409), and other failures are not retryable.
        setLastInspectionStatus([429, 503].includes(res.status) ? res.status : null)
        throw err
      }

      const data = await readApiJson(res)
      if (!data.inspection_id) {
        throw new Error('The inspection service returned an incomplete response. No inspection result was saved; retry after checking the service.')
      }
      setInspectionResult(data)
      setProcessingStatus('complete')
      setUploadError('')
      setLastInspectionStatus(null)
    } catch (err) {
      setUploadError(err.message || 'Inspection request failed. Check the backend and configure GEMINI_API_KEY or OPENAI_API_KEY.')
      if (!err.status) {
        setLastInspectionStatus(null)
      }
    } finally {
      setUploading(false)
      inspectionInFlight.current = false
    }
  }

  const isManifestAssociated = Boolean(
    manifest &&
    manifest.shipment_order_id === selectedShipment.order_id
  )
  const isFinalized = isManifestAssociated && manifest?.status === 'FINALIZED'
  const canSelectPhotos = !loading && isFinalized && !uploading

  return (
    <main className="main" id="main-content">
      <header className="topbar">
        <div className="breadcrumb">
          <span>Workspace</span>
          <span>/</span>
          <strong>Packing Station &amp; AI Vision Inspection</strong>
        </div>
        <div className="topbar-actions">
          <button className="btn-secondary" onClick={() => navigateTo('/manifests')}>
            ← Back to Manifests
          </button>
        </div>
      </header>

      <div className="packing-layout">
        {/* Left: Shipment selector */}
        <aside className="manifest-shipments-sidebar" aria-label="Select Shipment">
          <div className="sidebar-section-title">
            <span>SELECT SHIPMENT</span>
            <small>{orders.length} Records</small>
          </div>
          <div className="manifest-shipment-cards">
            {orders.map(order => {
              const isSelected = selectedShipment?.order_id === order.order_id
              return (
                <button
                  key={order.order_id}
                  className={`manifest-shipment-card ${isSelected ? 'active' : ''}`}
                  disabled={uploading}
                  title={uploading ? 'Inspection upload in progress — shipment switching disabled' : ''}
                  onClick={() => {
                    switchShipment(order.order_id)
                  }}
                >
                  <div className="m-card-top">
                    <strong>{order.order_id}</strong>
                    <span className="m-card-status">{order.status}</span>
                  </div>
                  <div className="m-card-details">
                    <span>Carrier: {order.carrier || 'N/A'}</span>
                    <span>Tracking: {order.tracking_number ? `${order.tracking_number.slice(0, 10)}…` : 'Missing'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Right: Packing Station Workspace */}
        <section className="packing-main-panel" aria-label="Packing Station Area">
          {selectedShipment ? (
            <>
              {/* Manifest summary banner */}
              <div className="manifest-header-card">
                <div className="m-header-left">
                  <div className="eyebrow">PACKING VERIFICATION STATION</div>
                  <h2>{selectedShipment.order_id}</h2>
                  <p>
                    Carrier: <strong>{selectedShipment.carrier || 'Unspecified'}</strong> ·
                    Txn: <code>{selectedShipment.transaction_id}</code> ·
                    Order Total: <strong>${Number(selectedShipment.amount || 0).toFixed(2)} {selectedShipment.currency || 'USD'}</strong>
                  </p>
                </div>
                <div className="m-header-right">
                  {manifest ? (
                    <span className={`pill ${isFinalized ? 'pill-pass' : 'pill-warn'}`}>
                      {manifest.status}
                    </span>
                  ) : (
                    <span className="pill pill-unchecked">NO MANIFEST</span>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="checkout-state-box" style={{ padding: '40px' }} role="status">
                  <div className="checkout-state-icon loading-spinner"><SpinnerIcon /></div>
                  <p>Checking manifest status for {selectedShipment.order_id}…</p>
                </div>
              ) : error ? (
                <div className="findings-box issues" role="alert">{error}</div>
              ) : !manifest ? (
                /* No Manifest Empty State */
                <div className="checkout-state-box" style={{ padding: '48px 24px' }}>
                  <div className="checkout-state-icon" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>
                    <AlertIcon />
                  </div>
                  <h3>No Product Manifest Found</h3>
                  <p style={{ maxWidth: '460px', margin: '0 auto' }}>
                    Shipment <strong>{selectedShipment.order_id}</strong> does not have a manifest yet.
                    A finalized product manifest is required before uploading packing photos for AI vision inspection.
                  </p>
                  <button
                    className="btn-primary"
                    style={{ marginTop: '14px' }}
                    onClick={() => navigateTo('/manifests', { shipmentId: selectedShipment.order_id })}
                  >
                    Create Product Manifest →
                  </button>
                </div>
              ) : !isFinalized ? (
                /* Manifest is DRAFT, not yet finalized */
                <div className="checkout-state-box" style={{ padding: '48px 24px' }}>
                  <div className="checkout-state-icon" style={{ background: 'var(--info-bg)', color: 'var(--cobalt)' }}>
                    <LockIcon />
                  </div>
                  <h3>Manifest Is In Draft Status</h3>
                  <p style={{ maxWidth: '460px', margin: '0 auto' }}>
                    This shipment has a manifest with <strong>{manifest.items?.length || 0} items</strong>, but it has not been finalized.
                    Finalization locks the manifest and generates the SHA-256 fingerprint required for packing station verification.
                  </p>
                  <button
                    className="btn-primary"
                    style={{ marginTop: '14px' }}
                    onClick={() => navigateTo('/manifests', { shipmentId: selectedShipment.order_id })}
                  >
                    Open &amp; Finalize Manifest →
                  </button>
                </div>
              ) : (
                /* Finalized Manifest — Packing Station Active */
                <div className="packing-station-workspace">
                  {/* Finalized Manifest Snapshot */}
                  <div className="hash-display-banner">
                    <div className="hash-info">
                      <span className="hash-label">FINALIZED MANIFEST SNAPSHOT · SHA-256</span>
                      <code className="hash-code">{manifest.manifest_hash}</code>
                      <small className="hash-explanation">
                        Inspection compares photo evidence directly against this cryptographic manifest fingerprint ({manifest.items?.length || 0} items declared).
                      </small>
                    </div>
                    <span className="finalized-lock-tag">
                      <LockIcon /> Manifest Locked
                    </span>
                  </div>

                  {/* Declared items preview */}
                  <div className="declared-items-preview">
                    <strong>Declared Items for Inspection:</strong>
                    <div className="declared-items-chips">
                      {manifest.items?.map((it, i) => (
                        <span key={i} className="declared-chip">
                          <span className="chip-qty">{it.expected_qty}x</span>
                          <span className="chip-desc">{it.description}</span>
                          {it.sku && <span className="chip-sku">{it.sku}</span>}
                          {it.fragile && <span className="chip-fragile">FRAGILE</span>}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Upload Notification / Errors */}
                  {uploadError && (
                    <div className="findings-box issues" role="alert" style={{ marginBottom: '16px' }}>
                      {uploadError}
                      {[429, 503].includes(lastInspectionStatus) && selectedPhotos.length > 0 && !uploading && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleSubmitInspection}
                          style={{ marginTop: '10px', padding: '8px 14px', fontSize: '12px' }}
                        >
                          {lastInspectionStatus === 429 ? 'Retry after limit resets' : 'Retry Inspection'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Success Banner when inspection is completed in this session */}
                  {inspectionResult && (
                    <div className="pass-callout" role="status" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <strong>✓ AI Packing Inspection Completed!</strong>
                        <p style={{ margin: '4px 0 0', fontSize: '11px' }}>
                          Status: <strong>{inspectionResult.inspection_status}</strong> · {inspectionResult.photo_count} photos evaluated with model <code>{inspectionResult.model_used}</code>.
                        </p>
                      </div>
                      <button
                        className="btn-primary"
                        style={{ fontSize: '11px', padding: '6px 12px' }}
                        onClick={() => navigateTo('/inspections', { shipmentId: selectedShipment.order_id })}
                      >
                        View AI Inspection &amp; Human Review →
                      </button>
                    </div>
                  )}

                  {/* Photo Dropzone / Upload Area */}
                  <div className="photo-upload-container">
                    <div className="upload-header">
                      <div>
                        <h3>Packing Evidence Photographs</h3>
                        <p>One clear overview photo showing all unpacked items before sealing is usually enough. Add another only to show a separate item, a label or visible damage; repeated angles of the same item are not required.</p>
                      </div>
                      <span className="pill pill-unchecked">
                        {selectedPhotos.length} / 5 Photos
                      </span>
                    </div>

                    {/* Hidden file input */}
                    <input
                      type="file"
                      id="packing-photo-input"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={handlePhotoSelect}
                      disabled={!canSelectPhotos || selectedPhotos.length >= 5}
                    />

                    {selectedPhotos.length < 5 && canSelectPhotos && (
                      <label htmlFor="packing-photo-input" className="photo-dropzone">
                        <div className="dropzone-icon">
                          <CameraIcon />
                        </div>
                        <span className="dropzone-title">Click to upload packing station photos</span>
                        <small className="dropzone-sub">
                          JPEG, PNG or WebP · up to 10MB each · 1–5 photos when needed.
                        </small>
                      </label>
                    )}

                    {/* Thumbnails of selected photos */}
                    {selectedPhotos.length > 0 && (
                      <div className="selected-photos-grid">
                        {selectedPhotos.map((photo) => (
                          <div key={photo.id} className="photo-thumb-card">
                            <div className="thumb-preview-wrap">
                              <img src={photo.previewUrl} alt={photo.name} className="thumb-img" />
                              {!uploading && (
                                <button
                                  type="button"
                                  className="btn-remove-thumb"
                                  onClick={() => handleRemovePhoto(photo.id)}
                                  title="Remove photo"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                            <div className="thumb-meta">
                              <span className="thumb-name" title={photo.name}>{photo.name}</span>
                              <span className="thumb-size">{photo.sizeFormatted}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload / Processing State Indicator */}
                    {uploading && (
                      <div className="processing-indicator-box" role="status" aria-live="polite">
                        <div className="checkout-state-icon loading-spinner">
                          <SpinnerIcon />
                        </div>
                        <div className="processing-info">
                          <strong>
                            {processingStatus === 'uploading'
                              ? 'Uploading photographs to private storage…'
                              : 'AI vision inspecting shipment contents against the manifest…'}
                          </strong>
                          <p>
                            Validating image magic bytes, extracting item counts, checking for visible packaging defects, and binding inspection to SHA-256 fingerprint snapshot.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Submit Inspection Button */}
                    <div className="upload-submit-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => navigateTo('/inspections', { shipmentId: selectedShipment.order_id })}
                        disabled={uploading}
                      >
                        Inspect History ↗
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleSubmitInspection}
                        disabled={loading || !canSelectPhotos || uploading || selectedPhotos.length === 0}
                      >
                        {uploading
                          ? 'Processing AI Inspection…'
                          : `Run AI Vision Inspection (${selectedPhotos.length} Photo${selectedPhotos.length === 1 ? '' : 's'})`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="checkout-state-box" style={{ padding: '60px' }}>
              <p>No shipments available.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

// ─── AI Inspection Results & Human Review View ────────────────────────────────
function InspectionsReviewView({ orders, setOrders, paypal, activeShipmentId, setActiveShipmentId, navigateTo }) {
  const [manifest, setManifest] = useState(null)
  const [inspectionsList, setInspectionsList] = useState([])
  const [activeInspectionId, setActiveInspectionId] = useState(null)
  const [inspectionDetail, setInspectionDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [reviewError, setReviewError] = useState('')

  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingCarrier, setTrackingCarrier] = useState('OTHER')
  const [trackingCarrierOther, setTrackingCarrierOther] = useState('')
  const [notifyPayer, setNotifyPayer] = useState(false)
  const [trackingSubmitting, setTrackingSubmitting] = useState(false)
  const [trackingFeedback, setTrackingFeedback] = useState('')
  const [trackingError, setTrackingError] = useState('')

  const selectedShipment = useMemo(() => {
    return orders.find(o => o.order_id === activeShipmentId) || orders[0] || null
  }, [orders, activeShipmentId])

  // Load manifest & inspections list whenever active shipment changes
  useEffect(() => {
    setReviewFeedback('')
    setReviewError('')
    setTrackingNumber(selectedShipment?.tracking_number || '')
    setTrackingCarrier(selectedShipment?.carrier || 'OTHER')
    setTrackingCarrierOther(
      selectedShipment?.carrier === 'OTHER' && selectedShipment?.carrier_name_other !== 'UNASSIGNED'
        ? selectedShipment?.carrier_name_other || ''
        : ''
    )
    setTrackingFeedback('')
    setTrackingError('')
    let ignore = false
    async function fetchManifestAndInspections() {
      if (!selectedShipment) return
      setLoading(true)
      setError('')
      setManifest(null)
      setInspectionsList([])
      setActiveInspectionId(null)
      setInspectionDetail(null)

      try {
        const manRes = await fetch(`${API_BASE}/api/shipments/${selectedShipment.order_id}/manifest`)
        if (ignore) return
        if (manRes.status === 404) {
          setManifest(null)
          setLoading(false)
          return
        }
        if (!manRes.ok) {
          const data = await manRes.json().catch(() => ({}))
          throw new Error(data.detail || 'Could not load manifest')
        }

        const manData = await manRes.json()
        if (ignore) return
        setManifest(manData)

        // Fetch all inspections for this manifest
        const inspRes = await fetch(`${API_BASE}/api/manifests/${manData.id}/inspections`)
        if (ignore) return
        if (!inspRes.ok) {
          const inspErr = await inspRes.json().catch(() => ({}))
          throw new Error(inspErr.detail || 'Could not load inspection history')
        }

        const inspData = await inspRes.json()
        if (ignore) return
        const list = inspData.inspections || []
        setInspectionsList(list)

        if (list.length > 0) {
          setActiveInspectionId(list[0].inspection_id)
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Error loading inspections')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    fetchManifestAndInspections()
    return () => {
      ignore = true
    }
  }, [selectedShipment?.order_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch full inspection record whenever activeInspectionId changes
  useEffect(() => {
    let ignore = false
    async function fetchInspectionDetail() {
      if (!activeInspectionId) {
        setInspectionDetail(null)
        return
      }

      try {
        const res = await fetch(`${API_BASE}/api/inspections/${activeInspectionId}`)
        if (ignore) return
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || 'Could not load inspection detail')
        }
        const data = await res.json()
        if (!ignore) setInspectionDetail(data)
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to fetch inspection record')
      }
    }

    fetchInspectionDetail()
    return () => {
      ignore = true
    }
  }, [activeInspectionId])

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const aiResult = inspectionDetail?.ai_result
  const itemChecks = aiResult?.item_checks || []
  const addlObs = aiResult?.additional_observations || {}
  const imageQuality = aiResult?.image_quality || {}
  const engineMeta = aiResult?.engine_metadata || {}
  const latestInspectionId = inspectionsList[0]?.inspection_id
  const isLatestInspection = Boolean(inspectionDetail && inspectionDetail.inspection_id === latestInspectionId)
  const canHumanReview = isLatestInspection && inspectionDetail?.inspection_status === 'PENDING_HUMAN_REVIEW'
  const suggestedReviewNote = 'Verify that the photographed goods match the finalized manifest. Keep the shipment on hold until any mismatch is corrected and updated packing photos are recorded.'
  const canSubmitTracking =
    Boolean(selectedShipment?.checkout_order_id) &&
    isLatestInspection &&
    inspectionDetail?.inspection_status === 'APPROVED' &&
    selectedShipment?.tracking_submission_status !== 'SUBMITTED' &&
    Boolean(paypal?.submission_enabled)

  return (
    <main className="main" id="main-content">
      <header className="topbar">
        <div className="breadcrumb">
          <span>Workspace</span>
          <span>/</span>
          <strong>AI Packing Inspection &amp; Human Review</strong>
        </div>
        <div className="topbar-actions">
          <button className="btn-secondary" onClick={() => navigateTo('/packing')}>
            ← Back to Packing Station
          </button>
        </div>
      </header>


      <div className="packing-layout inspection-layout">
        <div className="inspection-shipment-toolbar">
          <label htmlFor="inspection-shipment-select">Shipment to review</label>
          <select
            id="inspection-shipment-select"
            className="form-control"
            value={selectedShipment?.order_id || ''}
            onChange={event => setActiveShipmentId(event.target.value)}
          >
            {orders.map(order => (
              <option key={order.order_id} value={order.order_id}>
                {order.order_id} · {order.status || 'UNKNOWN'} · {order.tracking_number ? 'Tracking added' : 'No tracking'}
              </option>
            ))}
          </select>
          <span>{orders.length} shipments</span>
        </div>

        {/* Right: Inspection & Human Review Area */}
        <section className="packing-main-panel" aria-label="Human Review Area">
          {selectedShipment ? (
            <>
              {/* Shipment Header */}
              <div className="manifest-header-card">
                <div className="m-header-left">
                  <div className="eyebrow">PERSISTED AI PACKING INSPECTION</div>
                  <h2>{selectedShipment.order_id}</h2>
                  <p>
                    Carrier: <strong>{selectedShipment.carrier || 'Unspecified'}</strong> ·
                    Txn: <code>{selectedShipment.transaction_id}</code> ·
                    Order Total: <strong>${Number(selectedShipment.amount || 0).toFixed(2)} {selectedShipment.currency || 'USD'}</strong>
                  </p>
                </div>
                <div className="m-header-right">
                  {inspectionDetail ? (
                    <span className="pill pill-warn" style={{ fontSize: '12px', padding: '8px 14px' }}>
                      {inspectionDetail.inspection_status}
                    </span>
                  ) : manifest ? (
                    <span className="pill pill-unchecked">{manifest.status}</span>
                  ) : (
                    <span className="pill pill-unchecked">NO MANIFEST</span>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="checkout-state-box" style={{ padding: '40px' }} role="status">
                  <div className="checkout-state-icon loading-spinner"><SpinnerIcon /></div>
                  <p>Loading inspection records for {selectedShipment.order_id}…</p>
                </div>
              ) : error ? (
                <div className="findings-box issues" role="alert">{error}</div>
              ) : !manifest ? (
                <div className="checkout-state-box" style={{ padding: '48px 24px' }}>
                  <div className="checkout-state-icon" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>
                    <AlertIcon />
                  </div>
                  <h3>No Manifest or Inspections Found</h3>
                  <p style={{ maxWidth: '460px', margin: '0 auto' }}>
                    Shipment <strong>{selectedShipment.order_id}</strong> does not have a manifest yet. Create and finalize a manifest to run AI packing inspections.
                  </p>
                  <button
                    className="btn-primary"
                    style={{ marginTop: '14px' }}
                    onClick={() => navigateTo('/manifests', { shipmentId: selectedShipment.order_id })}
                  >
                    Go to Manifest Management →
                  </button>
                </div>
              ) : inspectionsList.length === 0 ? (
                <div className="checkout-state-box" style={{ padding: '48px 24px' }}>
                  <div className="checkout-state-icon" style={{ background: 'var(--info-bg)', color: 'var(--cobalt)' }}>
                    <CameraIcon />
                  </div>
                  <h3>No Inspection Records Found</h3>
                  <p style={{ maxWidth: '460px', margin: '0 auto' }}>
                    Manifest <code>{manifest.id.slice(0, 8)}…</code> is {manifest.status}, but no visual inspections have been run yet.
                  </p>
                  <button
                    className="btn-primary"
                    style={{ marginTop: '14px' }}
                    onClick={() => navigateTo('/packing', { shipmentId: selectedShipment.order_id })}
                  >
                    Launch Packing Station &amp; Upload Photos →
                  </button>
                </div>
              ) : (
                <div className="inspections-view-content">
                  {/* Human Review Banner - Prominent & Mandatory Safeguard */}
                  <div className="human-review-banner">
                    <div className="hr-shield-badge">
                      <ShieldIcon />
                    </div>
                    <div className="hr-banner-text">
                      <div className="hr-title-row">
                        <strong>STATUS: {inspectionDetail?.inspection_status || 'PENDING_HUMAN_REVIEW'}</strong>
                        <span className={`pill ${inspectionDetail?.inspection_status === 'APPROVED' ? 'pill-pass' : inspectionDetail?.inspection_status === 'REJECTED' ? 'pill-blocked' : 'pill-warn'}`}>
                          {inspectionDetail?.inspection_status === 'APPROVED'
                            ? 'HUMAN REVIEW APPROVED'
                            : inspectionDetail?.inspection_status === 'REJECTED'
                            ? 'REJECTED'
                            : inspectionDetail?.inspection_status === 'NEEDS_CORRECTION'
                            ? 'CORRECTION REQUIRED'
                            : 'HUMAN ACTION REQUIRED'}
                        </span>
                      </div>
                      <p>
                        {inspectionDetail?.inspection_status === 'NEEDS_CORRECTION'
                          ? 'Correction requested. This shipment remains on hold until updated packing evidence is inspected.'
                          : inspectionDetail?.inspection_status === 'REJECTED'
                          ? 'This inspection was rejected. Resolve the packing issue and submit new evidence before dispatch.'
                          : inspectionDetail?.inspection_status === 'APPROVED'
                          ? 'A merchant approved this inspection. Tracking remains a separate step and is available only when PayPal submission is enabled.'
                          : 'AI provides visual observations only. The merchant makes the packing decision.'}
                      </p>
                    </div>
                  </div>

                  {/* Multi-inspection tabs if multiple runs exist */}
                  {inspectionsList.length > 1 && (
                    <div className="inspection-runs-bar">
                      <span className="runs-label">INSPECTION RUNS:</span>
                      {inspectionsList.map((insp, idx) => (
                        <button
                          key={insp.inspection_id}
                          className={`btn-run-tab ${activeInspectionId === insp.inspection_id ? 'active' : ''}`}
                          onClick={() => setActiveInspectionId(insp.inspection_id)}
                        >
                          Run #{inspectionsList.length - idx} ({new Date(insp.created_at).toLocaleTimeString()})
                        </button>
                      ))}
                    </div>
                  )}

                  {inspectionDetail && (
                    <>
{/* AI Summary Card */}
                      {aiResult?.inspection_summary && (
                        <div className="ai-summary-callout">
                          <div className="summary-callout-header">
                            <span className="eyebrow" style={{ color: 'var(--cobalt)', margin: 0 }}>AI VISION INSPECTION SUMMARY</span>
                            <span className={`quality-badge q-${(imageQuality.overall || 'fair').toLowerCase()}`}>
                              Image Quality: {imageQuality.overall || 'UNKNOWN'}
                            </span>
                          </div>
                          <p className="summary-callout-body">{aiResult.inspection_summary}</p>
                        </div>
                      )}

                      
{/* Photo Evidence Records (SHA-256 and Stored Metadata) */}
                      <div className="photo-records-card inspection-photo-gallery">
                        <div className="records-header">
                          <div>
                            <h3>Persisted Evidence Photographs</h3>
                            <p>Review the original packing photos below. Integrity records are available under each photo.</p>
                          </div>
                          <span className="pill pill-unchecked">
                            {inspectionDetail.photos?.length || 0} Photos Recorded
                          </span>
                        </div>

                        <div className="evidence-records-grid">
                          {inspectionDetail.photos?.map((photo, i) => (
                            <div key={photo.id || i} className="evidence-record-item">
                              <div className="evidence-record-badge">Photo #{i + 1}</div>
                              <img
                                className="persisted-evidence-photo"
                                src={`${API_BASE}/api/inspections/${inspectionDetail.inspection_id}/photos/${photo.id}`}
                                alt={`Persisted packing evidence photo ${i + 1}`}
                                loading="lazy"
                              />
                              <details className="photo-integrity-details">
                                <summary>Photo integrity details</summary>
                                <div className="ev-row">
                                  <span className="ev-label">SHA-256 Digest:</span>
                                  <code className="ev-hash" title={photo.sha256}>{photo.sha256}</code>
                                </div>
                                <div className="ev-row-split">
                                  <span>MIME: <strong>{photo.mime_type}</strong></span>
                                  <span>Size: <strong>{formatBytes(photo.size_bytes)}</strong></span>
                                </div>
                                <div className="ev-id-row">
                                  <small>Record ID: <code>{photo.id}</code></small>
                                </div>
                              </details>
                            </div>
                          ))}
                        </div>
                      </div>

                      

                      <div className="manifest-items-card inspection-decision-card">
                        <div className="items-card-header">
                          <div>
                            <h3>Merchant decision</h3>
                            <p>
                              {inspectionDetail.inspection_status === 'NEEDS_CORRECTION'
                                ? 'Correction request saved. The shipment is still on hold.'
                                : inspectionDetail.inspection_status === 'REJECTED'
                                ? 'Rejection saved. Resolve the packing issue before a new inspection.'
                                : inspectionDetail.inspection_status === 'APPROVED'
                                ? 'Approval saved for this inspection.'
                                : 'Check the original photos and decide whether this shipment can proceed.'}
                            </p>
                          </div>
                          <span className={`pill ${inspectionDetail.inspection_status === 'APPROVED' ? 'pill-pass' : inspectionDetail.inspection_status === 'REJECTED' ? 'pill-blocked' : 'pill-warn'}`}>
                            {inspectionDetail.inspection_status.replaceAll('_', ' ')}
                          </span>
                        </div>

                        {reviewFeedback && <div className="pass-callout" role="status">{reviewFeedback}</div>}
                        {reviewError && <div className="findings-box issues" role="alert">{reviewError}</div>}

                        {canHumanReview ? (
                          <form
                            className="inspection-decision-form"
                            action={`${API_BASE}/api/inspections/${inspectionDetail.inspection_id}/review/form`}
                            method="post"
                          >
                            <input type="hidden" name="reviewer_label" value="Merchant" />
                            <p className="inspection-decision-guidance">
                              The AI found that the two photographs show different notebooks and neither confirms the declared SKU.
                              The recommended action is to request corrected packing evidence and keep this shipment on hold.
                            </p>
                            <div className="form-group">
                              <label htmlFor="review-notes">Decision note</label>
                              <textarea
                                id="review-notes"
                                name="notes"
                                className="form-control"
                                rows="3"
                                maxLength={2000}
                                defaultValue={suggestedReviewNote}
                                placeholder="Explain what needs to be checked or corrected."
                              />
                            </div>
                            <div className="inspection-decision-actions">
                              <button type="submit" name="decision" value="NEEDS_CORRECTION" className="btn-primary">
                                Request correction
                              </button>
                              <button type="submit" name="decision" value="REJECTED" className="btn-secondary">
                                Reject inspection
                              </button>
                              <button type="submit" name="decision" value="APPROVED" className="btn-secondary">
                                Approve packing review
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="inspection-decision-form">
                            {!isLatestInspection ? (
                              <p>A newer inspection exists for this shipment. Only the latest inspection can receive a human decision.</p>
                            ) : inspectionDetail.inspection_status === 'NEEDS_CORRECTION' ? (
                              <>
                                <p>Next step: capture new photos showing the correct item and its packaging. The shipment stays on hold until a new inspection is reviewed.</p>
                                <button
                                  type="button"
                                  className="btn-primary"
                                  onClick={() => navigateTo('/packing', { shipmentId: selectedShipment.order_id })}
                                >
                                  Capture corrected packing photos →
                                </button>
                              </>
                            ) : inspectionDetail.inspection_status === 'REJECTED' ? (
                              <>
                                <p>Resolve the packing issue, then capture fresh evidence before creating another inspection.</p>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => navigateTo('/packing', { shipmentId: selectedShipment.order_id })}
                                >
                                  Return to Packing Station →
                                </button>
                              </>
                            ) : (
                              <p>A merchant approved this inspection. Tracking is the next step when PayPal submission is enabled.</p>
                            )}
                          </div>
                        )}

                        {(inspectionDetail.review_history || []).length > 0 && (
                          <div className="inspection-review-history">
                            <h4>Review history</h4>
                            {inspectionDetail.review_history.map(review => (
                              <div key={review.id} className="evidence-record-item">
                                <strong>{review.decision.replaceAll('_', ' ')}</strong>
                                <p>{review.notes || 'No additional notes.'}</p>
                                <small>{review.reviewer_label} · {new Date(review.created_at).toLocaleString()}</small>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      

                      <details className="inspection-technical-details">
                        <summary>Technical evidence and full AI analysis</summary>
                        {/* Inspection Metadata Bar */}
                      <div className="hash-display-banner">
                        <div className="hash-info">
                          <span className="hash-label">SNAPSHOT MANIFEST FINGERPRINT AT INSPECTION</span>
                          <code className="hash-code">{inspectionDetail.manifest_hash_at_inspection}</code>
                          <small className="hash-explanation">
                            Inspection ID: <code>{inspectionDetail.inspection_id}</code> ·
                            Model: <strong>{inspectionDetail.model_used}</strong> ·
                            Timestamp: {new Date(inspectionDetail.created_at).toLocaleString()}
                          </small>
                        </div>
                        <div className="insp-photo-badge">
                          {inspectionDetail.photo_count} Photo{inspectionDetail.photo_count === 1 ? '' : 's'} Evaluated
                        </div>
                      </div>
                        {/* Expected vs Observed Quantities Table */}
                      <div className="manifest-items-card">
                        <div className="items-card-header">
                          <div>
                            <h3>Expected vs. Observed Shipment Goods Audit</h3>
                            <p>AI vision observations are compared with the declared goods in the finalized manifest snapshot.</p>
                          </div>
                          <span className="stat-pill">{itemChecks.length} Items Checked</span>
                        </div>

                        <div className="manifest-table-wrap">
                          <table className="manifest-table">
                            <thead>
                              <tr>
                                <th style={{ width: '120px' }}>SKU</th>
                                <th>Item Description</th>
                                <th style={{ width: '90px', textAlign: 'center' }}>Expected</th>
                                <th style={{ width: '90px', textAlign: 'center' }}>Observed</th>
                                <th style={{ width: '130px', textAlign: 'center' }}>Result</th>
                                <th style={{ width: '100px', textAlign: 'center' }}>Confidence</th>
                                <th>Visual Evidence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itemChecks.map((chk, i) => {
                                const resultBadgeClass =
                                  chk.result === 'MATCH' ? 'pill-pass' :
                                  chk.result === 'POSSIBLE_MISSING' ? 'pill-blocked' :
                                  chk.result === 'POSSIBLE_EXTRA' ? 'pill-warn' :
                                  'pill-unchecked'

                                const confClass =
                                  chk.confidence === 'HIGH' ? 'score-chip high' :
                                  chk.confidence === 'MEDIUM' ? 'score-chip med' :
                                  'score-chip low'

                                return (
                                  <tr key={i}>
                                    <td className="field-readonly">{chk.sku || '—'}</td>
                                    <td>
                                      <strong>{chk.description}</strong>
                                    </td>
                                    <td style={{ textAlign: 'center' }} className="field-readonly bold">
                                      {chk.expected_qty}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <span className={`observed-qty-tag ${chk.observed_qty === null ? 'null-qty' : ''}`}>
                                        {chk.observed_qty === null ? 'Uncertain' : chk.observed_qty}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <span className={`pill ${resultBadgeClass}`}>
                                        {chk.result}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <span className={confClass} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                        {chk.confidence}
                                      </span>
                                    </td>
                                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                      {chk.visual_evidence || '—'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Observations Matrix: Damage, Extras, Uncertainties */}
                      <div className="observations-grid">
                        <div className="obs-card">
                          <h4>Visible Product Damage</h4>
                          {addlObs.visible_product_damage?.length > 0 ? (
                            <ul className="obs-list error-list">
                              {addlObs.visible_product_damage.map((d, i) => (
                                <li key={i}>⚠  {d}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="obs-none">✓ No visible product damage detected.</p>
                          )}
                        </div>

                        <div className="obs-card">
                          <h4>Visible Packaging Damage</h4>
                          {addlObs.visible_packaging_damage?.length > 0 ? (
                            <ul className="obs-list warn-list">
                              {addlObs.visible_packaging_damage.map((d, i) => (
                                <li key={i}>⚠  {d}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="obs-none">✓ Packaging appears intact without punctures or crushes.</p>
                          )}
                        </div>

                        <div className="obs-card">
                          <h4>Possible Extra Items</h4>
                          {addlObs.possible_extra_items?.length > 0 ? (
                            <ul className="obs-list warn-list">
                              {addlObs.possible_extra_items.map((ex, i) => (
                                <li key={i}>+ {ex}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="obs-none">None detected outside manifest.</p>
                          )}
                        </div>

                        <div className="obs-card">
                          <h4>Uncertainty &amp; Limitations</h4>
                          {addlObs.uncertainty_notes?.length > 0 ? (
                            <ul className="obs-list">
                              {addlObs.uncertainty_notes.map((u, i) => (
                                <li key={i}>• {u}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="obs-none">No explicit uncertainty notes logged.</p>
                          )}
                        </div>
                      </div>
                        {/* Engine Disclosure Disclaimer */}
                      <div className="engine-disclosure-card">
                        <div className="disclosure-head">
                          <strong>AI Engine Specification: {engineMeta.type || 'GEMINI_VISION_LLM'} ({engineMeta.model || inspectionDetail.model_used})</strong>
                          <span className="hallucination-warning">LLM output · Not guaranteed error-free</span>
                        </div>
                        <p className="disclosure-body">
                          {engineMeta.disclaimer ||
                            'Visual inspection only. Sealed container contents are not verified. This result requires human review before any shipment approval or rejection decision is made.'}
                        </p>
                      </div>
                      </details>

                      {selectedShipment.checkout_order_id && (
                        (inspectionDetail.inspection_status === 'APPROVED' ||
                          selectedShipment.tracking_submission_status === 'SUBMITTED' ||
                          selectedShipment.tracking_submission_status === 'FAILED') && (
                        <div className="manifest-items-card" style={{ marginTop: '18px' }}>
                          <div className="items-card-header">
                            <div>
                              <h3>Shipment Tracking &amp; PayPal Submission</h3>
                              <p>Tracking is unlocked only after the latest inspection is approved. PayPal receives the saved order and capture IDs plus the purchased items.</p>
                            </div>
                            <span className={`pill ${selectedShipment.tracking_submission_status === 'SUBMITTED' ? 'pill-pass' : 'pill-unchecked'}`}>
                              {(selectedShipment.tracking_submission_status || 'NOT_SUBMITTED').replaceAll('_', ' ')}
                            </span>
                          </div>

                          {selectedShipment.tracking_submission_status === 'SUBMITTED' ? (
                            <div className="pass-callout" role="status">
                              Tracking {selectedShipment.tracking_number} has been submitted to PayPal Sandbox.
                              {selectedShipment.paypal_tracking_submitted_at && <small style={{ display: 'block', marginTop: '4px' }}>{new Date(selectedShipment.paypal_tracking_submitted_at).toLocaleString()}</small>}
                            </div>
                          ) : canSubmitTracking ? (
                            <div style={{ padding: '16px' }}>
                              {trackingFeedback && <div className="pass-callout" role="status">{trackingFeedback}</div>}
                              {trackingError && <div className="findings-box issues" role="alert">{trackingError}</div>}
                              {selectedShipment.tracking_submission_status === 'FAILED' && (
                                <p className="findings-box warnings">The last PayPal submission failed. Check the details and retry. PayPal may already have received a request if the connection failed after sending; its Orders v2 tracking endpoint supports idempotent retries using the same capture and tracking IDs.</p>
                              )}
                              <div className="interactive-form-grid">
                                <div className="form-group">
                                  <label htmlFor="tracking-number">Carrier tracking number</label>
                                  <input id="tracking-number" className="form-control" maxLength={64} value={trackingNumber} readOnly={selectedShipment.tracking_submission_status === 'FAILED'} onChange={e => setTrackingNumber(e.target.value)} placeholder="Enter the carrier tracking number" />
                                </div>
                                <div className="form-group">
                                  <label htmlFor="tracking-carrier">Carrier</label>
                                  <select id="tracking-carrier" className="form-control" value={trackingCarrier} disabled={selectedShipment.tracking_submission_status === 'FAILED'} onChange={e => setTrackingCarrier(e.target.value)}>
                                    <option value="FEDEX">FedEx</option>
                                    <option value="UPS">UPS</option>
                                    <option value="USPS">USPS</option>
                                    <option value="DHL">DHL</option>
                                    <option value="OTHER">Other carrier</option>
                                  </select>
                                </div>
                                {trackingCarrier === 'OTHER' && (
                                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label htmlFor="tracking-carrier-other">Carrier name</label>
                                    <input id="tracking-carrier-other" className="form-control" maxLength={64} value={trackingCarrierOther} readOnly={selectedShipment.tracking_submission_status === 'FAILED'} onChange={e => setTrackingCarrierOther(e.target.value)} placeholder="e.g. Delhivery, Blue Dart" />
                                  </div>
                                )}
                                <div className="form-checkbox-row">
                                  <input id="notify-payer" type="checkbox" checked={notifyPayer} onChange={e => setNotifyPayer(e.target.checked)} />
                                  <label htmlFor="notify-payer" style={{ cursor: 'pointer' }}>Email the buyer PayPal tracking details</label>
                                </div>
                              </div>
                              <div className="remediation-actions" style={{ marginTop: '14px' }}>
                                <button className="btn-primary" disabled={trackingSubmitting || !trackingNumber.trim() || (trackingCarrier === 'OTHER' && !trackingCarrierOther.trim())} onClick={handleTrackingSubmit}>
                                  {trackingSubmitting ? 'Submitting to PayPal…' : 'Submit tracking to PayPal'}
                                </button>
                              </div>
                              <small style={{ display: 'block', marginTop: '10px', color: 'var(--text-muted)' }}>
                                Sandbox only. The local PayPal tracking write gate must be explicitly enabled before any external submission.
                              </small>
                            </div>
                          ) : (
                            <div style={{ padding: '16px' }}>
                              {trackingError && <div className="findings-box issues" role="alert">{trackingError}</div>}
                              <p>
                                {inspectionDetail.inspection_status !== 'APPROVED'
                                  ? 'Approve the latest inspection before submitting shipment tracking.'
                                  : !isLatestInspection
                                  ? 'Select the latest inspection for this shipment before submitting tracking.'
                                  : !paypal?.submission_enabled
                                  ? 'The PayPal Sandbox tracking write gate is locked. It must be enabled locally before a real Sandbox submission.'
                                  : 'Tracking submission is unavailable until the shipment has a valid saved PayPal checkout.'}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="checkout-state-box" style={{ padding: '60px' }}>
              <p>No shipments available.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

// ─── Checkout Catalog View ────────────────────────────────────────────────────
function CheckoutCatalogView({
  catalog,
  catalogLoading,
  catalogError,
  cart,
  checkoutLoading,
  checkoutError,
  checkoutDetails,
  setCheckoutDetails,
  loadCatalog,
  addToCart,
  removeFromCart,
  getCartItems,
  getCartTotal,
  handleCheckout,
  navigateTo
}) {
  const cartItemCount = getCartItems().reduce((s, i) => s + i.quantity, 0)
  const cartTotal = getCartTotal()
  const hasItems = cartItemCount > 0
  const regionRequiredCountries = ['AR', 'BR', 'CA', 'CN', 'ID', 'IN', 'JP', 'MX', 'TH', 'US']
  const regionRequired = regionRequiredCountries.includes(
    checkoutDetails.countryCode.trim().toUpperCase()
  )

  return (
    <main className="main" id="main-content">
      <header className="topbar">
        <div className="breadcrumb">
          <span>Workspace</span>
          <span>/</span>
          <strong>New Checkout</strong>
        </div>
        <div className="topbar-actions">
          <button
            className="btn-secondary"
            onClick={() => navigateTo('/')}
            aria-label="Back to Shipment Review dashboard"
          >
            ← Back to Shipment Review
          </button>
        </div>
      </header>

      <div className="checkout-layout">
        <section className="checkout-catalog-section" aria-labelledby="catalog-heading">
          <div className="queue-header" style={{ marginBottom: '20px' }}>
            <div className="queue-title">
              <div className="eyebrow">PRODUCT CATALOGUE</div>
              <h1 id="catalog-heading" className="checkout-page-heading">Shop physical products</h1>
              <p>Choose items from the demo store. Your paid order will carry these exact products into the merchant's packing manifest.</p>
            </div>
          </div>

          {catalogLoading ? (
            <div className="checkout-state-box" role="status" aria-live="polite">
              <div className="checkout-state-icon loading-spinner" aria-hidden="true">
                <SpinnerIcon />
              </div>
              <p>Loading product catalogue…</p>
            </div>
          ) : catalogError ? (
            <div className="checkout-state-box checkout-state-error" role="alert">
              <div className="checkout-state-icon error-icon" aria-hidden="true">
                <AlertIcon />
              </div>
              <p>{catalogError}</p>
              <button className="btn-primary" onClick={loadCatalog}>
                Retry
              </button>
            </div>
          ) : catalog.length === 0 ? (
            <div className="checkout-state-box" role="status">
              <p>No products available at the moment.</p>
            </div>
          ) : (
            <div className="catalog-grid">
              {catalog.map(product => {
                const qty = cart[product.sku] || 0
                return (
                  <article key={product.sku} className="catalog-card">
                    <div className="catalog-card-body">
                      <div className="catalog-card-sku">{product.sku}</div>
                      <h2 className="catalog-card-name">{product.name}</h2>
                      <p className="catalog-card-desc">{product.description}</p>
                    </div>
                    <div className="catalog-card-footer">
                      <div className="catalog-card-price" aria-label={`Price: $${parseFloat(product.price).toFixed(2)} USD`}>
                        <span className="price-amount">${parseFloat(product.price).toFixed(2)}</span>
                        <span className="price-currency">USD</span>
                      </div>
                      <div className="qty-controls" role="group" aria-label={`Quantity for ${product.name}`}>
                        <button
                          className="qty-btn"
                          onClick={() => removeFromCart(product.sku)}
                          disabled={qty === 0}
                          aria-label={`Decrease quantity of ${product.name}`}
                        >
                          −
                        </button>
                        <span className="qty-value" aria-live="polite" aria-atomic="true">{qty}</span>
                        <button
                          className="qty-btn"
                          onClick={() => addToCart(product.sku)}
                          aria-label={`Increase quantity of ${product.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <aside className="checkout-summary-panel" aria-labelledby="summary-heading">
          <div className="summary-header">
            <h2 id="summary-heading" className="summary-title">Order Summary</h2>
            <span className="summary-badge">
              {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          {hasItems ? (
            <>
              <ul className="summary-line-items" aria-label="Cart contents">
                {getCartItems().map(({ sku, quantity }) => {
                  const product = catalog.find(p => p.sku === sku)
                  if (!product) return null
                  const lineTotal = (parseFloat(product.price) * quantity).toFixed(2)
                  return (
                    <li key={sku} className="summary-line-item">
                      <div className="summary-line-name">
                        <span className="summary-line-product">{product.name}</span>
                        <span className="summary-line-sku">{product.sku}</span>
                      </div>
                      <div className="summary-line-right">
                        <span className="summary-line-qty">Ã— {quantity}</span>
                        <span className="summary-line-total">${lineTotal}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="summary-total-row">
                <div>
                  <div className="summary-total-label">Estimated Total</div>
                  <div className="summary-total-note">Server recalculates &amp; verifies final total</div>
                </div>
                <div className="summary-total-amount" aria-label={`Estimated total: $${cartTotal.toFixed(2)} USD`}>
                  ${cartTotal.toFixed(2)}
                </div>
              </div>
            </>
          ) : (
            <div className="summary-empty" role="status">
              <CartIcon />
              <p>Your cart is empty.<br />Add items from the catalogue.</p>
            </div>
          )}

          <section className="checkout-address-form" aria-labelledby="delivery-heading">
            <div>
              <h3 id="delivery-heading" className="checkout-address-title">Delivery details</h3>
              <p className="checkout-address-note">These details are saved with the order and sent to PayPal for this physical-goods purchase.</p>
            </div>
            <label className="checkout-field" htmlFor="checkout-buyer-name">
              <span>Recipient full name</span>
              <input
                id="checkout-buyer-name"
                type="text"
                autoComplete="shipping name"
                maxLength={100}
                value={checkoutDetails.buyerName}
                onChange={event => setCheckoutDetails(current => ({ ...current, buyerName: event.target.value }))}
                placeholder="Name on the delivery"
                required
              />
            </label>
            <label className="checkout-field" htmlFor="checkout-address-line1">
              <span>Street address</span>
              <input
                id="checkout-address-line1"
                type="text"
                autoComplete="shipping address-line1"
                maxLength={120}
                value={checkoutDetails.addressLine1}
                onChange={event => setCheckoutDetails(current => ({ ...current, addressLine1: event.target.value }))}
                placeholder="House number and street"
                required
              />
            </label>
            <label className="checkout-field" htmlFor="checkout-address-line2">
              <span>Apartment, suite or landmark <small>(optional)</small></span>
              <input
                id="checkout-address-line2"
                type="text"
                autoComplete="shipping address-line2"
                maxLength={120}
                value={checkoutDetails.addressLine2}
                onChange={event => setCheckoutDetails(current => ({ ...current, addressLine2: event.target.value }))}
                placeholder="Apartment, unit, building"
              />
            </label>
            <div className="checkout-address-grid">
              <label className="checkout-field" htmlFor="checkout-city">
                <span>City</span>
                <input
                  id="checkout-city"
                  type="text"
                  autoComplete="shipping address-level2"
                  maxLength={120}
                  value={checkoutDetails.city}
                  onChange={event => setCheckoutDetails(current => ({ ...current, city: event.target.value }))}
                  required
                />
              </label>
              <label className="checkout-field" htmlFor="checkout-state">
                <span>
                  State / region{' '}
                  <small>{regionRequired ? '(required)' : '(optional)'}</small>
                </span>
                <input
                  id="checkout-state"
                  type="text"
                  autoComplete="shipping address-level1"
                  maxLength={120}
                  value={checkoutDetails.state}
                  onChange={event => setCheckoutDetails(current => ({ ...current, state: event.target.value }))}
                  required={regionRequired}
                />
              </label>
              <label className="checkout-field" htmlFor="checkout-postal">
                <span>Postal code</span>
                <input
                  id="checkout-postal"
                  type="text"
                  autoComplete="shipping postal-code"
                  maxLength={120}
                  value={checkoutDetails.postalCode}
                  onChange={event => setCheckoutDetails(current => ({ ...current, postalCode: event.target.value }))}
                  required
                />
              </label>
              <label className="checkout-field" htmlFor="checkout-country">
                <span>Country code</span>
                <input
                  id="checkout-country"
                  type="text"
                  autoComplete="shipping country"
                  maxLength={2}
                  minLength={2}
                  value={checkoutDetails.countryCode}
                  onChange={event => setCheckoutDetails(current => ({ ...current, countryCode: event.target.value.toUpperCase() }))}
                  placeholder="IN"
                  required
                />
              </label>
            </div>
          </section>

          {checkoutError && (
            <div className="findings-box issues summary-error" role="alert">
              {checkoutError}
            </div>
          )}

          <button
            className="btn-paypal"
            onClick={handleCheckout}
            disabled={
              !hasItems ||
              checkoutLoading ||
              !checkoutDetails.buyerName.trim() ||
              !checkoutDetails.addressLine1.trim() ||
              !checkoutDetails.city.trim() ||
              !checkoutDetails.postalCode.trim() ||
              !/^[A-Z]{2}$/.test(checkoutDetails.countryCode.trim().toUpperCase()) ||
              (regionRequired && !checkoutDetails.state.trim())
            }
            aria-label={!hasItems ? 'Add items to cart before checking out' : 'Complete delivery details before PayPal checkout'}
          >
            {checkoutLoading ? (
              <>
                <span className="btn-spinner" aria-hidden="true"></span>
                Creating order…
              </>
            ) : (
              <>
                <PayPalIcon />
                Proceed to PayPal
              </>
            )}
          </button>

          <div className="summary-security-note">
            <LockIcon />
            <span>Payments processed securely via PayPal Sandbox. No charges until you approve.</span>
          </div>
        </aside>
      </div>
    </main>
  )
}

// ─── Checkout Return View ─────────────────────────────────────────────────────
function CheckoutReturnView({ captureLoading, captureError, captureResult, navigateTo }) {
  const isPaid = captureResult?.payment_status === 'PAID' || captureResult?.already_captured

  if (captureLoading) {
    return (
      <main className="main" id="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <span>New Checkout</span>
            <span>/</span>
            <strong>Processing Payment</strong>
          </div>
        </header>
        <div className="result-card-wrap">
          <div className="result-card" role="status" aria-live="polite" aria-label="Processing payment">
            <div className="result-card-icon processing">
              <SpinnerIcon />
            </div>
            <h1 className="result-card-heading">Processing payment…</h1>
            <p className="result-card-sub">Please wait while we confirm your payment with PayPal.</p>
          </div>
        </div>
      </main>
    )
  }

  if (captureError) {
    return (
      <main className="main" id="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <span>New Checkout</span>
            <span>/</span>
            <strong>Payment Error</strong>
          </div>
        </header>
        <div className="result-card-wrap">
          <div className="result-card result-card--error" role="alert">
            <div className="result-card-icon error">
              <CancelCircleIcon />
            </div>
            <h1 className="result-card-heading">Payment not verified</h1>
            <p className="result-card-sub">{captureError}</p>
            <div className="result-card-actions">
              <button className="btn-primary" onClick={() => navigateTo('/checkout')}>
                Try checkout again
              </button>
              <button className="btn-secondary" onClick={() => navigateTo('/')}>
                Shipment Review
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (isPaid) {
    return (
      <main className="main" id="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <span>New Checkout</span>
            <span>/</span>
            <strong>Payment Successful</strong>
          </div>
        </header>
        <div className="result-card-wrap">
          <div className="result-card result-card--success">
            <div className="result-card-icon success" aria-hidden="true">
              <SuccessCircleIcon />
            </div>
            <div className="result-status-badge pill pill-pass">PAID</div>
            <h1 className="result-card-heading">Payment successful</h1>
            <p className="result-card-sub">
              Your payment has been captured and confirmed by PayPal Sandbox.
            </p>

            <dl className="result-detail-list">
              <div className="result-detail-row">
                <dt>Local Order ID</dt>
                <dd className="result-detail-value">{captureResult.order_id}</dd>
              </div>
              {captureResult.buyer_name && (
                <div className="result-detail-row">
                  <dt>Recipient</dt>
                  <dd className="result-detail-value">{captureResult.buyer_name}</dd>
                </div>
              )}
              {captureResult.shipping_address && (
                <div className="result-detail-row">
                  <dt>Delivery Address</dt>
                  <dd className="result-detail-value">
                    {[
                      captureResult.shipping_address.address_line_1,
                      captureResult.shipping_address.address_line_2,
                      captureResult.shipping_address.city,
                      captureResult.shipping_address.state,
                      captureResult.shipping_address.postal_code,
                      captureResult.shipping_address.country_code
                    ].filter(Boolean).join(', ')}
                  </dd>
                </div>
              )}
              {captureResult.shipment_order_id && (
                <div className="result-detail-row">
                  <dt>Shipment ID</dt>
                  <dd className="result-detail-value">
                    <strong style={{ color: 'var(--primary, #0070ba)' }}>{captureResult.shipment_order_id}</strong>
                  </dd>
                </div>
              )}
              {captureResult.paypal_capture_id && (
                <div className="result-detail-row">
                  <dt>PayPal Capture ID</dt>
                  <dd className="result-detail-value">{captureResult.paypal_capture_id}</dd>
                </div>
              )}
              {captureResult.paypal_order_id && (
                <div className="result-detail-row">
                  <dt>PayPal Order ID</dt>
                  <dd className="result-detail-value">{captureResult.paypal_order_id}</dd>
                </div>
              )}
              <div className="result-detail-row">
                <dt>Payment Status</dt>
                <dd>
                  <span className="pill pill-pass">PAID</span>
                </dd>
              </div>
            </dl>

            {captureResult.items?.length > 0 && (
              <section className="result-order-items" aria-label="Items in this order">
                <h2>Items in this order</h2>
                <ul>
                  {captureResult.items.map(item => (
                    <li key={item.id || item.sku}>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.sku} · Qty {item.quantity} Ã— ${item.unit_price}</small>
                      </div>
                      <strong>${item.line_total}</strong>
                    </li>
                  ))}
                </ul>
                <div className="result-order-total">
                  <span>Total paid</span>
                  <strong>${captureResult.total} {captureResult.currency || 'USD'}</strong>
                </div>
              </section>
            )}

            <div className="result-card-actions">
              {captureResult.shipment_order_id ? (
                <button
                  className="btn-primary"
                  onClick={() => navigateTo('/manifests', { shipmentId: captureResult.shipment_order_id })}
                >
                  Review shipment manifest →
                </button>
              ) : null}
              <button className={captureResult.shipment_order_id ? 'btn-secondary' : 'btn-primary'} onClick={() => navigateTo('/')}>
                View Shipment Review
              </button>
              <button className="btn-secondary" onClick={() => navigateTo('/checkout')}>
                Create another checkout
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="main" id="main-content">
      <header className="topbar">
        <div className="breadcrumb">
          <span>Workspace</span>
          <span>/</span>
          <span>New Checkout</span>
          <span>/</span>
          <strong>Payment Unverified</strong>
        </div>
      </header>
      <div className="result-card-wrap">
        <div className="result-card result-card--error" role="alert">
          <div className="result-card-icon error" aria-hidden="true">
            <CancelCircleIcon />
          </div>
          <h1 className="result-card-heading">Payment not verified</h1>
          <p className="result-card-sub">
            We could not confirm a successful payment status. No funds have been taken. Please try again.
          </p>
          <div className="result-card-actions">
            <button className="btn-primary" onClick={() => navigateTo('/checkout')}>
              Try checkout again
            </button>
            <button className="btn-secondary" onClick={() => navigateTo('/')}>
              Shipment Review
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

// ─── Checkout Cancel View ─────────────────────────────────────────────────────
function CheckoutCancelView({ navigateTo }) {
  return (
    <main className="main" id="main-content">
      <header className="topbar">
        <div className="breadcrumb">
          <span>Workspace</span>
          <span>/</span>
          <span>New Checkout</span>
          <span>/</span>
          <strong>Payment Cancelled</strong>
        </div>
      </header>
      <div className="result-card-wrap">
        <div className="result-card result-card--cancel">
          <div className="result-card-icon cancel" aria-hidden="true">
            <CancelCircleIcon />
          </div>
          <div className="result-status-badge pill pill-warn">CANCELLED</div>
          <h1 className="result-card-heading">Payment not completed</h1>
          <p className="result-card-sub">
            You returned from PayPal without completing the checkout. No charges were made and your order has not been processed.
          </p>
          <div className="result-card-actions">
            <button className="btn-primary" onClick={() => navigateTo('/checkout')}>
              Return to checkout
            </button>
            <button className="btn-secondary" onClick={() => navigateTo('/')}>
              View Shipment Review
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(<App />)
}

