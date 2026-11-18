import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { MAX_WAIT_MS } from './components/Splash'
import { activeListeners, emit, firebaseMocks } from './test/mocks'
import { customerProfile, makeOrder, signInAs } from './test/render'

afterEach(() => {
  vi.useRealTimers()
})

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('boot', () => {
  it('identifies the saved customer and holds the splash until their data and history load', async () => {
    vi.useFakeTimers()
    localStorage.setItem('smash.customerId', customerProfile.uid)
    signInAs(customerProfile)
    render(<App />)

    await tick(2400)
    await tick(700)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando seus pedidos')
    expect(screen.queryByRole('heading', { name: 'Cardápio' })).not.toBeInTheDocument()

    const [userRef] = firebaseMocks.getDoc.mock.calls[0] as [{ path: string }]
    expect(userRef.path).toBe('users/cliente-1')
    const [history] = activeListeners('orders')
    expect(history.ref.constraints).toEqual([{ field: 'customerId', op: '==', value: 'cliente-1' }])

    await tick(3000)
    expect(screen.queryByRole('heading', { name: 'Cardápio' })).not.toBeInTheDocument()

    await act(async () => {
      emit('orders', [makeOrder({ status: 'andamento' })])
    })
    await tick(700)

    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ana' })).toBeInTheDocument()
    expect(localStorage.getItem('smash.customerId')).toBe('cliente-1')
  })

  it('opens Meus pedidos already loaded after the splash', async () => {
    vi.useFakeTimers()
    localStorage.setItem('smash.customerId', customerProfile.uid)
    signInAs(customerProfile)
    render(<App />)
    await tick(100)
    await act(async () => {
      emit('orders', [makeOrder({ id: 'pedido-77777', status: 'novo' })])
    })
    await tick(2400)
    await tick(700)
    vi.useRealTimers()

    expect(screen.queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument()
    screen.getByRole('button', { name: 'Meus pedidos' }).click()
    await act(async () => {})

    const dialog = screen.getByRole('dialog', { name: 'Meus pedidos' })
    expect(dialog).not.toHaveTextContent('Carregando seus pedidos')
    expect(dialog).toHaveTextContent('#77777')
  })

  it('leaves after the normal hold when no customer was saved', async () => {
    vi.useFakeTimers()
    render(<App />)
    await tick(2400)
    await tick(700)
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
    expect(activeListeners('orders')).toHaveLength(0)
    expect(localStorage.getItem('smash.customerId')).toBeNull()
  })

  it('clears a stale saved id when Firebase has no session', async () => {
    vi.useFakeTimers()
    localStorage.setItem('smash.customerId', 'antigo')
    render(<App />)
    await tick(2400)
    await tick(700)
    expect(localStorage.getItem('smash.customerId')).toBeNull()
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('does not hang forever when the history never answers', async () => {
    vi.useFakeTimers()
    signInAs(customerProfile)
    render(<App />)
    await tick(MAX_WAIT_MS - 100)
    expect(screen.queryByRole('heading', { name: 'Cardápio' })).not.toBeInTheDocument()
    await tick(200)
    await tick(700)
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  })
})
