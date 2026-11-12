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
function Sidebar({ currentPath, ordersCount, navigateTo, demoUsername, onLogout, voiceAssistant }) {
  const isOrderWorkflow = ['/', '/manifests', '/packing', '/inspections'].includes(currentPath)
  const isCatalogue = currentPath === '/catalogue'
  const isCheckout = currentPath.startsWith('/checkout')
  return (
    <aside className="sidebar" aria-label="Application navigation">
      <div className="brand">
        <div className="brand-icon" aria-hidden="true">P</div>
        <div className="brand-title"><strong>ParcelProof AI</strong><small>PAYMENT-LINKED PACKING CHECKS</small></div>
      </div>
      <nav aria-label="Main navigation">
        <div className="nav-section">WORKFLOW</div>
        <button type="button" className={`nav-item nav-item-btn ${isOrderWorkflow ? 'active' : ''}`} onClick={() => navigateTo('/')} aria-current={isOrderWorkflow ? 'page' : undefined}><span aria-hidden="true">▣</span><span>Orders</span><span className="nav-badge" aria-label={`${ordersCount} paid orders`}>{ordersCount}</span></button>
        <div className="nav-section nav-section-secondary">SETUP</div>
        <button type="button" className={`nav-item nav-item-btn ${isCatalogue ? 'active' : ''}`} onClick={() => navigateTo('/catalogue')} aria-current={isCatalogue ? 'page' : undefined}><span aria-hidden="true"><ManifestIcon /></span><span>Products</span></button>
        <div className="nav-section nav-section-secondary">SANDBOX</div>
        <button type="button" className={`nav-item nav-item-btn ${isCheckout ? 'active' : ''}`} onClick={() => navigateTo('/checkout')} aria-current={isCheckout ? 'page' : undefined}><span aria-hidden="true"><CartIcon /></span><span>Test checkout</span></button>
      </nav>
      {voiceAssistant}
      {onLogout && (
        <div className="sidebar-session">
          <div className="sidebar-session-identity"><span className="sidebar-session-dot" aria-hidden="true" /><span><small>Signed in as</small><strong>{demoUsername || 'Merchant demo'}</strong></span></div>
          <button type="button" className="sidebar-logout" onClick={onLogout}>Sign out</button>
        </div>
      )}
    </aside>
  )
}

function OrderWorkflowProgress({ currentStep }) {
  const steps = [
    { title: 'Payment', detail: 'PayPal captured' },
    { title: 'Items', detail: 'Confirm order list' },
    { title: 'Packing', detail: 'Photo before sealing' },
    { title: 'Review', detail: 'Merchant decision' }
  ]
  return (
    <nav className="order-workflow-progress" aria-label="Order workflow progress">
      <ol>
        {steps.map((step, index) => {
          const number = index + 1
          const state = number < currentStep ? 'complete' : number === currentStep ? 'current' : 'upcoming'
          return (
            <li key={step.title} className={`order-workflow-step state-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="order-workflow-step-number" aria-hidden="true">{state === 'complete' ? '✓' : number}</span>
              <span className="order-workflow-step-copy"><strong>{step.title}</strong><small>{step.detail}</small></span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// ─── One-time product identity profiles ───────────────────────────────────────
export function ProductCatalogueView() {
  const [products, setProducts] = useState([])
  const [drafts, setDrafts] = useState({})
  const [referenceFiles, setReferenceFiles] = useState({})
  const [fileInputVersions, setFileInputVersions] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [savingSku, setSavingSku] = useState('')
  const [saveMessages, setSaveMessages] = useState({})
  const [saveErrors, setSaveErrors] = useState({})

  useEffect(() => {
    let ignore = false
    async function loadCatalogue() {
      setLoading(true)
      setLoadError('')
      try {
        const response = await fetch(`${API_BASE}/api/catalog/identity-profiles`)
        const data = await readApiJson(response)
        if (!response.ok) throw new Error(data.detail || 'Could not load product identity profiles.')
        if (ignore) return
        const catalogue = data.products || []
        setProducts(catalogue)
        setDrafts(Object.fromEntries(catalogue.map(product => [
          product.sku,
          {
            description: product.description || '',
            store_description: product.store_description || product.name || '',
            barcode_gtin: product.barcode_gtin || ''
          }
        ])))
      } catch (error) {
        if (!ignore) setLoadError(error.message || 'Could not load the product catalogue.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    loadCatalogue()
    return () => { ignore = true }
  }, [])

  function updateDraft(sku, field, value) {
    setDrafts(previous => ({
      ...previous,
      [sku]: { ...(previous[sku] || {}), [field]: value }
    }))
  }

  function updateReferenceFile(sku, file) {
    setReferenceFiles(previous => ({ ...previous, [sku]: file || null }))
    setSaveMessages(previous => ({ ...previous, [sku]: '' }))
    setSaveErrors(previous => ({ ...previous, [sku]: '' }))
  }

  async function saveProfile(sku) {
    const draft = drafts[sku]
    if (!draft) return
    setSavingSku(sku)
    setSaveMessages(previous => ({ ...previous, [sku]: '' }))
    setSaveErrors(previous => ({ ...previous, [sku]: '' }))

    const formData = new FormData()
    formData.append('description', String(draft.description || '').trim())
    formData.append('store_description', String(draft.store_description || '').trim())
    formData.append('barcode_gtin', String(draft.barcode_gtin || '').trim())
    if (referenceFiles[sku]) formData.append('reference_image', referenceFiles[sku])

    try {
      const response = await fetch(
        `${API_BASE}/api/catalog/${encodeURIComponent(sku)}/identity`,
        { method: 'PUT', body: formData }
      )
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.detail || 'Could not save the product identity profile.')
      if (data.product) {
        setProducts(previous => previous.map(product =>
          product.sku === sku ? data.product : product
        ))
        setDrafts(previous => ({
          ...previous,
          [sku]: {
            description: data.product.description || '',
            store_description: data.product.store_description || data.product.name || '',
            barcode_gtin: data.product.barcode_gtin || ''
          }
        }))
      }
      setReferenceFiles(previous => ({ ...previous, [sku]: null }))
      setFileInputVersions(previous => ({ ...previous, [sku]: (previous[sku] || 0) + 1 }))
      setSaveMessages(previous => ({
        ...previous,
        [sku]: 'Saved. This profile will be reused for future packing inspections.'
      }))
    } catch (error) {
      setSaveErrors(previous => ({
        ...previous,
        [sku]: error.message || 'Could not save the product identity profile.'
      }))
    } finally {
      setSavingSku('')
    }
  }

  return (
    <main className="main" id="main-content">
      <header className="topbar">
        <div className="breadcrumb">
          <span>Workspace</span>
          <span>/</span>
          <strong>Product Catalogue</strong>
        </div>
        <div className="topbar-actions">
          <span className="pill pill-unchecked">ONE-TIME PRODUCT SETUP</span>
        </div>
      </header>

      <section className="catalogue-identity-intro">
        <div>
          <div className="eyebrow">PRODUCT IDENTITY</div>
          <h1>Set up each product once.</h1>
          <p>
            Add the product description customers see and, when useful, a clear reference photo.
            Extra matching details and barcode numbers are optional.
          </p>
        </div>
        <div className="catalogue-identity-note">
          <strong>Keep product setup simple</strong>
          <span>Only the short description appears at checkout. Extra details and reference photos stay private.</span>
        </div>
      </section>

      {loadError && <div className="findings-box issues" role="alert">{loadError}</div>}

      {loading ? (
        <div className="checkout-state-box" role="status">
          <div className="checkout-state-icon loading-spinner"><SpinnerIcon /></div>
          <p>Loading product catalogue…</p>
        </div>
      ) : products.length === 0 ? (
        <div className="checkout-state-box">
          <h3>No active products</h3>
          <p>The product catalogue does not contain any active SKUs yet.</p>
        </div>
      ) : (
        <div className="product-profile-grid">
          {products.map(product => {
            const draft = drafts[product.sku] || {
              description: product.description || '',
              store_description: product.store_description || product.name || '',
              barcode_gtin: product.barcode_gtin || ''
            }
            const isSaving = savingSku === product.sku
            return (
              <article className="product-profile-card" key={product.sku}>
                <div className="product-profile-heading">
                  <div>
                    <span className="eyebrow">CATALOGUE SKU</span>
                    <h2>{product.name}</h2>
                    <code>{product.sku}</code>
                  </div>
                  <span className={product.has_reference_image ? 'pill pill-pass' : 'pill pill-unchecked'}>
                    {product.has_reference_image ? 'REFERENCE SAVED' : 'SETUP NEEDED'}
                  </span>
                </div>

                <div className="product-profile-reference">
                  {product.has_reference_image && product.reference_image_url ? (
                    <img
                      src={`${API_BASE}${product.reference_image_url}`}
                      alt={`Saved catalogue reference for ${product.name}`}
                    />
                  ) : (
                    <div className="product-profile-empty-image">
                      <span aria-hidden="true">▧</span>
                      <strong>No reference image saved</strong>
                      <small>Add one clear image of the actual product, once.</small>
                    </div>
                  )}
                </div>

                <form className="product-profile-form" onSubmit={event => {
                  event.preventDefault()
                  saveProfile(product.sku)
                }}>
                  <label className="product-profile-field">
                    <span>Short description for buyers</span>
                    <textarea
                      aria-label={`Shop description for ${product.name}`}
                      rows={2}
                      maxLength={180}
                      value={draft.store_description}
                      onChange={event => updateDraft(product.sku, 'store_description', event.target.value)}
                      placeholder="e.g. Stoneware coffee mug with a glazed finish."
                      required
                    />
                    <small>Shown on the product page and checkout.</small>
                  </label>

                  <details className="product-profile-advanced">
                    <summary>Extra details to help identify this version (optional)</summary>
                    <label className="product-profile-field">
                      <span>What helps tell this product apart?</span>
                      <textarea
                        aria-label={`Product matching details for ${product.name}`}
                        rows={2}
                        maxLength={500}
                        value={draft.description}
                        onChange={event => updateDraft(product.sku, 'description', event.target.value)}
                        placeholder="For example: navy cover, leaf print, round handle or 160 pages."
                      />
                      <small>Examples: navy cover, leaf print or round handle. Leave blank when a reference photo is enough.</small>
                    </label>
                    <label className="product-profile-field">
                      <span>Barcode number (optional)</span>
                      <input
                        aria-label={`Barcode number for ${product.name}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={20}
                        value={draft.barcode_gtin}
                        onChange={event => updateDraft(product.sku, 'barcode_gtin', event.target.value)}
                        placeholder="Digits printed below the barcode"
                      />
                      <small>We check the number's format and check digit. This form does not scan barcodes.</small>
                    </label>
                  </details>

                  <label className="product-profile-field">
                    <span>Reference photo (optional)</span>
                    <input
                      key={`${product.sku}-${fileInputVersions[product.sku] || 0}`}
                      aria-label={`Reference photo for ${product.name}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={event => updateReferenceFile(product.sku, event.target.files?.[0] || null)}
                    />
                    <small>One clear image of the actual product. Reused for future packing checks.</small>
                    {referenceFiles[product.sku] && (
                      <small className="product-profile-selected-file">Selected: {referenceFiles[product.sku].name}</small>
                    )}
                  </label>

                  {saveErrors[product.sku] && (
                    <div className="findings-box issues" role="alert">{saveErrors[product.sku]}</div>
                  )}
                  {saveMessages[product.sku] && (
                    <div className="pass-callout" role="status">{saveMessages[product.sku]}</div>
                  )}

                  <div className="product-profile-actions">
                    <span>{product.has_reference_image ? 'Reference photo saved' : 'Reference photo not added'}</span>
                    <button className="btn-primary" type="submit" disabled={isSaving}>
                      {isSaving ? 'Saving…' : 'Save product'}
                    </button>
                  </div>
                </form>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}


const VOICE_COMMANDS = {
  en: {
    pending: ["what needs packing", "show pending orders", "read my orders", "what orders are waiting"],
    packing: ["go to packing", "open packing", "start packing", "packing station", "inspect this order"],
    list: ["read packing list", "show packing list", "what am i packing", "what is in this order"],
    inspection: ["go to inspections", "open inspections", "review inspection", "show inspection"],
    ai: ["what did ai find", "read ai result", "inspection result", "what is the inspection result"],
    products: ["go to products", "open products", "show products"],
    orders: ["go to orders", "open orders", "show orders"],
    next: ["next step", "what is next", "what should i do next"],
    capture: ["take a photo", "capture photo", "add packing photo"],
    dictate: ["dictate note", "add a voice note", "speak a note"],
    help: ["help", "what can i say", "voice commands"]
  },
  hi: {
    pending: ["क्या पैक करना है", "कौन से ऑर्डर बाकी हैं", "बाकी ऑर्डर दिखाओ", "ऑर्डर पढ़ो"],
    packing: ["पैकिंग पर जाओ", "पैकिंग खोलो", "पैकिंग शुरू करो", "इस ऑर्डर की पैकिंग"],
    list: ["पैकिंग सूची पढ़ो", "पैकिंग लिस्ट दिखाओ", "इस ऑर्डर में क्या है"],
    inspection: ["इंस्पेक्शन दिखाओ", "जांच दिखाओ", "इंस्पेक्शन पर जाओ"],
    ai: ["एआई ने क्या पाया", "एआई का नतीजा बताओ", "जांच का नतीजा"],
    products: ["प्रोडक्ट दिखाओ", "प्रोडक्ट पर जाओ", "उत्पाद दिखाओ"],
    orders: ["ऑर्डर पर जाओ", "ऑर्डर दिखाओ"],
    next: ["अगला कदम क्या है", "अब क्या करना है", "आगे क्या करना है"],
    capture: ["फोटो लो", "फोटो खींचो", "पैकिंग की फोटो लो"],
    dictate: ["नोट बोलो", "नोट लिखो", "वॉइस नोट"],
    help: ["मदद", "क्या बोल सकता हूं", "कमांड बताओ"]
  },
  te: {
    pending: ["ఏమి ప్యాక్ చేయాలి", "పెండింగ్ ఆర్డర్లు చూపించు", "ఏ ఆర్డర్లు మిగిలి ఉన్నాయి", "ఆర్డర్లు చదువు"],
    packing: ["ప్యాకింగ్‌కు వెళ్ళు", "ప్యాకింగ్ తెరువు", "ప్యాకింగ్ ప్రారంభించు", "ఈ ఆర్డర్ ప్యాక్ చేయి"],
    list: ["ప్యాకింగ్ జాబితా చదువు", "ప్యాకింగ్ లిస్ట్ చూపించు", "ఈ ఆర్డర్‌లో ఏముంది"],
    inspection: ["తనిఖీ చూపించు", "ఇన్‌స్పెక్షన్ తెరువు", "ఇన్‌స్పెక్షన్‌కు వెళ్ళు"],
    ai: ["ఏఐ ఏమి కనుగొంది", "ఏఐ ఫలితం చెప్పు", "తనిఖీ ఫలితం చెప్పు"],
    products: ["ఉత్పత్తులు చూపించు", "ప్రొడక్ట్స్ తెరువు"],
    orders: ["ఆర్డర్లకు వెళ్ళు", "ఆర్డర్లు చూపించు"],
    next: ["తర్వాత ఏమి చేయాలి", "తదుపరి దశ ఏమిటి", "ఇప్పుడు ఏమి చేయాలి"],
    capture: ["ఫోటో తీయి", "ఫోటో తీసుకో", "ప్యాకింగ్ ఫోటో తీయి"],
    dictate: ["నోట్ చెప్పు", "నోట్ రికార్డ్ చేయి", "వాయిస్ నోట్"],
    help: ["సహాయం", "ఏమి చెప్పవచ్చు", "కమాండ్లు చెప్పు"]
  }
}

export function parseParcelProofVoiceCommand(input, language = "en-IN") {
  const text = String(input || "").trim().toLocaleLowerCase()
  if (!text) return { type: "unknown" }

  const noteMatch = text.match(/^(?:add a note|add note|note|write note)\s*[:,.-]?\s*(.+)$/i)
  if (noteMatch && noteMatch[1].trim()) return { type: "note", text: noteMatch[1].trim() }

  const orderMatch = text.toUpperCase().match(/\b(SHP-[A-Z0-9-]+|ORD-\d+)\b/)
  if (orderMatch) return { type: "open-order", orderId: orderMatch[1] }

  const key = language.toLowerCase().startsWith("hi") ? "hi"
    : language.toLowerCase().startsWith("te") ? "te" : "en"
  const commands = VOICE_COMMANDS[key]
  for (const [type, phrases] of Object.entries(commands)) {
    if (phrases.some(phrase => text.includes(phrase.toLocaleLowerCase()))) return { type }
  }
  return { type: "unknown" }
}

const VOICE_COPY = {
  "en": {
    welcome: "Hi. Ask what needs packing, say read packing list, or ask what the AI found.",
    listening: "Listening. Speak now.",
    noOrders: "There are no paid orders waiting to be packed.",
    openingOrders: "Opening orders.",
    openingProducts: "Opening products.",
    openingInspection: "Opening inspection review.",
    noActive: "Choose a paid order first. I can open the first order waiting to be packed.",
    noManifest: "This order has no packing list yet. Open manifest management to create and finalize one.",
    noInspections: "There is no AI inspection for this order yet. Add a packing photo and run the inspection from the packing station.",
    noteReady: "Your note has been added to the review form. Check it before submitting your decision.",
    noNoteField: "Open the latest inspection and expand the optional note field first. Then dictate your note.",
    safeDecision: "I have opened the inspection review. For safety, use the visible review button to record approval, correction or rejection.",
    captureHelp: "Open the packing station and tap the photo area to choose or capture a picture. I cannot open the camera without a direct tap.",
    help: "You can ask: what needs packing, read packing list, go to packing, what did AI find, go to orders, or show products. On the review screen, use dictate review note to speak a note.",
    unknown: "I did not understand that command. Say help to hear examples.",
    error: "Voice input could not start. Check microphone permission and try again."
  },
  "hi": {
    welcome: "नमस्ते। पूछें कि क्या पैक करना है, पैकिंग सूची पढ़ने को कहें, या एआई का परिणाम पूछें।",
    listening: "सुन रहा हूँ। अब बोलिए।",
    noOrders: "अभी पैक करने के लिए कोई भुगतान किया हुआ ऑर्डर नहीं है।",
    openingOrders: "ऑर्डर खोल रहा हूँ।",
    openingProducts: "प्रोडक्ट खोल रहा हूँ।",
    openingInspection: "इंस्पेक्शन समीक्षा खोल रहा हूँ।",
    noActive: "पहले एक भुगतान किया हुआ ऑर्डर चुनें।",
    noManifest: "इस ऑर्डर की पैकिंग सूची अभी नहीं है। पहले मैनिफेस्ट बनाकर फाइनल करें।",
    noInspections: "इस ऑर्डर का एआई निरीक्षण अभी नहीं हुआ है। पहले फोटो जोड़कर पैकिंग स्टेशन से जांच शुरू करें।",
    noteReady: "आपका नोट समीक्षा फ़ॉर्म में जोड़ दिया गया है। निर्णय भेजने से पहले इसे जांच लें।",
    noNoteField: "पहले नवीनतम निरीक्षण खोलें और नोट फ़ील्ड दिखाएँ। फिर नोट बोलें।",
    safeDecision: "मैंने निरीक्षण समीक्षा खोल दी है। सुरक्षा के लिए निर्णय दर्ज करने हेतु स्क्रीन पर दिया गया बटन दबाएँ।",
    captureHelp: "पैकिंग स्टेशन खोलें और फोटो क्षेत्र पर टैप करके फोटो चुनें या लें। कैमरा खोलने के लिए सीधे टैप करना ज़रूरी है।",
    help: "आप पूछ सकते हैं कि क्या पैक करना है, पैकिंग सूची पढ़ने को कह सकते हैं, पैकिंग खोलने को कह सकते हैं या एआई का परिणाम पूछ सकते हैं।",
    unknown: "मैं यह निर्देश समझ नहीं पाया। उदाहरण सुनने के लिए मदद कहें।",
    error: "आवाज़ शुरू नहीं हो सकी। माइक्रोफ़ोन की अनुमति जांचें और फिर कोशिश करें।"
  },
  "te": {
    welcome: "నమస్కారం. ఏమి ప్యాక్ చేయాలో అడగండి, ప్యాకింగ్ జాబితా చదవమని చెప్పండి లేదా ఏఐ ఫలితం అడగండి.",
    listening: "వింటున్నాను. ఇప్పుడు మాట్లాడండి.",
    noOrders: "ప్యాక్ చేయడానికి చెల్లించిన ఆర్డర్లు లేవు.",
    openingOrders: "ఆర్డర్లను తెరుస్తున్నాను.",
    openingProducts: "ఉత్పత్తులను తెరుస్తున్నాను.",
    openingInspection: "తనిఖీ సమీక్షను తెరుస్తున్నాను.",
    noActive: "ముందుగా చెల్లించిన ఆర్డర్‌ను ఎంచుకోండి.",
    noManifest: "ఈ ఆర్డర్‌కు ప్యాకింగ్ జాబితా లేదు. ముందుగా మానిఫెస్ట్‌ను సృష్టించి ఖరారు చేయండి.",
    noInspections: "ఈ ఆర్డర్‌కు ఇంకా ఏఐ తనిఖీ లేదు. ముందుగా ఫోటో జోడించి ప్యాకింగ్ స్టేషన్‌లో తనిఖీ చేయండి.",
    noteReady: "మీ నోట్ సమీక్ష ఫారంలో జోడించబడింది. నిర్ణయం పంపే ముందు దాన్ని తనిఖీ చేయండి.",
    noNoteField: "ముందుగా తాజా తనిఖీని తెరిచి నోట్ ఫీల్డ్‌ను చూపించండి. తరువాత మాట్లాడండి.",
    safeDecision: "తనిఖీ సమీక్షను తెరిచాను. భద్రత కోసం నిర్ణయం నమోదు చేయడానికి తెరపై ఉన్న బటన్‌ను నొక్కండి.",
    captureHelp: "ప్యాకింగ్ స్టేషన్ తెరిచి ఫోటో ప్రాంతాన్ని నొక్కి ఫోటో ఎంచుకోండి లేదా తీయండి. కెమెరా తెరవడానికి నేరుగా నొక్కాలి.",
    help: "ఏమి ప్యాక్ చేయాలి, ప్యాకింగ్ జాబితా చదువు, ప్యాకింగ్‌కు వెళ్ళు లేదా ఏఐ ఏమి కనుగొందని అడగవచ్చు.",
    unknown: "ఆ ఆదేశం అర్థం కాలేదు. ఉదాహరణల కోసం సహాయం అడగండి.",
    error: "వాయిస్ ప్రారంభం కాలేదు. మైక్రోఫోన్ అనుమతిని తనిఖీ చేసి మళ్లీ ప్రయత్నించండి."
  }
}

function voiceLocaleKey(language) {
  return String(language || "en-IN").toLowerCase().startsWith("hi") ? "hi"
    : String(language || "en-IN").toLowerCase().startsWith("te") ? "te" : "en"
}

function VoiceAssistant({ orders, activeShipmentId, setActiveShipmentId, navigateTo, currentPath }) {
  const [open, setOpen] = useState(false)
  const [language, setLanguage] = useState("en-IN")
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState("")
  const [reply, setReply] = useState(VOICE_COPY.en.welcome)
  const [error, setError] = useState("")
  const recognitionRef = useRef(null)
  const copy = VOICE_COPY[voiceLocaleKey(language)]

  const pendingOrders = useMemo(() => (orders || []).filter(order => {
    if (!order.checkout_order_id) return false
    return !["SHIPPED", "DELIVERED", "CANCELLED"].includes(String(order.status || "").toUpperCase())
  }), [orders])

  const selectedOrder = useMemo(() => {
    return (orders || []).find(order => order.order_id === activeShipmentId)
      || pendingOrders[0]
      || (orders || []).find(order => Boolean(order.checkout_order_id))
      || null
  }, [orders, activeShipmentId, pendingOrders])

  useEffect(() => () => {
    try { recognitionRef.current?.stop() } catch { /* recognition may already have stopped */ }
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel()
  }, [])

  function say(message) {
    setReply(message)
    setError("")
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    try {
      window.speechSynthesis.cancel()
      const utterance = new window.SpeechSynthesisUtterance(message)
      utterance.lang = language
      utterance.rate = 0.96
      const voices = window.speechSynthesis.getVoices()
      const exactVoice = voices.find(voice => voice.lang.toLowerCase() === language.toLowerCase())
      const baseVoice = voices.find(voice => voice.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()))
      if (exactVoice || baseVoice) utterance.voice = exactVoice || baseVoice
      window.speechSynthesis.speak(utterance)
    } catch {
      // Text response remains available when speech output is unavailable.
    }
  }

  async function getJson(path) {
    const response = await fetch(API_BASE + path)
    const data = await readApiJson(response)
    if (!response.ok) throw new Error(data.detail || "Could not load this information.")
    return data
  }

  function formatAmount(order) {
    const amount = Number(order?.amount || 0)
    return amount > 0 ? amount.toFixed(2) + " " + (order.currency || "USD") : ""
  }

  async function readPendingOrders() {
    if (!pendingOrders.length) {
      say(copy.noOrders)
      return
    }
    const first = pendingOrders[0]
    const second = pendingOrders[1]
    let message
    if (voiceLocaleKey(language) === "hi") {
      message = "आपके पास पैक करने के लिए " + pendingOrders.length + " भुगतान किए हुए ऑर्डर हैं। पहला ऑर्डर " + first.order_id + " है। इसमें " + (first.buyer_name || "ग्राहक") + " के लिए " + formatAmount(first) + " का सामान है।";
    } else if (voiceLocaleKey(language) === "te") {
      message = "మీరు ప్యాక్ చేయాల్సిన చెల్లించిన ఆర్డర్లు " + pendingOrders.length + " ఉన్నాయి. మొదటి ఆర్డర్ " + first.order_id + ". మొత్తం " + formatAmount(first) + ".";
    } else {
      message = "You have " + pendingOrders.length + " paid orders waiting to be packed. The first is " + first.order_id + ", for " + (first.buyer_name || "the buyer") + ", total " + formatAmount(first) + ".";
    }
    if (second) message += voiceLocaleKey(language) === "hi"
      ? " अगला ऑर्डर " + second.order_id + " है।"
      : voiceLocaleKey(language) === "te"
        ? " తరువాతి ఆర్డర్ " + second.order_id + "."
        : " The next order is " + second.order_id + "."
    say(message)
  }

  async function readPackingList(order = selectedOrder) {
    if (!order) {
      say(copy.noActive)
      return
    }
    try {
      const manifest = await getJson("/api/shipments/" + encodeURIComponent(order.order_id) + "/manifest")
      const items = Array.isArray(manifest.items) ? manifest.items : []
      if (!items.length) {
        say(copy.noManifest)
        return
      }
      const itemText = items.map(item => {
        const quantity = Number(item.expected_qty || 0)
        const description = String(item.description || item.sku || "ordered item").split(/[.!?]/)[0].trim()
        return quantity + " " + description
      }).join(". ")
      const statusText = String(manifest.status || "DRAFT").replaceAll("_", " ").toLowerCase()
      const message = voiceLocaleKey(language) === "hi"
        ? "ऑर्डर " + order.order_id + " की पैकिंग सूची। " + itemText + "। मैनिफेस्ट की स्थिति " + statusText + " है।"
        : voiceLocaleKey(language) === "te"
          ? "ఆర్డర్ " + order.order_id + " ప్యాకింగ్ జాబితా. " + itemText + ". మానిఫెస్ట్ స్థితి " + statusText + "."
          : "Packing list for " + order.order_id + ". " + itemText + ". The manifest is " + statusText + "."
      say(message)
    } catch (err) {
      if (String(err.message).includes("No manifest")) say(copy.noManifest)
      else say(err.message || copy.noManifest)
    }
  }

  async function readLatestInspection(order = selectedOrder) {
    if (!order) {
      say(copy.noActive)
      return
    }
    try {
      const manifest = await getJson("/api/shipments/" + encodeURIComponent(order.order_id) + "/manifest")
      const listing = await getJson("/api/manifests/" + encodeURIComponent(manifest.id) + "/inspections")
      const latest = (listing.inspections || [])[0]
      if (!latest) {
        say(copy.noInspections)
        return
      }
      const detail = await getJson("/api/inspections/" + encodeURIComponent(latest.inspection_id))
      const ai = detail.ai_result || {}
      const checks = Array.isArray(ai.item_checks) ? ai.item_checks : []
      const outcomes = checks.map(item => {
        const result = String(item.result || "UNCERTAIN").replaceAll("_", " ").toLowerCase()
        const quantity = item.observed_qty === null || item.observed_qty === undefined
          ? "quantity uncertain"
          : "observed " + item.observed_qty
        return (item.description || item.sku || "item") + ": " + result + ", " + quantity
      }).join(". ")
      const reviewStatus = String(detail.inspection_status || latest.inspection_status || "UNKNOWN").replaceAll("_", " ").toLowerCase()
      const summary = String(ai.inspection_summary || "").trim()
      const message = voiceLocaleKey(language) === "hi"
        ? "नवीनतम एआई जांच की स्थिति " + reviewStatus + ". " + (outcomes || summary || "अभी कोई अतिरिक्त जानकारी नहीं है।")
        : voiceLocaleKey(language) === "te"
          ? "తాజా ఏఐ తనిఖీ స్థితి " + reviewStatus + ". " + (outcomes || summary || "అదనపు వివరాలు లేవు.")
          : "The latest AI inspection is " + reviewStatus + ". " + (outcomes || summary || "No additional findings were recorded.")
      say(message)
    } catch (err) {
      say(err.message || copy.noInspections)
    }
  }

  function insertReviewNote(note) {
    const field = document.getElementById("review-notes")
    if (!field) return false
    const details = field.closest("details")
    if (details) details.open = true
    const prefix = field.value && !field.value.endsWith("\n") ? "\n" : ""
    const nextValue = field.value + prefix + note
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
    if (setter) setter.call(field, nextValue)
    else field.value = nextValue
    field.dispatchEvent(new Event("input", { bubbles: true }))
    field.focus()
    return true
  }

  function openPacking(order = selectedOrder) {
    if (!order) {
      say(copy.noActive)
      return
    }
    setActiveShipmentId(order.order_id)
    navigateTo("/packing", { shipmentId: order.order_id })
    const message = voiceLocaleKey(language) === "hi"
      ? order.order_id + " की पैकिंग खोल रहा हूँ।"
      : voiceLocaleKey(language) === "te"
        ? order.order_id + " ప్యాకింగ్ తెరుస్తున్నాను."
        : "Opening the packing station for " + order.order_id + "."
    say(message)
  }

  function handleCommand(transcript) {
    setHeard(transcript)
    const command = parseParcelProofVoiceCommand(transcript, language)
    setError("")
    if (command.type === "note") {
      if (insertReviewNote(command.text)) say(copy.noteReady)
      else say(copy.noNoteField)
      return
    }
    if (command.type === "open-order") {
      const order = (orders || []).find(item => String(item.order_id || "").toUpperCase() === command.orderId)
      if (order) openPacking(order)
      else say("I could not find order " + command.orderId + ".")
      return
    }
    if (command.type === "pending") {
      readPendingOrders()
      return
    }
    if (command.type === "packing") {
      openPacking()
      return
    }
    if (command.type === "list") {
      readPackingList()
      return
    }
    if (command.type === "inspection") {
      if (selectedOrder) {
        setActiveShipmentId(selectedOrder.order_id)
        navigateTo("/inspections", { shipmentId: selectedOrder.order_id })
      } else navigateTo("/inspections")
      say(copy.openingInspection)
      return
    }
    if (command.type === "ai") {
      if (selectedOrder) {
        setActiveShipmentId(selectedOrder.order_id)
        navigateTo("/inspections", { shipmentId: selectedOrder.order_id })
      }
      readLatestInspection()
      return
    }
    if (command.type === "products") {
      navigateTo("/catalogue")
      say(copy.openingProducts)
      return
    }
    if (command.type === "orders") {
      navigateTo("/")
      say(copy.openingOrders)
      return
    }
    if (command.type === "next") {
      if (currentPath === "/packing") readPackingList()
      else if (currentPath === "/inspections") readLatestInspection()
      else openPacking()
      return
    }
    if (command.type === "capture") {
      if (currentPath !== "/packing") openPacking()
      say(copy.captureHelp)
      return
    }
    if (command.type === "dictate") {
      say("Tap Dictate review note to speak your note.")
      return
    }
    if (command.type === "help") {
      say(copy.help)
      return
    }
    if (/^(?:approve|approve packing|looks correct|request correction|needs correction|reject|reject inspection)$/i.test(transcript.trim())) {
      if (selectedOrder) navigateTo("/inspections", { shipmentId: selectedOrder.order_id })
      say(copy.safeDecision)
      return
    }
    say(copy.unknown)
  }

  function startListening(mode = "command") {
    const Recognition = typeof window !== "undefined"
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null
    if (!Recognition) {
      setError("Voice input is not available in this browser. Try Chrome or use the on-screen controls.")
      return
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* no active recognition */ }
    }
    setError("")
    setListening(true)
    setHeard("")
    const recognition = new Recognition()
    recognition.lang = language
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = event => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || ""
      if (!transcript) {
        say(copy.unknown)
        return
      }
      setHeard(transcript)
      if (mode === "note") {
        if (insertReviewNote(transcript)) say(copy.noteReady)
        else say(copy.noNoteField)
      } else {
        handleCommand(transcript)
      }
    }
    recognition.onerror = event => {
      const errors = {
        "not-allowed": "Microphone access was blocked. Allow microphone access in your browser settings.",
        "service-not-allowed": "This browser does not allow speech recognition on this site.",
        "no-speech": "No speech was heard. Tap the microphone and try again.",
        "audio-capture": "No microphone was found. Connect or enable a microphone.",
        "network": "The browser speech service is unavailable. Try again or use the on-screen controls."
      }
      setError(errors[event.error] || copy.error)
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setListening(false)
      setError(copy.error)
    }
  }

  function stopListening() {
    try { recognitionRef.current?.stop() } catch { /* already stopped */ }
    setListening(false)
  }

  if (currentPath.startsWith("/checkout")) return null

  return (
    <div className="voice-assistant-dock">
      {open && (
        <section className="voice-assistant-panel" aria-label="ParcelProof voice assistant">
          <div className="voice-assistant-header">
            <div>
              <strong>Talk to ParcelProof</strong>
              <small>Voice-guided packing</small>
            </div>
            <button type="button" className="voice-assistant-close" onClick={() => { stopListening(); setOpen(false) }} aria-label="Close voice assistant">×</button>
          </div>
          <label className="voice-language-label" htmlFor="voice-language">Voice language</label>
          <select id="voice-language" value={language} onChange={event => setLanguage(event.target.value)}>
            <option value="en-IN">English (India)</option>
            <option value="hi-IN">हिन्दी</option>
            <option value="te-IN">తెలుగు</option>
          </select>
          <div className="voice-assistant-response" aria-live="polite">
            {heard && <div className="voice-assistant-heard"><span>You said</span>{heard}</div>}
            <p>{reply}</p>
          </div>
          {error && <div className="voice-assistant-error" role="alert">{error}</div>}
          <div className="voice-assistant-actions">
            {listening ? (
              <button type="button" className="voice-listen-button listening" onClick={stopListening}>
                <span className="voice-pulse" /> Listening · Stop
              </button>
            ) : (
              <button type="button" className="voice-listen-button" onClick={() => startListening("command")}>
                <span aria-hidden="true">🎙</span> Tap to speak
              </button>
            )}
            {currentPath === "/inspections" && (
              <button type="button" className="voice-note-button" disabled={listening} onClick={() => startListening("note")}>
                Dictate review note
              </button>
            )}
          </div>
          <div className="voice-assistant-footnote">
            Listens only after you tap. Approve, correct and reject decisions still require the on-screen review buttons.
          </div>
        </section>
      )}
      <button
        type="button"
        className="voice-assistant-launch"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span aria-hidden="true">🎙</span>
        <span>Voice guide</span>
      </button>
    </div>
  )
}


export function DemoLoginView({ onLogin, loading, error, demoUsername, configured }) {
  const [username, setUsername] = useState(demoUsername || '')
  const [password, setPassword] = useState('')
  useEffect(() => { if (demoUsername) setUsername(demoUsername) }, [demoUsername])
  function submit(event) { event.preventDefault(); onLogin({ username: username.trim(), password }) }
  return (
    <main className="demo-login-page">
      <section className="demo-login-brand-panel">
        <div className="demo-login-brand"><span className="brand-icon">P</span><span><strong>ParcelProof AI</strong><small>PAYMENT-LINKED PACKING CHECKS</small></span></div>
        <div className="demo-login-message"><span className="demo-login-kicker">BEFORE THE PARCEL IS SEALED</span><h1>Check the pack against what the buyer paid for.</h1><p>Review the paid order, check the packed items and keep a clear record of the merchant's decision.</p></div>
        <div className="demo-login-foot">PayPal Sandbox · AI-assisted visual checks · Merchant-controlled decisions</div>
      </section>
      <section className="demo-login-form-side">
        <form className="demo-login-card" onSubmit={submit}>
          <div className="demo-login-card-heading"><span className="demo-login-lock"><LockIcon /></span><div><span className="eyebrow">MERCHANT WORKSPACE</span><h2>Sign in</h2></div></div>
          <p className="demo-login-intro">Use the shared demo account to open the ParcelProof merchant workspace.</p>
          {!configured && <div className="demo-login-error" role="alert">Demo sign-in is not configured. Please contact the demo owner.</div>}
          {error && <div className="demo-login-error" role="alert">{error}</div>}
          <label className="demo-login-field"><span>Demo username</span><input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required disabled={loading || !configured} /></label>
          <label className="demo-login-field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={loading || !configured} /></label>
          <button type="submit" className="demo-login-submit" disabled={loading || !configured || !username.trim() || !password}>{loading ? 'Signing in…' : 'Sign in to ParcelProof'}</button>
          <div className="demo-login-helper">Demo access only. Do not enter real customer or payment information.</div>
        </form>
      </section>
    </main>
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
  const [authStatus, setAuthStatus] = useState({ loading: true, enabled: false, authenticated: false, configured: true, demo_username: '' })
  const [authLoginLoading, setAuthLoginLoading] = useState(false)
  const [authLoginError, setAuthLoginError] = useState('')

  // Shared active shipment context across workflows
  const [activeShipmentId, setActiveShipmentId] = useState(null)
  const [prefetchedManifest, setPrefetchedManifest] = useState(null)

  async function loadWorkspaceData() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/orders`, { credentials: 'same-origin' })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.detail || 'Could not load orders.')
      const nextOrders = data.orders || []
      setOrders(nextOrders)
      setValidationRun(false)
      setAiAnalysisRun(false)
      setActiveShipmentId(current => current || nextOrders[0]?.order_id || null)
    } catch (loadError) {
      setError(loadError.message || 'Cannot connect to ParcelProof. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
    try {
      const response = await fetch(`${API_BASE}/api/paypal/status`, { credentials: 'same-origin' })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.detail || 'PayPal status unavailable.')
      setPaypal(data)
    } catch { setPaypal({ error: 'PayPal status unavailable' }) }
  }

  async function handleDemoLogin(credentials) {
    setAuthLoginLoading(true)
    setAuthLoginError('')
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.detail || 'Sign-in failed. Check the demo username and password.')
      setAuthStatus(current => ({ ...current, loading: false, authenticated: true, error: '' }))
      await loadWorkspaceData()
    } catch (loginError) {
      setAuthLoginError(loginError.message || 'Sign-in failed. Please try again.')
    } finally { setAuthLoginLoading(false) }
  }

  async function handleDemoLogout() {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'same-origin' })
    } finally {
      setOrders([])
      setSelectedOrder(null)
      setResults({})
      setAiResults({})
      setAuthLoginError('')
      setAuthStatus(current => ({ ...current, loading: false, authenticated: false }))
      setPaypal({ loading: false })
      setCurrentPath('/')
      window.history.replaceState({}, '', '/')
    }
  }

  useEffect(() => {
    let ignore = false
    const handleRouteChange = () => {
      window.scrollTo(0, 0)
      setCurrentPath(window.location.pathname)
    }
    window.addEventListener('popstate', handleRouteChange)
    async function bootstrap() {
      try {
        const response = await fetch(`${API_BASE}/api/auth/status`, { credentials: 'same-origin' })
        const data = await readApiJson(response)
        if (!response.ok) throw new Error(data.detail || 'Could not verify demo access.')
        if (ignore) return
        setAuthStatus({ ...data, loading: false })
        if (!data.enabled || data.authenticated) await loadWorkspaceData()
        else { setLoading(false); setPaypal({ loading: false }) }
      } catch {
        if (ignore) return
        setAuthStatus({ loading: false, enabled: true, authenticated: false, configured: true, demo_username: '', error: 'ParcelProof could not verify your session. Check your connection and try again.' })
        setLoading(false)
        setPaypal({ loading: false })
      }
    }
    bootstrap()
    return () => { ignore = true; window.removeEventListener('popstate', handleRouteChange) }
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
    window.scrollTo(0, 0)
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
    setPrefetchedManifest(
      opts.manifest && opts.shipmentId
        ? { shipmentId: opts.shipmentId, manifest: opts.manifest }
        : null
    )
    setCurrentPath(path)
  }

  // ─── Route views ──────────────────────────────────────────────────────────
  const isDashboard = currentPath === '/'

  if (authStatus.loading) {
    return <main className="demo-auth-loading"><div className="loading-spinner"><SpinnerIcon /></div><p>Opening your ParcelProof workspace…</p></main>
  }
  if (authStatus.enabled && !authStatus.authenticated) {
    return <DemoLoginView onLogin={handleDemoLogin} loading={authLoginLoading} error={authLoginError || authStatus.error || ''} demoUsername={authStatus.demo_username} configured={authStatus.configured !== false} />
  }

  return (
    <div className="app-shell">
      <Sidebar
        currentPath={currentPath}
        ordersCount={orders.filter(order => Boolean(order.checkout_order_id)).length}
        navigateTo={navigateTo}
        demoUsername={authStatus.enabled ? authStatus.demo_username : ''}
        onLogout={authStatus.enabled ? handleDemoLogout : null}
        voiceAssistant={!currentPath.startsWith('/checkout') ? (
          <VoiceAssistant
            orders={orders}
            activeShipmentId={activeShipmentId}
            setActiveShipmentId={setActiveShipmentId}
            navigateTo={navigateTo}
            currentPath={currentPath}
          />
        ) : null}
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

      {currentPath === '/catalogue' && (
        <ProductCatalogueView />
      )}

      {currentPath === '/manifests' && (
        <ShipmentsManifestView
          orders={orders}
          activeShipmentId={activeShipmentId}
          setActiveShipmentId={setActiveShipmentId}
          navigateTo={navigateTo}
          prefetchedManifest={prefetchedManifest}
        />
      )}

      {currentPath === '/packing' && (
        <PackingStationView
          orders={orders}
          activeShipmentId={activeShipmentId}
          setActiveShipmentId={setActiveShipmentId}
          navigateTo={navigateTo}
          prefetchedManifest={prefetchedManifest}
          workspaceLoading={loading}
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

// ─── Merchant order queue ─────────────────────────────────────────────────────
function ShipmentReviewMain({
  orders,
  loading,
  error,
  paypal,
  oauthTesting,
  oauthVerified,
  testPayPalConnection,
  navigateTo
}) {
  const paidOrders = orders.filter(order => Boolean(order.checkout_order_id))
  const [openingOrderId, setOpeningOrderId] = useState('')
  const [openError, setOpenError] = useState('')

  async function continueOrder(order) {
    if (!order?.order_id || openingOrderId) return
    setOpeningOrderId(order.order_id)
    setOpenError('')

    // Dispatched orders belong in the evidence record. Unshipped orders need only
    // one manifest check; inspection history is loaded inside the packing workflow.
    if (order.status === 'SHIPPED' || order.status === 'DELIVERED') {
      navigateTo('/inspections', { shipmentId: order.order_id })
      return
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/shipments/${encodeURIComponent(order.order_id)}/manifest`
      )
      if (response.status === 404) {
        navigateTo('/manifests', { shipmentId: order.order_id })
        return
      }
      const manifest = await readApiJson(response)
      if (!response.ok) throw new Error(manifest.detail || 'Could not open this order.')
      navigateTo(
        manifest.status === 'FINALIZED' ? '/packing' : '/manifests',
        { shipmentId: order.order_id, manifest }
      )
    } catch (requestError) {
      setOpenError(requestError.message || 'Could not open this order. Please try again.')
      setOpeningOrderId('')
    }
  }

  return (
    <main className="main merchant-orders-page" id="main-content">
      <header className="topbar">
        <div className="breadcrumb">
          <span>Workspace</span>
          <span>/</span>
          <strong>Orders</strong>
        </div>
        <div className="topbar-actions">
          <button
            className="pill-status"
            onClick={testPayPalConnection}
            disabled={oauthTesting}
            title="Check the PayPal Sandbox connection"
          >
            <span className={`pulse ${oauthVerified ? '' : 'warn'}`} aria-hidden="true"></span>
            <span>
              {oauthTesting
                ? 'Checking PayPal…'
                : oauthVerified
                ? 'PayPal connected'
                : paypal.configured
                ? 'Check PayPal connection'
                : 'PayPal not configured'}
            </span>
          </button>
        </div>
      </header>

      <section className="merchant-orders-heading">
        <div>
          <div className="eyebrow">PAID ORDERS</div>
          <h1>What needs packing?</h1>
          <p>See what each buyer paid for and continue with the next packing step.</p>
        </div>
      </section>

      {error && <div className="findings-box issues" role="alert">{error}</div>}
      {openError && <div className="findings-box issues" role="alert">{openError}</div>}

      {loading ? (
        <div className="merchant-orders-empty" role="status">Loading orders…</div>
      ) : paidOrders.length === 0 ? (
        <div className="merchant-orders-empty">
          <div className="merchant-orders-empty-icon"><CartIcon /></div>
          <h2>No paid orders yet</h2>
          <p>Complete a PayPal Sandbox checkout to create your first packing order.</p>
          <button className="btn-primary" onClick={() => navigateTo('/checkout')}>
            Create test order
          </button>
        </div>
      ) : (
        <section className="merchant-order-list" aria-label="Paid PayPal orders">
          {paidOrders.map(order => {
            const isOpening = openingOrderId === order.order_id
            const orderStatus = order.status === 'DELIVERED'
              ? 'Delivered'
              : order.status === 'SHIPPED'
                ? 'Shipped'
                : 'Not dispatched'

            return (
              <article className="merchant-order-card" key={order.order_id}>
                <div className="merchant-order-main">
                  <div className="merchant-order-title-row">
                    <h2>{order.order_id}</h2>
                    <span className={`merchant-order-status ${order.status === 'DELIVERED' ? 'complete' : order.status === 'SHIPPED' ? 'shipped' : 'pending'}`}>
                      {orderStatus}
                    </span>
                    {order.payment_status === 'PAID' && (
                      <span className="merchant-order-payment">PayPal payment received</span>
                    )}
                  </div>
                  <div className="merchant-order-meta">
                    <span>{order.buyer_name || 'Buyer name unavailable'}</span>
                    <span>{order.amount ? `$${Number(order.amount).toFixed(2)} ${order.currency || 'USD'}` : 'Order total unavailable'}</span>
                  </div>
                  {order.items?.length ? (
                    <ul className="merchant-order-items" aria-label="Products in this order">
                      {order.items.slice(0, 3).map((item, index) => (
                        <li key={item.sku || index}>
                          <strong>{item.quantity} × {item.name || item.sku || 'Order item'}</strong>
                        </li>
                      ))}
                      {order.items.length > 3 && (
                        <li className="merchant-order-more">+ {order.items.length - 3} more items</li>
                      )}
                    </ul>
                  ) : (
                    <p className="merchant-order-items-missing">Item details will appear when you open this order.</p>
                  )}
                </div>
                <button
                  className="btn-primary merchant-order-action"
                  onClick={() => continueOrder(order)}
                  disabled={Boolean(openingOrderId)}
                >
                  {isOpening ? 'Opening…' : order.status === 'DELIVERED' || order.status === 'SHIPPED' ? 'View evidence' : 'Start packing'}
                  {!isOpening && <ArrowIcon />}
                </button>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}

// ─── Simple paid-order item confirmation ──────────────────────────────────────
export function ShipmentsManifestView({ orders, activeShipmentId, navigateTo, prefetchedManifest }) {
  const paidOrders = orders.filter(order => Boolean(order.checkout_order_id))
  const selectedShipment = paidOrders.find(order => order.order_id === activeShipmentId) || paidOrders[0] || null
  const [manifest, setManifest] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadPaidOrderItems() {
      setManifest(null)
      setError('')
      if (!selectedShipment) {
        setLoading(false)
        return
      }

      if (prefetchedManifest?.shipmentId === selectedShipment.order_id && prefetchedManifest.manifest) {
        setManifest(prefetchedManifest.manifest)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const response = await fetch(
          `${API_BASE}/api/shipments/${encodeURIComponent(selectedShipment.order_id)}/manifest`
        )
        const data = await readApiJson(response)
        if (ignore) return
        if (!response.ok) {
          throw new Error(data.detail || 'Could not load the items for this order.')
        }
        setManifest(data)
      } catch (loadError) {
        if (!ignore) setError(loadError.message || 'Could not load this order.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadPaidOrderItems()
    return () => { ignore = true }
  }, [selectedShipment?.order_id, prefetchedManifest])

  async function confirmItemsAndContinue() {
    if (!selectedShipment || !manifest || confirming) return

    if (manifest.status === 'FINALIZED') {
      navigateTo('/packing', { shipmentId: selectedShipment.order_id, manifest })
      return
    }

    if (manifest.status !== 'DRAFT' || !Array.isArray(manifest.items) || manifest.items.length === 0) {
      setError('The paid order does not have a confirmable item list. Return to Orders and reopen it.')
      return
    }

    setConfirming(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/manifests/${manifest.id}/finalize`, {
        method: 'POST'
      })
      const data = await readApiJson(response)
      if (!response.ok) {
        throw new Error(data.detail || 'Could not confirm these order items.')
      }
      setManifest(data)
      navigateTo('/packing', { shipmentId: selectedShipment.order_id, manifest: data })
    } catch (confirmError) {
      setError(confirmError.message || 'Could not confirm this order. Please try again.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <main className="main order-confirmation-page" id="main-content">
      <header className="topbar">
        <div className="breadcrumb">
          <span>Orders</span>
          <span>/</span>
          <strong>Confirm items</strong>
        </div>
        <div className="topbar-actions">
          <button className="btn-secondary" onClick={() => navigateTo('/')}>
            ← Orders
          </button>
        </div>
      </header>

      <OrderWorkflowProgress currentStep={2} />

      {!selectedShipment ? (
        <section className="order-confirmation-empty">
          <h1>No paid order selected</h1>
          <p>Open a paid PayPal order to confirm its items.</p>
          <button className="btn-primary" onClick={() => navigateTo('/')}>Back to orders</button>
        </section>
      ) : (
        <>
          <section className="workspace-page-intro" aria-labelledby="confirm-order-title">
            <div className="workspace-page-intro-copy">
              <div className="eyebrow">PAYPAL ORDER</div>
              <h1 id="confirm-order-title">Are these the right items?</h1>
              <p>Check the item names and quantities before packing.</p>
            </div>
          </section>

          <section className="order-confirmation-card" aria-label="Paid order items">
            <div className="order-confirmation-header">
              <div>
                <span className="eyebrow">PAID ORDER</span>
                <h2>{selectedShipment.order_id}</h2>
                <p>{selectedShipment.buyer_name || 'PayPal customer'} · {selectedShipment.amount ? `$${Number(selectedShipment.amount).toFixed(2)} ${selectedShipment.currency || 'USD'}` : 'Paid'}</p>
              </div>
              <span className={`pill ${manifest?.status === 'FINALIZED' ? 'pill-pass' : 'pill-warn'}`}>
                {manifest?.status === 'FINALIZED' ? 'Items confirmed' : 'Payment received'}
              </span>
            </div>

            {loading ? (
              <div className="order-confirmation-state" role="status">Loading order items…</div>
            ) : error ? (
              <div className="findings-box issues" role="alert">{error}</div>
            ) : manifest?.items?.length ? (
              <>
                <div className="order-confirmation-items">
                  {manifest.items.map((item, index) => (
                    <article className="order-confirmation-item" key={item.id || item.sku || index}>
                      <div className="order-confirmation-item-number">{index + 1}</div>
                      <div className="order-confirmation-item-copy">
                        <strong>{item.description || item.sku || 'Order item'}</strong>
                        <span>Quantity: {item.expected_qty}</span>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="order-confirmation-actions">
                  <p>{manifest.status === 'FINALIZED'
                    ? 'These items have already been confirmed.'
                    : 'ParcelProof will keep this paid item list with the packing photos and review.'}</p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={confirmItemsAndContinue}
                    disabled={confirming || loading}
                  >
                    {confirming
                      ? 'Confirming…'
                      : manifest.status === 'FINALIZED'
                        ? 'Continue to packing'
                        : 'Items look right — continue'}
                    {!confirming && <ArrowIcon />}
                  </button>
                </div>
              </>
            ) : (
              <div className="order-confirmation-state" role="alert">
                This paid order has no item list to confirm. Return to Orders and reopen it.
              </div>
            )}

            {manifest?.manifest_hash && (
              <details className="order-record-details">
                <summary>View order record</summary>
                <code>{manifest.manifest_hash}</code>
              </details>
            )}
          </section>
        </>
      )}
    </main>
  )
}

// ─── Payment-to-export document reconciliation ─────────────────────────────── ───────────────────────────────
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
export function PackingStationView({ orders, activeShipmentId, setActiveShipmentId, navigateTo, prefetchedManifest, workspaceLoading = false }) {
  const [manifest, setManifest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Upload state
  const [selectedPhotos, setSelectedPhotos] = useState([]) // array of { file, previewUrl, id, sizeFormatted }
  const [photoShipmentId, setPhotoShipmentId] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [, setProcessingStatus] = useState('') // internal request-state transition; progress is elapsed-time based
  const [processingElapsedSeconds, setProcessingElapsedSeconds] = useState(0)
  const [, setInspectionResult] = useState(null)
  const [lastInspectionStatus, setLastInspectionStatus] = useState(null) // HTTP status of last provider failure (503 outage or 429 rate/quota limit)
  const [latestInspectionStatus, setLatestInspectionStatus] = useState(null)
  const [latestInspectionReview, setLatestInspectionReview] = useState(null)
  const [previousInspectionCount, setPreviousInspectionCount] = useState(0)
  const validationRun = useState(false)
  const aiAnalysisRun = useState(false)
  const inspectionInFlight = useRef(false) // synchronous guard against concurrent duplicate submissions

  const selectedShipment = useMemo(() => {
    return orders.find(o => o.order_id === activeShipmentId) || orders[0] || null
  }, [orders, activeShipmentId])

  // Show elapsed time for the single synchronous upload-and-analysis request.
  // No percentage is shown because the API does not stream individual stage progress.
  useEffect(() => {
    if (!uploading) {
      setProcessingElapsedSeconds(0)
      return undefined
    }
    const startedAt = Date.now()
    setProcessingElapsedSeconds(0)
    const timerId = window.setInterval(() => {
      setProcessingElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timerId)
  }, [uploading])

  const photosRef = React.useRef([])

  // Synchronize photosRef inside an effect instead of render
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
    setLatestInspectionStatus(null)
    setLatestInspectionReview(null)
    setPreviousInspectionCount(0)
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
      setLatestInspectionStatus(null)
      setLatestInspectionReview(null)
      setPreviousInspectionCount(0)
      setError('')
      setLoading(true)
    }

    let ignore = false
    async function fetchManifest() {
      if (!selectedShipment) {
        setManifest(null)
        setLoading(Boolean(workspaceLoading))
        return
      }
      if (prefetchedManifest?.shipmentId === selectedShipment.order_id && prefetchedManifest.manifest) {
        setManifest(prefetchedManifest.manifest)
        setLoading(false)
        setError('')
        return
      }
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
  }, [selectedShipment, prefetchedManifest, workspaceLoading])

  useEffect(() => {
    let ignore = false
    async function loadPreviousChecks() {
      if (!manifest?.id) {
        setLatestInspectionStatus(null)
        setLatestInspectionReview(null)
        setPreviousInspectionCount(0)
        return
      }
      try {
        const response = await fetch(`${API_BASE}/api/manifests/${encodeURIComponent(manifest.id)}/inspections`)
        const data = await readApiJson(response)
        if (!response.ok) throw new Error(data.detail || 'Could not load previous checks.')
        if (ignore) return
        const checks = data.inspections || []
        setPreviousInspectionCount(checks.length)
        setLatestInspectionStatus(checks[0]?.inspection_status || null)
        setLatestInspectionReview(checks[0]?.latest_review || null)
      } catch {
        if (!ignore) {
          setPreviousInspectionCount(0)
          setLatestInspectionStatus(null)
          setLatestInspectionReview(null)
        }
      }
    }
    loadPreviousChecks()
    return () => { ignore = true }
  }, [manifest?.id])

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
      setProcessingStatus('processing')
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
      navigateTo('/inspections', { shipmentId: selectedShipment.order_id })
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
    manifest.shipment_order_id === selectedShipment?.order_id
  )
  const isFinalized = isManifestAssociated && manifest?.status === 'FINALIZED'
  const canSelectPhotos = !loading && isFinalized && !uploading
  const selectableOrders = orders.some(order => order.checkout_order_id)
    ? orders.filter(order => order.checkout_order_id)
    : orders

  return (
    <main className="main" id="main-content">
      <header className="topbar">
        <div className="breadcrumb">
          <span>Workspace</span>
          <span>/</span>
          <strong>Pack order</strong>
        </div>
        <div className="topbar-actions">
          <button className="btn-secondary" onClick={() => navigateTo('/')}>
            ← Orders
          </button>
        </div>
      </header>

      <OrderWorkflowProgress currentStep={3} />

      <section className="workspace-page-intro packing-page-intro" aria-labelledby="packing-page-title">
        <div className="workspace-page-intro-copy">
          <div className="eyebrow">PACKING</div>
          <h1 id="packing-page-title">Pack this order</h1>
          <p>Check the items, then take one clear photo before sealing.</p>
        </div>
        <div className="packing-order-switcher">
          <label htmlFor="packing-order-select">Order</label>
          <select
            id="packing-order-select"
            className="form-control"
            value={selectedShipment?.order_id || ''}
            onChange={event => switchShipment(event.target.value)}
            disabled={uploading}
          >
            {selectableOrders.map(order => (
              <option key={order.order_id} value={order.order_id}>
                {order.order_id}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="packing-layout packing-layout-compact">
        {/* Right: Packing Station Workspace */}
        <section className="packing-main-panel" aria-label="Packing Station Area">
          {selectedShipment ? (
            <>
              {/* Manifest summary banner */}
              <div className="manifest-header-card">
                <div className="m-header-left">
                  <div className="eyebrow">PAID ORDER</div>
                  <h2>{selectedShipment.order_id}</h2>
                  <p>
                    {selectedShipment.buyer_name || 'PayPal customer'} ·
                    <strong> ${Number(selectedShipment.amount || 0).toFixed(2)} {selectedShipment.currency || 'USD'}</strong>
                  </p>
                </div>
                <div className="m-header-right">
                  {loading ? (
                    <span className="pill pill-unchecked">Loading order details…</span>
                  ) : latestInspectionStatus === 'NEEDS_CORRECTION' ? (
                    <span className="pill pill-warn">Correction needed</span>
                  ) : latestInspectionStatus === 'REJECTED' ? (
                    <span className="pill pill-blocked">Inspection rejected</span>
                  ) : latestInspectionStatus === 'PENDING_HUMAN_REVIEW' ? (
                    <span className="pill pill-warn">Awaiting your review</span>
                  ) : latestInspectionStatus === 'APPROVED' ? (
                    <span className="pill pill-pass">Packing approved</span>
                  ) : manifest ? (
                    <span className={`pill ${isFinalized ? 'pill-pass' : 'pill-warn'}`}>
                      {isFinalized ? 'Packing list confirmed' : 'Items need confirmation'}
                    </span>
                  ) : (
                    <span className="pill pill-unchecked">Packing list not created</span>
                  )}
                </div>
              </div>

              {(latestInspectionStatus === 'NEEDS_CORRECTION' || latestInspectionStatus === 'REJECTED') && (
                <section className="correction-resume-banner" role="status">
                  <div>
                    <strong>{latestInspectionStatus === 'NEEDS_CORRECTION' ? 'Continue the correction for this order' : 'A new packing check is required'}</strong>
                    <p>The paid order and confirmed packing list are unchanged. Resolve the issue, then add a new photo. Earlier checks remain in the history.</p>
                    {latestInspectionReview?.notes && (
                      <p className="correction-resume-note"><strong>Merchant's note:</strong> {latestInspectionReview.notes}</p>
                    )}
                  </div>
                  <span>{previousInspectionCount} previous check{previousInspectionCount === 1 ? '' : 's'} saved</span>
                </section>
              )}

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
                  <h3>Confirm the items in this order</h3>
                  <p style={{ maxWidth: '460px', margin: '0 auto' }}>
                    Check the paid order items once before packing.
                  </p>
                  <button
                    className="btn-primary"
                    style={{ marginTop: '14px' }}
                    onClick={() => navigateTo('/manifests', { shipmentId: selectedShipment.order_id })}
                  >
                    Confirm order items →
                  </button>
                </div>
              ) : !isFinalized ? (
                /* Manifest is DRAFT, not yet finalized */
                <div className="checkout-state-box" style={{ padding: '48px 24px' }}>
                  <div className="checkout-state-icon" style={{ background: 'var(--info-bg)', color: 'var(--cobalt)' }}>
                    <LockIcon />
                  </div>
                  <h3>Confirm the items before packing</h3>
                  <p style={{ maxWidth: '460px', margin: '0 auto' }}>
                    Make sure the product names and quantities match the order.
                  </p>
                  <button
                    className="btn-primary"
                    style={{ marginTop: '14px' }}
                    onClick={() => navigateTo('/manifests', { shipmentId: selectedShipment.order_id })}
                  >
                    Review order items →
                  </button>
                </div>
              ) : (
                /* Finalized Manifest — Packing Station Active */
                <div className="packing-station-workspace">
                  {/* Finalized Manifest Snapshot */}
                  <details className="packing-technical-details">
                    <summary>Order record details</summary>
                    <div className="hash-display-banner">
                      <div className="hash-info">
                        <span className="hash-label">Manifest fingerprint</span>
                        <code className="hash-code">{manifest.manifest_hash}</code>
                        <small className="hash-explanation">
                          This fingerprint binds the confirmed order items and quantities to each packing check.
                        </small>
                      </div>
                      <span className="finalized-lock-tag">
                        <LockIcon /> Locked
                      </span>
                    </div>
                  </details>

                  {/* Declared items preview */}
                  <div className="declared-items-preview">
                    <strong>Items in this order</strong>
                    <div className="declared-items-chips">
                      {manifest.items?.map((it, i) => {
                        const orderedItem = (selectedShipment.items || []).find(item => item.sku === it.sku)
                        const productName = orderedItem?.name || it.sku || 'Order item'
                        return (
                          <span key={i} className="declared-chip">
                            <span className="chip-qty">{it.expected_qty}x</span>
                            <span className="chip-desc">{productName}</span>
                            {it.fragile && <span className="chip-fragile">Handle with care</span>}
                          </span>
                        )
                      })}
                    </div>
                    <small className="declared-items-help">Check the product name and quantity here. Extra matching details are kept for the AI comparison and are not part of the order description.</small>
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



                  {/* Photo Dropzone / Upload Area */}
                  <div className="photo-upload-container">
                    <div className="upload-header">
                      <div>
                        <h3>Take a packing photo</h3>
                        <p>Show all the items before sealing. One clear photo is usually enough.</p>
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
                        <span className="dropzone-title">Choose a photo</span>
                        <small className="dropzone-sub">A clear photo of the unpacked items.</small>
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
                      <section className="inspection-progress-card packing-simple-progress" role="status" aria-live="polite">
                        <div className="inspection-progress-icon loading-spinner"><SpinnerIcon /></div>
                        <div className="inspection-progress-info">
                          <h4>Checking this order</h4>
                          <p>Comparing the photo with the products in the paid order.</p>
                          <span className="inspection-elapsed-time">
                            {processingElapsedSeconds < 60 ? `${processingElapsedSeconds}s` : `${Math.floor(processingElapsedSeconds / 60)}m ${processingElapsedSeconds % 60}s`}
                          </span>
                        </div>
                      </section>
                    )}

                    {/* Submit Inspection Button */}
                    <div className="upload-submit-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleSubmitInspection}
                        disabled={loading || !canSelectPhotos || uploading || selectedPhotos.length === 0}
                      >
                        {uploading ? 'Checking…' : 'Check this order'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : workspaceLoading ? (
            <div className="checkout-state-box" style={{ padding: '60px' }} role="status">
              <div className="checkout-state-icon loading-spinner"><SpinnerIcon /></div>
              <p>Loading your paid orders…</p>
            </div>
          ) : (
            <div className="checkout-state-box" style={{ padding: '48px 24px' }}>
              <h3>No paid orders ready to pack</h3>
              <p>Once a PayPal payment is captured, its order will appear here.</p>
              <button className="btn-primary" type="button" onClick={() => navigateTo('/')}>Back to Orders</button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export function EvidenceTimeline({ shipment, manifest, inspection, inspectionRuns = [] }) {
  const selectedReview = (inspection?.review_history || []).slice(-1)[0] || null
  const latestReviewRun = inspectionRuns.find(run => run.latest_review) || null
  const latestReview = selectedReview || latestReviewRun?.latest_review || null
  const latestRun = inspectionRuns[0] || null
  const newerRunNeedsReview = Boolean(latestRun && latestRun.inspection_status === 'PENDING_HUMAN_REVIEW' && !latestRun.latest_review && latestReview)
  const photos = inspection?.photos || []
  const paymentLinked = Boolean(shipment?.checkout_order_id && (shipment?.paypal_capture_id || shipment?.transaction_id))
  const manifestLocked = manifest?.status === 'FINALIZED' && Boolean(manifest?.manifest_hash)
  const aiFailed = Boolean(inspection && ['AI_FAILED', 'FAILED'].includes(inspection.inspection_status))
  const aiCompleted = Boolean(inspection && !aiFailed)
  const merchantTitle = newerRunNeedsReview
    ? 'Newest check needs your decision'
    : aiFailed
      ? 'Merchant review unavailable'
      : latestReview
        ? `Merchant decision: ${latestReview.decision.replaceAll('_', ' ').toLowerCase()}`
        : 'Merchant decision pending'
  const merchantDescription = newerRunNeedsReview
    ? `Earlier decision: ${latestReview.decision.replaceAll('_', ' ').toLowerCase()}. ${latestReview.notes || 'The earlier check was reviewed.'} The newer check has not been reviewed yet.`
    : aiFailed
      ? 'The latest AI check did not produce observations to review. Retry with a clear packing photo. Earlier merchant decisions remain in the history.'
      : latestReview
        ? (latestReview.notes || 'The merchant recorded a decision for this check.')
        : 'Review the photo and AI observations before deciding.'
  const merchantState = newerRunNeedsReview || aiFailed
    ? 'attention'
    : latestReview?.decision === 'APPROVED'
      ? 'approved'
      : latestReview?.decision === 'REJECTED' || latestReview?.decision === 'NEEDS_CORRECTION'
        ? 'attention'
        : 'pending'
  const entries = [
    { title: paymentLinked ? 'Payment received' : 'Order linked', description: shipment?.paypal_capture_id ? 'PayPal capture is attached to this order.' : 'This record is connected to the selected order.', state: paymentLinked ? 'recorded' : 'pending' },
    { title: manifestLocked ? 'Packing list confirmed' : 'Packing list', description: manifestLocked ? 'The item list was saved before inspection.' : 'The item list has not been finalized.', state: manifestLocked ? 'recorded' : 'pending' },
    { title: photos.length ? 'Packing photo saved' : 'Packing photo', description: photos.length ? `${photos.length} original photo${photos.length === 1 ? '' : 's'} saved for this check.` : 'No photo is attached to this check.', state: photos.length ? 'recorded' : 'pending' },
    { title: aiCompleted ? 'AI observations saved' : 'AI check did not complete', description: aiCompleted ? 'The AI result is available for the merchant to review. It is not an approval.' : 'The uploaded photo is saved, but no AI result is available.', state: aiCompleted ? 'recorded' : 'attention' },
    { title: merchantTitle, description: merchantDescription, state: merchantState }
  ]
  const runsInTimeOrder = [...inspectionRuns].reverse()
  return (
    <section className="evidence-timeline-card" aria-label="Evidence timeline">
      <div className="evidence-timeline-heading">
        <div><span className="eyebrow">ORDER RECORD</span><h3>Evidence timeline</h3></div>
        <p>One readable history of what was paid for, photographed and reviewed.</p>
      </div>
      <ol className="evidence-timeline">
        {entries.map((entry, index) => (
          <li key={entry.title} className={`state-${entry.state}`}>
            <span className="evidence-timeline-marker" aria-hidden="true">{entry.state === 'approved' ? '✓' : entry.state === 'attention' ? '!' : index + 1}</span>
            <div><strong>{entry.title}</strong><p>{entry.description}</p></div>
          </li>
        ))}
      </ol>
      {runsInTimeOrder.length > 0 && (
        <details className="evidence-run-history">
          <summary className="evidence-run-history-heading">
            <strong>Previous inspection attempts</strong>
            <span>{runsInTimeOrder.length} saved attempt{runsInTimeOrder.length === 1 ? '' : 's'}</span>
          </summary>
          <ol>
            {runsInTimeOrder.map((run, index) => {
              const failedRun = ['AI_FAILED', 'FAILED'].includes(run.inspection_status)
              const reviewState = run.latest_review
                ? `Merchant: ${run.latest_review.decision.replaceAll('_', ' ')}`
                : failedRun
                  ? 'AI failed · Not reviewable'
                  : run.inspection_status === 'PENDING_HUMAN_REVIEW'
                    ? 'Awaiting merchant decision'
                    : 'No merchant decision'
              return (
                <li key={run.inspection_id || run.id}>
                  <span className="evidence-run-number">{index + 1}</span>
                  <div className="evidence-run-copy">
                    <strong>{String(run.inspection_status || 'UNKNOWN').replaceAll('_', ' ')}</strong>
                    <p>{run.model_used || 'AI result unavailable'} · {run.photo_count || 0} photo{run.photo_count === 1 ? '' : 's'} · {reviewState}</p>
                    {run.latest_review?.notes && <small>{run.latest_review.notes}</small>}
                    <small>{run.created_at ? new Date(run.created_at).toLocaleString() : 'Time not recorded'}</small>
                  </div>
                </li>
              )
            })}
          </ol>
        </details>
      )}
      {latestReview && (
        <div className="evidence-latest-decision">
          <strong>{newerRunNeedsReview ? 'Previous merchant decision' : 'Latest merchant decision'}</strong>
          <p>{latestReview.notes || 'No additional note was recorded.'}</p>
          <small>{latestReview.reviewer_label || 'Merchant'}{latestReview.created_at ? ` · ${new Date(latestReview.created_at).toLocaleString()}` : ''}{newerRunNeedsReview ? ' · A newer inspection is awaiting review' : ''}</small>
        </div>
      )}
      <p className="evidence-timeline-disclaimer">This timeline links saved application records. It is not a blockchain and does not prove the contents of a sealed parcel.</p>
    </section>
  )
}

// ─── AI Inspection Results & Human Review View ────────────────────────────────
export function InspectionsReviewView({ orders, setOrders, paypal, activeShipmentId, setActiveShipmentId, navigateTo }) {
  const [manifest, setManifest] = useState(null)
  const [inspectionsList, setInspectionsList] = useState([])
  const [activeInspectionId, setActiveInspectionId] = useState(null)
  const [inspectionDetail, setInspectionDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewNotesExpanded, setReviewNotesExpanded] = useState(false)
  const [integrityCheck, setIntegrityCheck] = useState(null)
  const [integrityChecking, setIntegrityChecking] = useState(false)
  const [integrityError, setIntegrityError] = useState('')

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
      if (!selectedShipment) {
        setLoading(false)
        return
      }
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

  // Native browser form POSTs return with query-string feedback. Restore the
  // shipment selection and show the result after the full-page redirect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shipmentId = params.get('shipment_id')
    const knownShipment = shipmentId && orders.some(order => order.order_id === shipmentId)
    if (shipmentId && knownShipment) setActiveShipmentId(shipmentId)

    const formError = params.get('review_error')
    const formStatus = params.get('review_status')
    if (formError) {
      setReviewError(formError)
      setReviewNotesExpanded(true)
    }
    if (formStatus === 'APPROVED') setReviewFeedback('Approval saved for this packing check.')
    if (formStatus === 'NEEDS_CORRECTION') {
      setReviewFeedback('Correction saved. The shipment remains on hold until a new inspection is reviewed.')
    }
    if (formStatus === 'REJECTED') {
      setReviewFeedback('Rejection saved. Resolve the packing issue before creating another inspection.')
    }

    const handled = !shipmentId || knownShipment
    if (handled && (formError || formStatus || shipmentId)) {
      for (const key of ['shipment_id', 'inspection_id', 'review_error', 'review_status']) params.delete(key)
      const remaining = params.toString()
      const nextUrl = window.location.pathname + (remaining ? `?${remaining}` : '') + window.location.hash
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  }, [orders, setActiveShipmentId])

  // Fetch full inspection record whenever activeInspectionId changes
  useEffect(() => {
    let ignore = false
    async function fetchInspectionDetail() {
      setIntegrityCheck(null)
      setIntegrityError('')
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

  async function verifySavedPhotoIntegrity() {
    if (!inspectionDetail?.inspection_id || integrityChecking) return
    setIntegrityChecking(true)
    setIntegrityError('')
    setIntegrityCheck(null)
    try {
      const response = await fetch(
        `${API_BASE}/api/inspections/${encodeURIComponent(inspectionDetail.inspection_id)}/integrity`
      )
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.detail || 'Could not verify the saved packing photos.')
      setIntegrityCheck(data)
    } catch (verifyError) {
      setIntegrityError(verifyError.message || 'Could not verify the saved packing photos.')
    } finally {
      setIntegrityChecking(false)
    }
  }

  const aiResult = inspectionDetail?.ai_result
  const itemChecks = aiResult?.item_checks || []
  const productReferenceContext = aiResult?.product_reference_context || []
  const addlObs = aiResult?.additional_observations || {}
  const imageQuality = aiResult?.image_quality || {}
  const engineMeta = aiResult?.engine_metadata || {}
  const latestInspectionId = inspectionsList[0]?.inspection_id
  const isLatestInspection = Boolean(inspectionDetail && inspectionDetail.inspection_id === latestInspectionId)
  const canHumanReview = isLatestInspection && inspectionDetail?.inspection_status === 'PENDING_HUMAN_REVIEW'
  const suggestedReviewNote = ''
  const canSubmitTracking =
    Boolean(selectedShipment?.checkout_order_id) &&
    isLatestInspection &&
    inspectionDetail?.inspection_status === 'APPROVED' &&
    selectedShipment?.tracking_submission_status !== 'SUBMITTED' &&
    Boolean(paypal?.submission_enabled)

  function requireExplanationForDecision(event) {
    const noteField = event.currentTarget.form?.elements.namedItem('notes')
    if (!String(noteField?.value || '').trim()) {
      event.preventDefault()
      setReviewError(
        event.currentTarget.value === 'NEEDS_CORRECTION'
          ? 'Add a note explaining what needs to be fixed before requesting a correction.'
          : 'Add a note explaining why this inspection is being rejected.'
      )
      setReviewNotesExpanded(true)
    }
  }

  return (
    <main className="main" id="main-content">
      <header className="topbar">
        <div className="breadcrumb">
          <span>Workspace</span>
          <span>/</span>
          <strong>Review order</strong>
        </div>
        <div className="topbar-actions">
          <button className="btn-secondary" onClick={() => navigateTo('/')}>
            ← Orders
          </button>
        </div>
      </header>

      <OrderWorkflowProgress currentStep={4} />

      <section className="workspace-page-intro" aria-labelledby="inspection-page-title">
        <div className="workspace-page-intro-copy">
          <div className="eyebrow">PACKING CHECK</div>
          <h1 id="inspection-page-title">Does this order look right?</h1>
          <p>Compare the photo with the product reference, then choose what happens next.</p>
        </div>
      </section>

      <div className="packing-layout inspection-layout">
        <div className="inspection-shipment-toolbar">
          <label htmlFor="inspection-shipment-select">Order</label>
          <select
            id="inspection-shipment-select"
            className="form-control"
            value={selectedShipment?.order_id || ''}
            onChange={event => setActiveShipmentId(event.target.value)}
          >
            {orders.filter(order => order.checkout_order_id).map(order => (
              <option key={order.order_id} value={order.order_id}>
                {order.order_id}
              </option>
            ))}
          </select>
          
        </div>

        {/* Right: Inspection & Human Review Area */}
        <section className="packing-main-panel" aria-label="Human Review Area">
          {selectedShipment ? (
            <>
              {/* Shipment Header */}
              <div className="manifest-header-card">
                <div className="m-header-left">
                  <div className="eyebrow">PAID ORDER</div>
                  <h2>{selectedShipment.order_id}</h2>
                  <p>
                    {selectedShipment.buyer_name || 'PayPal customer'} ·
                    <strong> ${Number(selectedShipment.amount || 0).toFixed(2)} {selectedShipment.currency || 'USD'}</strong>
                  </p>
                </div>
                <div className="m-header-right">
                  {loading ? (
                    <span className="pill pill-unchecked">Loading order record…</span>
                  ) : inspectionDetail ? (
                    <span className={`pill ${inspectionDetail.inspection_status === 'APPROVED' ? 'pill-pass' : inspectionDetail.inspection_status === 'REJECTED' ? 'pill-blocked' : 'pill-warn'}`} style={{ fontSize: '12px', padding: '8px 14px' }}>
                      {inspectionDetail.inspection_status.replaceAll('_', ' ')}
                    </span>
                  ) : manifest ? (
                    <span className="pill pill-unchecked">{manifest.status}</span>
                  ) : (
                    <span className="pill pill-unchecked">Packing list not created</span>
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
                  {inspectionDetail && (
                    <EvidenceTimeline shipment={selectedShipment} manifest={manifest} inspection={inspectionDetail} inspectionRuns={inspectionsList} />
                  )}

                  {/* Human Review Banner - Prominent & Mandatory Safeguard */}
                  <div className="human-review-banner">
                    <div className="hr-shield-badge">
                      <ShieldIcon />
                    </div>
                    <div className="hr-banner-text">
                      <div className="hr-title-row">
                        <strong>{inspectionDetail?.inspection_status === 'APPROVED' ? 'You approved this packing check' : inspectionDetail?.inspection_status === 'REJECTED' ? 'This check was rejected' : inspectionDetail?.inspection_status === 'NEEDS_CORRECTION' ? 'This order needs a correction' : 'Your review is needed'}</strong>
                        <span className={`pill ${inspectionDetail?.inspection_status === 'APPROVED' ? 'pill-pass' : inspectionDetail?.inspection_status === 'REJECTED' ? 'pill-blocked' : 'pill-warn'}`}>
                          {inspectionDetail?.inspection_status === 'APPROVED'
                            ? 'APPROVED'
                            : inspectionDetail?.inspection_status === 'REJECTED'
                            ? 'REJECTED'
                            : inspectionDetail?.inspection_status === 'NEEDS_CORRECTION'
                            ? 'NEEDS FIXING'
                            : 'NEEDS YOUR DECISION'}
                        </span>
                      </div>
                      <p>
                        {inspectionDetail?.inspection_status === 'NEEDS_CORRECTION'
                          ? 'This order needs a fix before it can be sent.'
                          : inspectionDetail?.inspection_status === 'REJECTED'
                          ? 'This check was rejected. Resolve the issue before dispatch.'
                          : inspectionDetail?.inspection_status === 'APPROVED'
                          ? 'You approved this packing check.'
                          : 'The photo check is ready for your decision.'}
                      </p>
                    </div>
                  </div>

                  {inspectionsList.length > 1 && (
                    <details className="previous-inspections-details">
                      <summary>Previous checks ({inspectionsList.length - 1})</summary>
                      <div className="inspection-runs-bar">
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
                    </details>
                  )}

                  {inspectionDetail && (
                    <>
{/* AI Summary Card */}
                      {aiResult?.inspection_summary && (
                        <div className="ai-summary-callout">
                          <div className="summary-callout-header">
                            <span className="eyebrow" style={{ color: 'var(--cobalt)', margin: 0 }}>WHAT THE PHOTO CHECK FOUND</span>
                            <span className={`quality-badge q-${(imageQuality.overall || 'fair').toLowerCase()}`}>
                              Image Quality: {imageQuality.overall || 'UNKNOWN'}
                            </span>
                          </div>
                          <p className="summary-callout-body">{aiResult.inspection_summary}</p>
                          <p className="ai-identity-caveat">AI can compare visible shape, colour and design. It cannot prove an exact SKU or see inside a sealed parcel. Check the saved product photo before deciding.</p>
                        </div>
                      )}

                      {productReferenceContext.length > 0 && (
                        <section className="product-reference-context" aria-label="Catalogue references used by AI">
                          <div className="product-reference-context-heading">
                            <strong>Product reference</strong>
                            <span>What this item should look like</span>
                          </div>
                          <div className="product-reference-context-list">
                            {productReferenceContext.map(profile => {
                              const statusLabel = {
                                LOADED: 'Compare the packed item with this photo',
                                GTIN_ONLY: 'No reference photo saved',
                                UNAVAILABLE: 'Reference photo unavailable',
                                NOT_CONFIGURED: 'No reference photo saved',
                                NO_PROFILE: 'No product reference saved'
                              }[profile.reference_image_status] || 'Reference status unknown'
                              return (
                                <div
                                  className="product-reference-context-item"
                                  key={profile.sku}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1fr) 120px',
                                    alignItems: 'center',
                                    gap: '12px'
                                  }}
                                >
                                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                                    <code>{profile.sku}</code>
                                    <span>{statusLabel}</span>
                                    {profile.barcode_gtin && <small>GTIN {profile.barcode_gtin}</small>}
                                  </div>
                                  {profile.reference_image_status === 'LOADED' ? (
                                    <img
                                      src={`${API_BASE}/api/catalog/${encodeURIComponent(profile.sku)}/reference-image`}
                                      alt={`Saved catalogue reference image for ${profile.sku}`}
                                      loading="lazy"
                                      style={{
                                        width: '120px',
                                        height: '120px',
                                        objectFit: 'contain',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: '8px',
                                        background: 'var(--bg-surface)'
                                      }}
                                    />
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                      No reference image available
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          <p style={{ margin: '10px 0 0', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.45 }}>
                            Compare these saved catalogue images with the original packing photographs before recording a decision. AI observations are advisory; the merchant decides.
                          </p>
                        </section>
                      )}

                      {/* Photo Evidence Records (SHA-256 and Stored Metadata) */}
                      <div className="photo-records-card inspection-photo-gallery">
                        <div className="records-header">
                          <div>
                            <h3>Packing photo</h3>
                            <p>Original photo used for this check.</p>
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

                      <section className="photo-records-card" aria-label="Saved photo integrity verification">
                        <div className="records-header">
                          <div>
                            <h3>Evidence integrity</h3>
                            <p>Re-check the saved photo against its recorded upload hash.</p>
                          </div>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={verifySavedPhotoIntegrity}
                            disabled={integrityChecking || !inspectionDetail?.photos?.length}
                          >
                            {integrityChecking ? 'Checking…' : 'Verify saved photo'}
                          </button>
                        </div>
                        {integrityError && (
                          <div className="findings-box issues" role="alert">{integrityError}</div>
                        )}
                        {integrityCheck && (
                          <div className={integrityCheck.status === 'VERIFIED' ? 'pass-callout' : integrityCheck.status === 'UNAVAILABLE' || integrityCheck.status === 'NO_EVIDENCE' ? 'findings-box warnings' : 'findings-box issues'} role="status">
                            <strong>
                              {integrityCheck.status === 'VERIFIED'
                                ? 'Saved photo integrity verified'
                                : integrityCheck.status === 'MISMATCH'
                                  ? 'Saved photo does not match its upload record'
                                  : integrityCheck.status === 'NO_EVIDENCE'
                                    ? 'No photo evidence recorded'
                                    : 'Saved photo could not be checked'}
                            </strong>
                            <p>
                              {integrityCheck.verified_count} of {integrityCheck.photo_count} photos match their recorded SHA-256 digest and file size.
                            </p>
                            <ul>
                              {integrityCheck.photos.map(photo => (
                                <li key={photo.photo_id}>
                                  Photo {String(photo.photo_id).slice(0, 8)}…: {photo.status}
                                </li>
                              ))}
                            </ul>
                            <small>
                              This checks the stored bytes against the values recorded at upload. It does not prove who took the photo, when it was taken, or what is inside a sealed parcel.
                            </small>
                          </div>
                        )}
                      </section>

                      <div className="manifest-items-card inspection-decision-card">
                        <div className="items-card-header">
                          <div>
                            <h3>Your decision</h3>
                            <p>
                              {inspectionDetail.inspection_status === 'NEEDS_CORRECTION'
                                ? 'Correction request saved. The shipment is still on hold.'
                                : inspectionDetail.inspection_status === 'REJECTED'
                                ? 'Rejection saved. Resolve the packing issue before a new inspection.'
                                : inspectionDetail.inspection_status === 'APPROVED'
                                ? 'Approval saved for this inspection.'
                                : 'Does the packed item match the product reference?'}
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
                              AI can miss details. Check the photo yourself before approving.
                            </p>
                            <details
                              className="review-note-details"
                              open={reviewNotesExpanded}
                              onToggle={event => setReviewNotesExpanded(event.currentTarget.open)}
                            >
                              <summary>Explain your decision (required for fixing or rejecting)</summary>
                              <label htmlFor="review-notes">What needs to be fixed?</label>
                              <textarea
                                id="review-notes"
                                name="notes"
                                className="form-control"
                                rows="2"
                                maxLength={2000}
                                defaultValue={suggestedReviewNote}
                                placeholder="For example: the colour or printed design does not match the saved product reference."
                                onChange={() => setReviewError('')}
                              />
                              <small>Approval does not require a note. A correction or rejection must include a reason.</small>
                            </details>
                            <div className="inspection-decision-actions">
                              <button type="submit" name="decision" value="APPROVED" className="btn-primary">
                                Looks correct — approve
                              </button>
                              <button type="submit" name="decision" value="NEEDS_CORRECTION" className="btn-secondary" onClick={requireExplanationForDecision}>
                                Needs fixing
                              </button>
                              <details className="review-more-options">
                                <summary>More options</summary>
                                <button type="submit" name="decision" value="REJECTED" className="btn-secondary" onClick={requireExplanationForDecision}>
                                  Reject this check
                                </button>
                              </details>
                            </div>
                          </form>
                        ) : (
                          <div className="inspection-decision-form">
                            {!isLatestInspection ? (
                              <p>A newer inspection exists for this shipment. Only the latest inspection can receive a human decision.</p>
                            ) : inspectionDetail.inspection_status === 'NEEDS_CORRECTION' ? (
                              <>
                                <p>Replace the item, then take a new photo. The order will stay on hold until it passes another check.</p>
                                <button
                                  type="button"
                                  className="btn-primary"
                                  onClick={() => navigateTo('/packing', { shipmentId: selectedShipment.order_id })}
                                >
                                  Replace item and take a new photo →
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
                            <h3>What the AI compared</h3>
                            <p>Compare the visible item and quantity with the order and saved product photo. This is guidance, not proof of an exact SKU.</p>
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
                                <th style={{ width: '100px', textAlign: 'center' }}>AI confidence</th>
                                <th>Visual Evidence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itemChecks.map((chk, i) => {
                                const resultBadgeClass =
                                  chk.result === 'MATCH' ? 'pill-unchecked' :
                                  chk.result === 'POSSIBLE_MISSING' ? 'pill-blocked' :
                                  chk.result === 'POSSIBLE_EXTRA' ? 'pill-warn' :
                                  'pill-unchecked'

                                const confClass =
                                  chk.confidence === 'HIGH' ? 'score-chip high' :
                                  chk.confidence === 'MEDIUM' ? 'score-chip med' :
                                  'score-chip low'

                                return (
                                  <tr key={i}>
                                    <td className="field-readonly" data-label="SKU">{chk.sku || '—'}</td>
                                    <td data-label="Item">
                                      <strong>{chk.description}</strong>
                                    </td>
                                    <td data-label="Expected" style={{ textAlign: 'center' }} className="field-readonly bold">
                                      {chk.expected_qty}
                                    </td>
                                    <td data-label="Seen in photo" style={{ textAlign: 'center' }}>
                                      <span className={`observed-qty-tag ${chk.observed_qty === null ? 'null-qty' : ''}`}>
                                        {chk.observed_qty === null ? 'Uncertain' : chk.observed_qty}
                                      </span>
                                    </td>
                                    <td data-label="AI observation" style={{ textAlign: 'center' }}>
                                      <span className={`pill ${resultBadgeClass}`}>
                                        {chk.result === 'MATCH' ? 'Appears consistent' : chk.result.replaceAll('_', ' ').toLowerCase()}
                                      </span>
                                      {chk.identity_assessment && <small className="identity-assessment-note">Variant check: {chk.identity_assessment.replaceAll('_', ' ').toLowerCase()}{chk.matched_features?.length ? ` · compared ${chk.matched_features.join(', ')}` : ''}</small>}
                                    </td>
                                    <td data-label="AI confidence" style={{ textAlign: 'center' }}>
                                      <span className={confClass} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                        {chk.confidence}
                                      </span>
                                    </td>
                                    <td data-label="What was visible" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
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

