import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DemoLoginView } from '../main.jsx'

describe('merchant demo sign-in', () => {
  it('prefills the demo username and submits credentials', () => {
    const onLogin = vi.fn()
    render(<DemoLoginView onLogin={onLogin} loading={false} error="" demoUsername="merchant.demo" configured />)
    expect(screen.getByLabelText('Demo username')).toHaveValue('merchant.demo')
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'PackSafe#2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to ParcelProof' }))
    expect(onLogin).toHaveBeenCalledWith({ username: 'merchant.demo', password: 'PackSafe#2026' })
  })

  it('shows a sign-in error without hiding the form', () => {
    render(<DemoLoginView onLogin={vi.fn()} loading={false} error="The username or password is incorrect." demoUsername="merchant.demo" configured />)
    expect(screen.getByRole('alert')).toHaveTextContent('The username or password is incorrect.')
    expect(screen.getByLabelText('Demo username')).toBeEnabled()
  })
})
