import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { seedCatalog } from './data/catalog'
import { clearSavedCart, readSavedCart, restoreCart, restoreNotice, saveCart } from './lib/cartStorage'
import { addCartLine, cartLineFor } from './lib/menu'
import { emit, firebaseMocks } from './test/mocks'
import { useAuth } from './context/AuthContext'
import { MenuScreen } from './components/MenuScreen'
import { customerProfile, Providers, renderApp, signInAs } from './test/render'
import './index.css'
import './menu.css'

const smash = seedCatalog.products.find((product) => product.id === 'smash-casa')!
const batata = seedCatalog.products.find((product) => product.id === 'batata')!

function cartOf(...entries: [typeof smash, string, string[], number][]) {
  return entries.reduce(
    (lines, [product, note, extras, qty]) => addCartLine(lines, cartLineFor(product, note, extras), qty),
    [] as ReturnType<typeof addCartLine>,
  )
}

async function addToCart(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole('button', { name }))
  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }))
}

function dock() {
  return screen.getByRole('navigation', { name: 'Atalhos' })
}

describe('saved cart storage', () => {
  it('saves only what is needed to rebuild the cart, and removes the key when it is empty', () => {
    saveCart(cartOf([smash, ' sem cebola ', ['bacon'], 2], [batata, '', [], 1]))
    const stored = JSON.parse(localStorage.getItem('smash.cart') ?? '{}')
    expect(stored.v).toBe(1)
    expect(stored.lines).toEqual([
      { productId: 'smash-casa', name: 'Smash da casa + Bacon', note: 'sem cebola', extraIds: ['bacon'], qty: 2 },
      { productId: 'batata', name: 'Batata rústica', note: '', extraIds: [], qty: 1 },
    ])
    expect(JSON.stringify(stored)).not.toMatch(/price|image/i)
    expect(readSavedCart()).toHaveLength(2)
    saveCart([])
    expect(localStorage.getItem('smash.cart')).toBeNull()
  })

  it('ignores a cart that is corrupted, from another version, expired or malformed', () => {
    const lines = [{ productId: 'batata', name: 'Batata rústica', note: '', extraIds: [], qty: 1 }]
    const put = (value: unknown) => localStorage.setItem('smash.cart', typeof value === 'string' ? value : JSON.stringify(value))
    const now = Date.now()
    put('{not json')
    expect(readSavedCart(now)).toEqual([])
    put({ v: 2, savedAt: now, lines })
    expect(readSavedCart(now)).toEqual([])
    put({ v: 1, savedAt: now - 25 * 60 * 60 * 1000, lines })
    expect(readSavedCart(now)).toEqual([])
    put({ v: 1, savedAt: now, lines: 'x' })
    expect(readSavedCart(now)).toEqual([])
    put({
      v: 1,
      savedAt: now,
      lines: [
        { productId: 'batata', name: 'Batata rústica', note: '', extraIds: [], qty: 500 },
        { productId: 'x', name: 'Sem quantidade', note: '', extraIds: [], qty: 0 },
        { productId: 7, name: 'Id errado', note: '', extraIds: [], qty: 1 },
        { productId: 'y', name: 'Extras errados', note: '', extraIds: [3], qty: 1 },
        null,
      ],
    })
    expect(readSavedCart(now)).toEqual([{ productId: 'batata', name: 'Batata rústica', note: '', extraIds: [], qty: 99 }])
    clearSavedCart()
    expect(readSavedCart(now)).toEqual([])
  })

  it('recalculates prices from the catalog, drops products that are gone and trims add-ons that are gone', () => {
    const saved = [
      { productId: 'smash-casa', name: 'Smash da casa + Bacon', note: 'bem passado', extraIds: ['bacon'], qty: 2 },
      { productId: 'batata', name: 'Batata rústica', note: '', extraIds: [], qty: 1 },
      { productId: 'sumiu', name: 'Item antigo', note: '', extraIds: [], qty: 1 },
      { productId: 'smash-picante', name: 'Smash picante', note: '', extraIds: [], qty: 1 },
    ]
    const products = seedCatalog.products.map((product) =>
      product.id === 'smash-casa'
        ? { ...product, price: 30, extras: [{ id: 'cheddar', name: 'Cheddar', price: 4 }] }
        : product.id === 'batata'
          ? { ...product, price: 18 }
          : product,
    )
    const restored = restoreCart(saved, products)
    expect(restored.lines.map((line) => [line.name, line.priceCents, line.qty, line.note])).toEqual([
      ['Smash da casa', 3000, 2, 'bem passado'],
      ['Batata rústica', 1800, 1, ''],
    ])
    expect(restored.dropped).toEqual(['Item antigo', 'Smash picante'])
    expect(restored.trimmed).toEqual(['Smash da casa'])
    expect(restoreNotice(restored)).toBe(
      'Não estão mais disponíveis e saíram do carrinho: Item antigo, Smash picante. Adicional indisponível removido de: Smash da casa.',
    )
    expect(restoreNotice({ dropped: [], trimmed: [] })).toBe('')
  })
})

describe('cart on the menu', () => {
  it('survives a reload: same items, with the total from the current catalog', async () => {
    const user = userEvent.setup()
    const first = renderApp()
    await addToCart(user, /Smash da casa/)
    await addToCart(user, /Batata rústica/)
    expect(dock().querySelector('.dock__sum')).toHaveTextContent('R$ 44,00')
    first.unmount()

    renderApp()
    await waitFor(() => expect(dock().querySelector('.dock__count')).toHaveTextContent('2'))
    expect(dock().querySelector('.dock__sum')).toHaveTextContent('R$ 44,00')
    expect(screen.queryByRole('region', { name: 'Carrinho restaurado' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    expect(cart.querySelectorAll('.cart li')).toHaveLength(2)
  })

  it('uses today’s price and warns about an item that is no longer sold', async () => {
    const user = userEvent.setup()
    const first = renderApp()
    await addToCart(user, /Smash da casa/)
    await addToCart(user, /Batata rústica/)
    first.unmount()

    render(
      <Providers>
        <MenuScreen />
      </Providers>,
    )
    act(() => {
      emit('categories', seedCatalog.categories.map((category) => ({ ...category })))
      emit(
        'products',
        seedCatalog.products
          .filter((product) => product.id !== 'batata')
          .map((product) => (product.id === 'smash-casa' ? { ...product, price: 31 } : { ...product })),
      )
    })
    await waitFor(() => expect(dock().querySelector('.dock__sum')).toHaveTextContent('R$ 31,00'))
    expect(dock().querySelector('.dock__count')).toHaveTextContent('1')
    const notice = screen.getByRole('region', { name: 'Carrinho restaurado' })
    expect(notice).toHaveTextContent('Não estão mais disponíveis e saíram do carrinho: Batata rústica.')
    await user.click(within(notice).getByRole('button', { name: 'Entendi' }))
    expect(screen.queryByRole('region', { name: 'Carrinho restaurado' })).not.toBeInTheDocument()
  })

  it('empties the saved cart after the order is sent', async () => {
    signInAs(customerProfile)
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    await addToCart(user, /Smash da casa/)
    expect(readSavedCart()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    await user.click(within(cart).getByRole('radio', { name: 'Pix' }))
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    expect(readSavedCart()).toEqual([])
    expect(localStorage.getItem('smash.cart')).toBeNull()
  })

  it('clears the saved cart on logout', async () => {
    const user = userEvent.setup()
    saveCart(cartOf([batata, '', [], 1]))
    function Out() {
      const { logout } = useAuth()
      return (
        <button type="button" onClick={() => void logout()}>
          Sair agora
        </button>
      )
    }
    render(
      <Providers>
        <Out />
      </Providers>,
    )
    expect(readSavedCart()).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Sair agora' }))
    expect(readSavedCart()).toEqual([])
  })

  it('removing the last item clears the saved cart', async () => {
    const user = userEvent.setup()
    renderApp()
    await addToCart(user, /Batata rústica/)
    expect(readSavedCart()).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    await user.click(within(screen.getByRole('dialog', { name: 'Carrinho' })).getByRole('button', { name: 'Remover' }))
    expect(readSavedCart()).toEqual([])
  })
})
