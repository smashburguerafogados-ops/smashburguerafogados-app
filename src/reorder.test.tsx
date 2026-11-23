import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
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

describe('planReorder lines', () => {
  it('flags sold-out and missing items without a price', () => {
    const plan = planReorder(
      order({ id: 'x', items: [item('smash-casa', 'Smash da casa'), item('lata', 'Lata', 2), item('apagado', 'Saiu', 1)] }),
      products.map((product) => (product.id === 'lata' ? { ...product, available: false } : product)),
    )
    expect(plan.lines.map((line) => [line.name, line.status, line.unitCents])).toEqual([
      ['Smash da casa', 'ok', 2800],
      ['Refrigerante lata', 'esgotado', null],
      ['Saiu', 'ausente', null],
    ])
    expect(new Set(plan.lines.map((line) => line.key)).size).toBe(3)
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
    expect(within(cards[0]).getByRole('button', { name: /4 itens/ })).toBeInTheDocument()
    expect(cards[0]).toHaveTextContent('R$ 80,00')
    expect(cards[0]).not.toHaveTextContent('Smash da casa')

    expect(within(cards[0]).queryByText('Pedir de novo')).not.toBeInTheDocument()
    await user.click(within(cards[0]).getByRole('button', { name: /Ver itens/ }))
    const sheet = screen.getByRole('dialog', { name: /Compra/ })
    expect(within(sheet).getByText('2 × R$ 28,00')).toBeInTheDocument()
    expect(within(sheet).getByText('sem cebola')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Adicionar ao carrinho' }))
    expect(screen.queryByRole('dialog', { name: /Compra/ })).not.toBeInTheDocument()
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
    expect(cards[0]).toHaveTextContent('1 de 3 disponíveis')
    expect(cards[1]).toHaveTextContent('0 de 1 disponíveis')
    expect(within(cards[1]).getByRole('button', { name: /Repetir pedido/ })).toBeDisabled()

    await userEvent.click(within(cards[0]).getByRole('button', { name: /Ver itens/ }))
    const first = screen.getByRole('dialog', { name: /Compra/ })
    expect(first).toHaveTextContent('1 de 3 itens disponíveis')
    expect(within(first).getByText('Não está mais no cardápio')).toBeInTheDocument()
    expect(within(first).getByRole('button', { name: 'Adicionar ao carrinho' })).toBeEnabled()
    await userEvent.click(within(first).getByRole('button', { name: 'Fechar' }))

    await userEvent.click(within(cards[1]).getByRole('button', { name: /Ver itens/ }))
    const second = screen.getByRole('dialog', { name: /Compra/ })
    expect(within(second).getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()
  })

  it('shows extras, notes and the current price inside the panel', async () => {
    const user = userEvent.setup()
    await openMenu([
      order({
        id: 'a',
        status: 'finalizado',
        createdAtMs: 3,
        items: [item('smash-casa', 'Smash da casa + Cheddar, Molho que saiu', 2, 'ponto bem passado', 2000)],
      }),
    ])
    await user.click(screen.getByRole('button', { name: /Ver itens/ }))
    const sheet = screen.getByRole('dialog', { name: /Compra/ })
    expect(within(sheet).getByText('Smash da casa')).toBeInTheDocument()
    expect(within(sheet).getByText('+ Cheddar')).toBeInTheDocument()
    expect(within(sheet).getByText('Adicional indisponível: Molho que saiu')).toBeInTheDocument()
    expect(within(sheet).getByText('ponto bem passado')).toBeInTheDocument()
    expect(within(sheet).getByText('2 × R$ 32,00')).toBeInTheDocument()
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

  it('opens exactly the purchase of the tapped card, whatever the order, and adds only that one', async () => {
    const user = userEvent.setup()
    await openMenu([
      order({ id: 'p1', status: 'finalizado', createdAtMs: 3, items: [item('smash-casa', 'Smash da casa', 2, 'sem cebola')] }),
      order({ id: 'p2', status: 'finalizado', createdAtMs: 2, items: [item('batata', 'Batata', 3), item('lata', 'Lata')] }),
      order({ id: 'p3', status: 'finalizado', createdAtMs: 1, items: [item('suco', 'Suco', 1, 'sem gelo')] }),
    ])
    const region = screen.getByRole('region', { name: 'Pedir de novo' })
    const openers = () => within(region).getAllByRole('button', { name: /Ver itens/ })
    expect(openers()).toHaveLength(3)

    const expectOnly = (sheet: HTMLElement, shown: string[], hidden: string[]) => {
      for (const name of shown) expect(within(sheet).getByText(name)).toBeInTheDocument()
      for (const name of hidden) expect(within(sheet).queryByText(name)).not.toBeInTheDocument()
    }

    await user.click(openers()[2])
    let sheet = screen.getByRole('dialog', { name: /Compra/ })
    expectOnly(sheet, ['Suco da casa', 'sem gelo'], ['Smash da casa', 'Batata rústica', 'Refrigerante lata'])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /Compra/ })).not.toBeInTheDocument()

    await user.click(openers()[1])
    sheet = screen.getByRole('dialog', { name: /Compra/ })
    expectOnly(sheet, ['Batata rústica', 'Refrigerante lata'], ['Smash da casa', 'Suco da casa'])
    expect(sheet).toHaveTextContent('R$ 56,00')
    await user.click(within(sheet).getByRole('button', { name: 'Fechar' }))

    await user.click(openers()[0])
    sheet = screen.getByRole('dialog', { name: /Compra/ })
    expectOnly(sheet, ['Smash da casa', 'sem cebola'], ['Batata rústica', 'Suco da casa'])
    await user.click(within(sheet).getByRole('button', { name: 'Fechar' }))

    await user.click(openers()[1])
    sheet = screen.getByRole('dialog', { name: /Compra/ })
    expectOnly(sheet, ['Batata rústica', 'Refrigerante lata'], ['Smash da casa', 'Suco da casa'])
    await user.click(within(sheet).getByRole('button', { name: 'Adicionar ao carrinho' }))

    expect(screen.queryByRole('dialog', { name: /Compra/ })).not.toBeInTheDocument()
    expect(screen.getByText('4 itens do pedido')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir carrinho, 4 itens' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ir ao carrinho' }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    expect(within(cart).getByText('Batata rústica')).toBeInTheDocument()
    expect(within(cart).getByText('Refrigerante lata')).toBeInTheDocument()
    expect(within(cart).queryByText('Suco da casa')).not.toBeInTheDocument()
    expect(within(cart).queryByText('Smash da casa')).not.toBeInTheDocument()
  })

  it('keeps the right purchase open when the list updates, and closes it if the purchase disappears', async () => {
    const user = userEvent.setup()
    await openMenu([
      order({ id: 'p1', status: 'finalizado', createdAtMs: 3, items: [item('smash-casa', 'Smash da casa')] }),
      order({ id: 'p2', status: 'finalizado', createdAtMs: 2, items: [item('batata', 'Batata')] }),
    ])
    await user.click(within(screen.getByRole('region', { name: 'Pedir de novo' })).getAllByRole('button', { name: /Ver itens/ })[1])
    expect(within(screen.getByRole('dialog', { name: /Compra/ })).getByText('Batata rústica')).toBeInTheDocument()
    await act(async () => {
      emit('orders', [
        order({ id: 'p0', status: 'finalizado', createdAtMs: 9, items: [item('lata', 'Lata')] }),
        order({ id: 'p1', status: 'finalizado', createdAtMs: 3, items: [item('smash-casa', 'Smash da casa')] }),
        order({ id: 'p2', status: 'finalizado', createdAtMs: 2, items: [item('batata', 'Batata')] }),
      ] as unknown as never[])
    })
    const sheet = screen.getByRole('dialog', { name: /Compra/ })
    expect(within(sheet).getByText('Batata rústica')).toBeInTheDocument()
    expect(within(sheet).queryByText('Refrigerante lata')).not.toBeInTheDocument()
    await act(async () => {
      emit('orders', [order({ id: 'p1', status: 'finalizado', createdAtMs: 3, items: [item('smash-casa', 'Smash da casa')] })] as unknown as never[])
    })
    expect(screen.queryByRole('dialog', { name: /Compra/ })).not.toBeInTheDocument()
  })

  it('does not open when the carousel is only scrolled, and closes on backdrop tap', async () => {
    const user = userEvent.setup()
    await openMenu([
      order({ id: 'p1', status: 'finalizado', createdAtMs: 3, items: [item('smash-casa', 'Smash da casa')] }),
      order({ id: 'p2', status: 'finalizado', createdAtMs: 2, items: [item('batata', 'Batata')] }),
    ])
    const scroller = document.querySelector('.reorder__scroll') as HTMLElement
    fireEvent.scroll(scroller, { target: { scrollLeft: 200 } })
    fireEvent.touchMove(scroller)
    expect(screen.queryByRole('dialog', { name: /Compra/ })).not.toBeInTheDocument()

    const opener = within(screen.getByRole('region', { name: 'Pedir de novo' })).getAllByRole('button', { name: /Ver itens/ })[0]
    await user.click(opener)
    const sheet = screen.getByRole('dialog', { name: /Compra/ })
    expect(sheet).toHaveAttribute('aria-modal', 'true')
    expect(sheet).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')
    await user.click(sheet.parentElement as HTMLElement)
    expect(screen.queryByRole('dialog', { name: /Compra/ })).not.toBeInTheDocument()
    expect(document.body.style.overflow).not.toBe('hidden')
    expect(opener).toHaveFocus()
  })

  it('styles the carousel and respects reduced motion', () => {
    const css = (import.meta.glob('./menu.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['./menu.css']
    expect(css).toMatch(/\.reorder__scroll \{[^}]*overflow-x: auto/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.reorder__scroll \{\s*scroll-behavior: auto/)
  })

  it('greets by first name and falls back to a plain title when the name is missing', async () => {
    const orders = [order({ id: 'p1', status: 'finalizado', createdAtMs: 3, items: [item('smash-casa', 'Smash da casa')] })]
    const view = await openMenu(orders)
    const region = screen.getByRole('region', { name: 'Pedir de novo' })
    expect(region).toHaveTextContent('Ana, Pedir de novo?')
    view.unmount()

    signInAs({ ...customerProfile, nome: '   ' })
    renderApp()
    await waitFor(() => expect(activeListeners('orders')).toHaveLength(1))
    await act(async () => {
      emit('orders', orders as unknown as never[])
    })
    const bare = screen.getByRole('region', { name: 'Pedir de novo' })
    const title = bare.querySelector('.reorder__label') as HTMLElement
    expect(title).toHaveTextContent(/^Pedir de novo$/)
  })

  it('shows the item names only when there is a single purchase', async () => {
    await openMenu([
      order({ id: 'p1', status: 'finalizado', createdAtMs: 3, items: [item('smash-casa', 'Smash da casa', 2), item('batata', 'Batata'), item('lata', 'Lata')] }),
    ])
    const card = within(screen.getByRole('region', { name: 'Pedir de novo' })).getByRole('listitem')
    expect(card).toHaveTextContent('2× Smash da casa, Batata rústica +1')
  })

  it('repeats a whole purchase straight from the chip, without opening the panel', async () => {
    const user = userEvent.setup()
    await openMenu([
      order({ id: 'p1', status: 'finalizado', createdAtMs: 3, items: [item('smash-casa', 'Smash da casa', 2), item('lata', 'Lata')] }),
      order({ id: 'p2', status: 'finalizado', createdAtMs: 2, items: [item('batata', 'Batata')] }),
    ])
    const cards = within(screen.getByRole('region', { name: 'Pedir de novo' })).getAllByRole('listitem')
    await user.click(within(cards[0]).getByRole('button', { name: /Repetir pedido/ }))
    expect(screen.queryByRole('dialog', { name: /Compra/ })).not.toBeInTheDocument()
    expect(screen.getByText('3 itens do pedido')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir carrinho, 3 itens' })).toBeInTheDocument()
  })

  it('opens the panel instead when part of the purchase is no longer available', async () => {
    const user = userEvent.setup()
    await openMenu([
      order({ id: 'p1', status: 'finalizado', createdAtMs: 3, items: [item('smash-casa', 'Smash da casa'), item('apagado', 'Saiu do cardápio')] }),
    ])
    await user.click(within(screen.getByRole('region', { name: 'Pedir de novo' })).getByRole('button', { name: /Repetir pedido/ }))
    const sheet = screen.getByRole('dialog', { name: /Compra/ })
    expect(sheet).toHaveTextContent('1 de 2 itens disponíveis')
    expect(screen.getByRole('button', { name: 'Abrir carrinho, 0 itens' })).toBeInTheDocument()
  })

  it('keeps the chip a slim 52px pill with a 44px repeat button', () => {
    const css = (import.meta.glob('./menu.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['./menu.css']
    expect(css).toMatch(/\.reorder__card \{[^}]*height: 52px[^}]*border-radius: 999px/)
    expect(css).toMatch(/\.reorder__again \{[^}]*width: 44px;[^}]*height: 44px/)
  })
})
