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
