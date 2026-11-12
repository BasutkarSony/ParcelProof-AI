import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProductCatalogueView } from '../main.jsx'

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(data),
})

const catalogue = [{
  sku: 'NOTE-A5-003',
  name: 'A5 Hardcover Notebook',
  description: 'A5 notebook with navy hardcover, elastic strap and 160 ruled pages.',
  store_description: 'Hardcover ruled notebook with 160 pages.',
  currency: 'USD',
  price: '12.50',
  fragile: false,
  barcode_gtin: null,
  has_reference_image: false,
  reference_image_url: null,
}]

describe('Product catalogue identity profiles', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).endsWith('/api/catalog/identity-profiles')) return jsonResponse({ products: catalogue })
      return jsonResponse({ detail: 'Not found' }, 404)
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('allows a merchant to save without optional matching notes or a barcode', async () => {
    fetch.mockImplementation(async (url, options) => {
      if (String(url).endsWith('/api/catalog/identity-profiles')) return jsonResponse({ products: catalogue })
      if (String(url).endsWith('/api/catalog/NOTE-A5-003/identity') && options?.method === 'PUT') {
        return jsonResponse({ product: { ...catalogue[0], description: '', barcode_gtin: null } })
      }
      return jsonResponse({ detail: 'Not found' }, 404)
    })

    render(<ProductCatalogueView />)
    expect(await screen.findByText('A5 Hardcover Notebook')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Shop description for A5 Hardcover Notebook'), {
      target: { value: 'Hardcover notebook for everyday notes.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }))

    await waitFor(() => {
      expect(screen.getByText(/Reference photo not added/)).toBeInTheDocument()
    })
    const uploadCall = fetch.mock.calls.find(call =>
      String(call[0]).endsWith('/api/catalog/NOTE-A5-003/identity')
    )
    expect(uploadCall[1].body.get('description')).toBe('')
    expect(uploadCall[1].body.get('barcode_gtin')).toBe('')
  })

  it('shows products and saves description, GTIN and one reference image together', async () => {
    const updatedProduct = {
      ...catalogue[0],
      description: 'A5 ruled notebook, navy textured hardcover, elastic strap and 160 pages.',
      store_description: 'A5 hardcover notebook with a navy cover.',
      barcode_gtin: '4006381333931',
      has_reference_image: true,
      reference_image_url: '/api/catalog/NOTE-A5-003/reference-image',
    }
    fetch.mockImplementation(async (url, options) => {
      if (String(url).endsWith('/api/catalog/identity-profiles')) return jsonResponse({ products: catalogue })
      if (String(url).endsWith('/api/catalog/NOTE-A5-003/identity') && options?.method === 'PUT') {
        return jsonResponse({ product: updatedProduct })
      }
      return jsonResponse({ detail: 'Not found' }, 404)
    })

    render(<ProductCatalogueView />)
    expect(await screen.findByText('Product Catalogue')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Set up each product once.' })).toBeInTheDocument()
    expect(await screen.findByText('A5 Hardcover Notebook')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Shop description for A5 Hardcover Notebook'), {
      target: { value: updatedProduct.store_description },
    })
    fireEvent.click(screen.getByText('Extra details to help identify this version (optional)'))
    fireEvent.change(screen.getByLabelText('Product matching details for A5 Hardcover Notebook'), {
      target: { value: updatedProduct.description },
    })
    fireEvent.change(screen.getByLabelText('Barcode number for A5 Hardcover Notebook'), {
      target: { value: '4006381333931' },
    })
    const referenceFile = new File(['reference-image'], 'notebook.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Reference photo for A5 Hardcover Notebook'), {
      target: { files: [referenceFile] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save product profile' }))

    await waitFor(() => {
      expect(screen.getByText(/Profile saved for future orders/)).toBeInTheDocument()
    })
    const uploadCall = fetch.mock.calls.find(call =>
      String(call[0]).endsWith('/api/catalog/NOTE-A5-003/identity')
    )
    expect(uploadCall[1].method).toBe('PUT')
    expect(uploadCall[1].body.get('description')).toBe(updatedProduct.description)
    expect(uploadCall[1].body.get('store_description')).toBe(updatedProduct.store_description)
    expect(uploadCall[1].body.get('barcode_gtin')).toBe('4006381333931')
    expect(uploadCall[1].body.get('reference_image').name).toBe('notebook.jpg')
    expect(screen.getByRole('img', { name: /Saved catalogue reference/ }).getAttribute('src'))
      .toContain('/api/catalog/NOTE-A5-003/reference-image')
  })
})
