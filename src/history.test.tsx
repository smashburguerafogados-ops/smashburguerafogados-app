import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { activeListeners, emit, firebaseMocks } from './test/mocks'
import { adminProfile, customerProfile, makeOrder, renderApp, signInAs } from './test/render'
import './index.css'
import './menu.css'
import menuCss from './menu.css?raw'

const GOLD = 'rgb(227, 177, 90)'

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
  await user.click(screen.getByRole('button', { name: /^(Meus pedidos|Histórico)/ }))
  return user
}

function card(id: string): HTMLElement {
  return screen.getByRole('listitem', { name: `Pedido #${id}` })
}

describe('orders icon on the dock', () => {
  const BLUE = 'rgb(77, 163, 255)'

  async function setup() {
    signInAs(customerProfile)
    renderApp()
    await waitFor(() => expect(activeListeners('orders')).toHaveLength(1))
    return () => screen.getByRole('button', { name: /^(Meus pedidos|Histórico)/ })
  }
  const iconOf = (button: HTMLElement) => getComputedStyle(button.querySelector('svg') as SVGElement)

  it('pulses blue while any order is not finished and stops once all are', async () => {
    const button = await setup()
    expect(button()).toHaveAccessibleName('Meus pedidos')

    await act(async () => {
      emit('orders', [makeOrder({ id: 'pedido-00001', status: 'novo' })])
    })
    expect(button()).toHaveClass('dock__item--live')
    expect(button()).toHaveAccessibleName('Histórico, pedido em andamento')
    expect(iconOf(button()).color).toBe(BLUE)
    expect(iconOf(button()).animationName).toBe('order-open')
    expect(screen.getByRole('status')).toHaveTextContent('Você tem pedido em andamento')

    for (const status of ['andamento', 'enviado'] as const) {
      await act(async () => {
        emit('orders', [makeOrder({ id: 'pedido-00001', status })])
      })
      expect(button()).toHaveClass('dock__item--live')
    }

    await act(async () => {
      emit('orders', [makeOrder({ id: 'pedido-00001', status: 'finalizado' })])
    })
    expect(button()).not.toHaveClass('dock__item--live')
    expect(button()).toHaveAccessibleName('Meus pedidos')
    expect(iconOf(button()).animationName).not.toBe('order-open')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('keeps pulsing while one of several orders is still open and ignores refused or cancelled ones', async () => {
    const button = await setup()
    await act(async () => {
      emit('orders', [
        makeOrder({ id: 'pedido-00001', status: 'recusado', reason: 'Fora da área' }),
        makeOrder({ id: 'pedido-00002', status: 'cancelado' }),
        makeOrder({ id: 'pedido-00003', status: 'finalizado' }),
      ])
    })
    expect(button()).not.toHaveClass('dock__item--live')

    await act(async () => {
      emit('orders', [
        makeOrder({ id: 'pedido-00001', status: 'novo' }),
        makeOrder({ id: 'pedido-00002', status: 'andamento' }),
        makeOrder({ id: 'pedido-00003', status: 'finalizado' }),
      ])
    })
    expect(button()).toHaveAccessibleName('Histórico, 2 pedidos em andamento')

    await act(async () => {
      emit('orders', [
        makeOrder({ id: 'pedido-00001', status: 'finalizado' }),
        makeOrder({ id: 'pedido-00002', status: 'andamento' }),
      ])
    })
    expect(button()).toHaveClass('dock__item--live')
    await act(async () => {
      emit('orders', [
        makeOrder({ id: 'pedido-00001', status: 'finalizado' }),
        makeOrder({ id: 'pedido-00002', status: 'finalizado' }),
      ])
    })
    expect(button()).not.toHaveClass('dock__item--live')
  })

  it('keeps the blue icon on the active item and in reduced motion', async () => {
    const button = await setup()
    await act(async () => {
      emit('orders', [makeOrder({ id: 'pedido-00001', status: 'novo' })])
    })
    await userEvent.setup().click(button())
    expect(button()).toHaveAttribute('aria-current', 'true')
    expect(button()).toHaveClass('is-active', 'dock__item--live')
    expect(iconOf(button()).color).toBe(BLUE)
  })

  it('stays out of the way of the admin', async () => {
    signInAs(adminProfile)
    renderApp()
    await screen.findByText('Gerente')
    expect(activeListeners('orders').filter((l) => (l.ref.constraints as { field: string }[] | undefined)?.some((c) => c.field === 'customerId'))).toHaveLength(0)
    expect(document.querySelector('.dock__item--live')).toBeNull()
    expect(screen.queryByText(/Você tem/)).not.toBeInTheDocument()
  })

  it('has no animation under prefers-reduced-motion but stays blue', () => {
    const css = menuCss.slice(menuCss.indexOf('.dock__item--live svg {'))
    expect(css).toMatch(/\.dock__item--live svg \{\s*color: #4da3ff;/)
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.dock__item--live svg \{\s*animation: none;/)
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

  it('marks an accepted order with a gold border and drops it when the order is finished', async () => {
    await openHistory()
    expect(getComputedStyle(card('00002')).backgroundColor).toBe('rgb(0, 0, 0)')
    expect(getComputedStyle(card('00002')).borderTopColor).toBe(GOLD)
    expect(card('00002')).toHaveTextContent('Aceito, em preparo')
    expect(getComputedStyle(card('00004')).borderTopColor).toBe(GOLD)
    expect(getComputedStyle(card('00001')).borderTopColor).not.toBe(GOLD)
    expect(getComputedStyle(card('00003')).borderTopColor).not.toBe(GOLD)

    await act(async () => {
      emit('orders', [makeOrder({ id: 'pedido-00001', status: 'andamento' })])
    })
    expect(getComputedStyle(card('00001')).borderTopColor).toBe(GOLD)
  })

  it('says a pickup is ready for pickup and hides the delivery fee', async () => {
    await openHistory([
      makeOrder({
        id: 'pedido-00011',
        status: 'andamento',
        fulfillment: 'retirada',
        deliveryFeeCents: 500,
        totalCents: 2800,
        address: null,
      }),
      makeOrder({
        id: 'pedido-00012',
        status: 'enviado',
        fulfillment: 'retirada',
        deliveryFeeCents: 0,
        totalCents: 2800,
        address: null,
      }),
      makeOrder({
        id: 'pedido-00013',
        status: 'enviado',
        fulfillment: 'entrega',
        deliveryFeeCents: 500,
        totalCents: 3300,
      }),
    ])
    expect(card('00011')).toHaveTextContent('Aceito, em preparo')
    expect(card('00011')).not.toHaveTextContent('Saiu para entrega')
    expect(card('00011')).not.toHaveTextContent('Taxa de entrega')
    expect(card('00012')).toHaveTextContent('Pronto para retirada')
    expect(card('00012')).not.toHaveTextContent('Saiu para entrega')
    expect(card('00012')).not.toHaveTextContent('Taxa de entrega')
    expect(card('00013')).toHaveTextContent('Saiu para entrega')
    expect(card('00013')).toHaveTextContent('Taxa de entrega: R$ 5,00')
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
