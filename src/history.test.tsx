import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { activeListeners, emit, firebaseMocks } from './test/mocks'
import { adminProfile, customerProfile, makeOrder, renderApp, signInAs } from './test/render'
import './index.css'
import './menu.css'

const BLUE = 'rgb(23, 64, 139)'

async function openHistory(orders = [
  makeOrder({ id: 'pedido-00001', status: 'novo', createdAtMs: 4 }),
  makeOrder({ id: 'pedido-00002', status: 'andamento', createdAtMs: 3 }),
  makeOrder({ id: 'pedido-00003', status: 'recusado', reason: 'Fora da área', createdAtMs: 2 }),
  makeOrder({ id: 'pedido-00004', status: 'enviado', createdAtMs: 1 }),
]) {
  signInAs(customerProfile)
  const user = userEvent.setup()
  renderApp()
  await waitFor(() => expect(activeListeners('orders')).toHaveLength(1))
  await act(async () => {
    emit('orders', orders)
  })
  expect(screen.queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Meus pedidos' }))
  return user
}

function card(id: string): HTMLElement {
  return screen.getByRole('listitem', { name: `Pedido #${id}` })
}

describe('orders icon on the dock', () => {
  it('blinks blue while an order is accepted or out for delivery and stops once finished', async () => {
    signInAs(customerProfile)
    renderApp()
    await waitFor(() => expect(activeListeners('orders')).toHaveLength(1))
    const button = () => screen.getByRole('button', { name: 'Meus pedidos' })

    await act(async () => {
      emit('orders', [makeOrder({ id: 'pedido-00001', status: 'novo' })])
    })
    expect(button()).not.toHaveClass('dock__item--live')

    await act(async () => {
      emit('orders', [makeOrder({ id: 'pedido-00001', status: 'andamento' })])
    })
    expect(button()).toHaveClass('dock__item--live')
    const icon = getComputedStyle(button().querySelector('svg') as SVGElement)
    expect(icon.color).toBe('rgb(59, 156, 255)')
    expect(icon.animationName).toBe('order-live')

    await act(async () => {
      emit('orders', [makeOrder({ id: 'pedido-00001', status: 'enviado' })])
    })
    expect(button()).toHaveClass('dock__item--live')

    await act(async () => {
      emit('orders', [makeOrder({ id: 'pedido-00001', status: 'finalizado' })])
    })
    expect(button()).not.toHaveClass('dock__item--live')
    expect(getComputedStyle(button().querySelector('svg') as SVGElement).animationName).not.toBe('order-live')
  })
})

describe('customer order history', () => {
  it('lists only this customer, newest first', async () => {
    await openHistory()
    const [listener] = activeListeners('orders')
    expect(listener.ref.constraints).toEqual([{ field: 'customerId', op: '==', value: 'cliente-1' }])
    const ids = Array.from(document.querySelectorAll('.history__card .history__head strong')).map((n) => n.textContent)
    expect(ids).toEqual(['#00001', '#00002', '#00003', '#00004'])
  })

  it('turns the card blue once the admin accepts the order', async () => {
    await openHistory()
    expect(getComputedStyle(card('00002')).backgroundColor).toBe(BLUE)
    expect(card('00002')).toHaveTextContent('Aceito, em preparo')
    expect(getComputedStyle(card('00004')).backgroundColor).toBe(BLUE)
    expect(getComputedStyle(card('00001')).backgroundColor).not.toBe(BLUE)
    expect(getComputedStyle(card('00003')).backgroundColor).not.toBe(BLUE)

    await act(async () => {
      emit('orders', [makeOrder({ id: 'pedido-00001', status: 'andamento' })])
    })
    expect(getComputedStyle(card('00001')).backgroundColor).toBe(BLUE)
  })

  it('keeps the refusal reason on the history card', async () => {
    await openHistory()
    expect(card('00003')).toHaveTextContent('Recusado')
    expect(card('00003')).toHaveTextContent('Motivo: Fora da área')
  })

  it('shows the cancel reason too', async () => {
    await openHistory([makeOrder({ id: 'pedido-00008', status: 'cancelado', reason: 'Acabou o pão' })])
    expect(card('00008')).toHaveTextContent('Cancelado')
    expect(card('00008')).toHaveTextContent('Motivo: Acabou o pão')
  })

  it('marks an order finished from the history once it is out for delivery', async () => {
    const user = await openHistory()
    expect(within(card('00001')).queryByRole('button', { name: 'Pedido recebido' })).not.toBeInTheDocument()
    expect(within(card('00002')).queryByRole('button', { name: 'Pedido recebido' })).not.toBeInTheDocument()

    await user.click(within(card('00004')).getByRole('button', { name: 'Pedido recebido' }))
    const [ref, patch] = firebaseMocks.updateDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>]
    expect(ref.path).toBe('orders/pedido-00004')
    expect(patch).toEqual({ status: 'finalizado', updatedAt: 'SERVER_TIME' })
    expect(window.open).not.toHaveBeenCalled()
  })

  it('shows Criar Produto only to admins and Meus pedidos only to customers', async () => {
    await openHistory()
    expect(screen.queryByRole('button', { name: 'Criar Produto' })).not.toBeInTheDocument()
  })

  it('gives admins the panel and Criar Produto in the hamburger', async () => {
    signInAs(adminProfile)
    const user = userEvent.setup()
    const menuPage = renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument()
    menuPage.unmount()

    renderApp('/admin')
    await user.click(await screen.findByRole('button', { name: 'Abrir menu' }))
    const menu = screen.getByRole('dialog', { name: 'Menu' })
    const create = within(menu).getByRole('button', { name: 'Criar Produto' })
    expect(create).toBeInTheDocument()
    expect(parseFloat(getComputedStyle(create).fontSize)).toBeLessThan(16)
    expect(within(menu).getByRole('button', { name: 'Painel de pedidos' })).toBeInTheDocument()
    expect(within(menu).queryByRole('button', { name: 'Meus pedidos' })).not.toBeInTheDocument()
  })
})
