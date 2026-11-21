import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { seedCatalog } from './data/catalog'
import type { Order } from './lib/orders'
import { planReorder, recentOrders } from './lib/reorder'
import { activeListeners, emit } from './test/mocks'
import { customerProfile, makeOrder, renderApp, signInAs } from './test/render'
import './index.css'
import './menu.css'

const products = seedCatalog.products

function order(overrides: Partial<Order> & { id: string }): Order {
  return makeOrder(overrides) as unknown as Order
}

function item(productId: string, name: string, qty = 1, note = '', priceCents = 100) {
  return { productId, name, image: 'x.svg', priceCents, qty, note }
}

async function openMenu(orders: Order[] | null) {
  signInAs(customerProfile)
  const view = renderApp()
  await waitFor(() => expect(activeListeners('orders')).toHaveLength(1))
  if (orders) {
    await act(async () => {
      emit('orders', orders as unknown as never[])
    })
  }
  return view
}

describe('recentOrders and planReorder', () => {
  it('keeps the 3 latest orders and never repeats refused or cancelled ones', () => {
    const list = [
      order({ id: 'a', status: 'finalizado', createdAtMs: 1 }),
      order({ id: 'b', status: 'recusado', createdAtMs: 9 }),
      order({ id: 'c', status: 'cancelado', createdAtMs: 8 }),
      order({ id: 'd', status: 'novo', createdAtMs: 5 }),
      order({ id: 'e', status: 'andamento', createdAtMs: 4 }),
      order({ id: 'f', status: 'enviado', createdAtMs: 3 }),
    ]
    expect(recentOrders(list).map((entry) => entry.id)).toEqual(['d', 'e', 'f'])
  })

  it('uses the current price, repeats the note and skips missing or unavailable products', () => {
    const plan = planReorder(
      order({
        id: 'x',
        items: [
          item('smash-casa', 'Smash da casa', 2, 'sem cebola', 2000),
          item('lata', 'Lata', 1),
          item('apagado', 'Produto que saiu', 3),
        ],
      }),
      products.map((product) => (product.id === 'lata' ? { ...product, available: false } : product)),
    )
    expect(plan.wanted).toBe(6)
    expect(plan.available).toBe(2)
    expect(plan.entries).toHaveLength(1)
    expect(plan.entries[0].qty).toBe(2)
    expect(plan.entries[0].line).toMatchObject({ productId: 'smash-casa', note: 'sem cebola', priceCents: 2800 })
    expect(plan.totalCents).toBe(5600)
  })

  it('brings extras back by name when they still exist and drops the ones that are gone', () => {
    const plan = planReorder(
      order({ id: 'x', items: [item('smash-casa', 'Smash da casa + Cheddar, Molho que saiu', 1, '', 3200)] }),
      products,
    )
    expect(plan.entries[0].line.name).toBe('Smash da casa + Cheddar')
    expect(plan.entries[0].line.priceCents).toBe(3200)
  })
})

describe('Pedir de novo on the cardápio', () => {
  it('hides while loading, with no purchases and for a signed-out visitor', async () => {
    await openMenu(null)
    expect(screen.queryByRole('region', { name: 'Pedir de novo' })).not.toBeInTheDocument()
    await act(async () => {
      emit('orders', [])
    })
    expect(screen.queryByRole('region', { name: 'Pedir de novo' })).not.toBeInTheDocument()
  })

  it('does not show for a signed-out visitor', () => {
    renderApp()
    expect(screen.queryByRole('region', { name: 'Pedir de novo' })).not.toBeInTheDocument()
  })

  it('lists up to 3 cards under the category pills and adds the whole purchase at once', async () => {
    const user = userEvent.setup()
    await openMenu([
      order({
        id: 'novo-1',
        status: 'finalizado',
        createdAtMs: 3,
        items: [item('smash-casa', 'Smash da casa', 2, 'sem cebola'), item('lata', 'Lata'), item('batata', 'Batata')],
      }),
      order({ id: 'velho-2', status: 'finalizado', createdAtMs: 2, items: [item('smash-duplo', 'Smash duplo')] }),
      order({ id: 'velho-3', status: 'recusado', createdAtMs: 1, items: [item('suco', 'Suco')] }),
    ])
    const region = screen.getByRole('region', { name: 'Pedir de novo' })
    const toolbar = screen.getByRole('toolbar', { name: 'Categorias' })
    expect(toolbar.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(region.compareDocumentPosition(document.querySelector('.items') as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const cards = within(region).getAllByRole('listitem')
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveTextContent('4 itens')
    expect(cards[0]).toHaveTextContent('R$ 80,00')

    await user.click(within(cards[0]).getByRole('button', { name: /Pedir de novo/ }))
    expect(screen.getByRole('button', { name: 'Abrir carrinho, 4 itens' })).toBeInTheDocument()
    expect(screen.getByText('4 itens do pedido')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ir ao carrinho' }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    expect(within(cart).getByText('2 × R$ 28,00')).toBeInTheDocument()
    expect(within(cart).getByText('sem cebola')).toBeInTheDocument()
    expect(within(cart).getAllByRole('button', { name: 'Remover' })).toHaveLength(3)
  })

  it('warns "X de Y itens disponíveis" and disables the button when nothing is left', async () => {
    await openMenu([
      order({
        id: 'a',
        status: 'finalizado',
        createdAtMs: 3,
        items: [item('smash-casa', 'Smash da casa'), item('apagado', 'Saiu do cardápio', 2)],
      }),
      order({ id: 'b', status: 'finalizado', createdAtMs: 2, items: [item('apagado', 'Saiu do cardápio')] }),
    ])
    const cards = within(screen.getByRole('region', { name: 'Pedir de novo' })).getAllByRole('listitem')
    expect(cards[0]).toHaveTextContent('1 de 3 itens disponíveis')
    expect(within(cards[0]).getByRole('button', { name: /Pedir de novo/ })).toBeEnabled()
    expect(cards[1]).toHaveTextContent('0 de 1 itens disponíveis')
    expect(within(cards[1]).getByRole('button', { name: /Pedir de novo/ })).toBeDisabled()
  })

  it('goes away while searching or inside a category, and comes back on Início', async () => {
    const user = userEvent.setup()
    await openMenu([order({ id: 'a', status: 'finalizado', createdAtMs: 3, items: [item('smash-casa', 'Smash da casa')] })])
    expect(screen.getByRole('region', { name: 'Pedir de novo' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Smash' }))
    expect(screen.queryByRole('region', { name: 'Pedir de novo' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Início/ }))
    expect(screen.getByRole('region', { name: 'Pedir de novo' })).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'smash')
    expect(screen.queryByRole('region', { name: 'Pedir de novo' })).not.toBeInTheDocument()
  })

  it('styles the carousel and respects reduced motion', () => {
    const css = (import.meta.glob('./menu.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['./menu.css']
    expect(css).toMatch(/\.reorder__scroll \{[^}]*overflow-x: auto/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.reorder__scroll \{\s*scroll-behavior: auto/)
  })
})
