import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { MenuScreen } from './components/MenuScreen'
import { descriptionItems } from './components/ProductDialog'
import { Griddle } from './components/Griddle'
import { customerProfile, emitSeedCatalog, signInAs } from './test/render'
import { emit, emitCached } from './test/mocks'
import { CATALOG_TIMEOUT_MS } from './lib/remoteCatalog'
import './index.css'
import './menu.css'
import './griddle.css'

afterEach(() => {
  vi.useRealTimers()
})

function renderMenu() {
  const view = render(
    <AuthProvider>
      <MemoryRouter>
        <MenuScreen />
      </MemoryRouter>
    </AuthProvider>,
  )
  act(() => {
    emitSeedCatalog()
  })
  return view
}

it('leaves the title empty until a name exists, then shows the first name', async () => {
  renderMenu()
  const header = document.querySelector('.menu__top') as HTMLElement
  const logo = header.querySelector('.menu__logo') as HTMLElement
  const brand = header.querySelector('.menu__brand') as HTMLElement
  expect(header.querySelector('.menu__title')).toBeNull()
  expect(header).not.toHaveTextContent('Cardápio')
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  expect(logo).toBe(header.firstElementChild)
  expect(getComputedStyle(header).justifyContent).toBe('flex-start')
  expect(getComputedStyle(logo).flexGrow).toBe('0')
  expect(getComputedStyle(brand).flexGrow).toBe('1')
  expect(getComputedStyle(brand).alignItems).toBe('center')
  expect(getComputedStyle(brand).textAlign).toBe('center')

  signInAs({ ...customerProfile, nome: '' })
  renderMenu()
  expect(document.querySelector('.menu__title')).toBeNull()
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
})

it('shows only the first name in the header once the customer has one', async () => {
  signInAs(customerProfile)
  renderMenu()
  const title = await screen.findByRole('heading', { name: 'Ana' })
  expect(title).toHaveClass('menu__title')
  expect(title.closest('.menu__brand')).not.toBeNull()
  expect(screen.queryByRole('heading', { name: 'Ana Souza' })).not.toBeInTheDocument()
  expect(screen.queryByText('Cardápio')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Smash Burger' })).toBeInTheDocument()
})

it('shows the SMASH BURGER wordmark with a gold rule, with or without a name', async () => {
  renderMenu()
  const wordmark = document.querySelector('.menu__brand .menu__wordmark') as HTMLElement
  expect(wordmark).toHaveTextContent('Smash Burger')
  expect(wordmark.querySelector('.menu__wordmark-gold')).toHaveTextContent('Burger')
  expect(getComputedStyle(wordmark).textTransform).toBe('uppercase')
  expect(wordmark.nextElementSibling).toHaveClass('menu__rule')
  expect(document.querySelector('.menu__title')).toBeNull()
  expect(document.querySelector('.menu__brand .eyebrow')).toBeNull()

  signInAs(customerProfile)
  renderMenu()
  const title = await screen.findByRole('heading', { name: 'Ana' })
  const brand = title.closest('.menu__brand') as HTMLElement
  expect(brand.children[0]).toHaveClass('menu__wordmark')
  expect(brand.children[1]).toHaveClass('menu__rule')
  expect(brand.children[2]).toBe(title)
})

it('shines through the wordmark letters and stays static with reduced motion', () => {
  const css = (import.meta.glob('./menu.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['./menu.css']
  const supports = css.slice(css.indexOf('@supports (-webkit-background-clip'), css.indexOf('@keyframes wordmark-shine-a'))
  expect(supports).toContain('background-clip: text')
  expect(supports).toMatch(/span:first-child \{[^}]*wordmark-shine-a/)
  expect(supports).toMatch(/menu__wordmark-gold \{[^}]*wordmark-shine-b/)
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .menu__wordmark > span'))
  expect(reduced).toMatch(/animation: none !important/)
  expect(reduced).toMatch(/background-position: 50% 0 !important/)
})

it('keeps loading on an empty offline cache instead of saying no item was found', () => {
  render(
    <AuthProvider>
      <MemoryRouter>
        <MenuScreen />
      </MemoryRouter>
    </AuthProvider>,
  )
  act(() => {
    emitCached('categories', [])
    emitCached('products', [])
  })
  expect(screen.queryByText('Nenhum item encontrado.')).not.toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'Carregando o cardápio.' })).toBeInTheDocument()

  act(() => {
    emitSeedCatalog()
  })
  expect(screen.queryByRole('status', { name: 'Carregando o cardápio.' })).not.toBeInTheDocument()
  expect(document.querySelectorAll('.item').length).toBeGreaterThan(0)
})

it('offers a retry when the menu never arrives, and still shows a late answer', () => {
  vi.useFakeTimers()
  render(
    <AuthProvider>
      <MemoryRouter>
        <MenuScreen />
      </MemoryRouter>
    </AuthProvider>,
  )
  act(() => {
    emitCached('products', [])
    vi.advanceTimersByTime(CATALOG_TIMEOUT_MS)
  })
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o cardápio.')
  expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  expect(screen.queryByText('Nenhum item encontrado.')).not.toBeInTheDocument()

  act(() => {
    emitSeedCatalog()
  })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(document.querySelectorAll('.item').length).toBeGreaterThan(0)
})

it('opens on Início and lists products from every category', () => {
  renderMenu()
  const chips = within(screen.getByRole('toolbar', { name: 'Categorias' })).getAllByRole('button')
  expect(chips.map((chip) => chip.textContent)).toEqual(['Início', 'Smash', 'Acompanhamentos', 'Bebidas'])
  const home = chips[0]
  expect(home).toHaveAttribute('aria-pressed', 'true')
  expect(home).toHaveClass('is-active')
  expect(home).not.toHaveClass('chip--destaque')
  expect(home.querySelector('.chip__sun')).toBeNull()
  expect(screen.getByRole('button', { name: /Smash da casa/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Batata rústica/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Refrigerante lata/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /geral/i })).not.toBeInTheDocument()
})

it('filters by category, remembers it, and returns to all when tapped again', async () => {
  const user = userEvent.setup()
  renderMenu()

  await user.click(screen.getByRole('button', { name: 'Bebidas' }))

  expect(sessionStorage.getItem('smash.category')).toBe('drinks')
  expect(screen.getByRole('button', { name: /Refrigerante lata/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Smash da casa/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Bebidas' })).toHaveAttribute('aria-pressed', 'true')

  await user.click(screen.getByRole('button', { name: 'Bebidas' }))

  expect(sessionStorage.getItem('smash.category')).toBeNull()
  expect(screen.getByRole('button', { name: 'Início' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /Smash da casa/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Refrigerante lata/ })).toBeInTheDocument()
})

it('restores the last category from the session', () => {
  sessionStorage.setItem('smash.category', 'sides')
  renderMenu()
  expect(screen.getByRole('button', { name: /Batata rústica/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Smash da casa/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Acompanhamentos' })).toHaveAttribute('aria-pressed', 'true')
})

it('searches every product on Início and only the chosen category after that', async () => {
  const user = userEvent.setup()
  renderMenu()
  const search = screen.getByRole('searchbox', { name: 'Buscar' })

  await user.type(search, 'batata')
  expect(screen.getByRole('button', { name: /Batata rústica/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Smash da casa/ })).not.toBeInTheDocument()

  await user.clear(search)
  await user.click(screen.getByRole('button', { name: 'Bebidas' }))
  await user.type(search, 'batata')
  expect(screen.queryByRole('button', { name: /Batata rústica/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Refrigerante lata/ })).not.toBeInTheDocument()

  await user.clear(search)
  await user.type(search, 'lata')
  expect(screen.getByRole('button', { name: /Refrigerante lata/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Smash da casa/ })).not.toBeInTheDocument()
})

it('keeps a product without a category on Início only', async () => {
  render(
    <AuthProvider>
      <MemoryRouter>
        <MenuScreen />
      </MemoryRouter>
    </AuthProvider>,
  )
  await act(async () => {
    emit('categories', [{ id: 'lanches', name: 'Lanches', order: 1, destaque: false }])
    emit('products', [
      { id: 'solto', name: 'Molho extra', price: 3, available: true, image: '' },
      { id: 'x', categoryId: 'lanches', name: 'X-Burger', price: 20, available: true, image: '' },
    ])
  })
  expect(screen.getByRole('button', { name: 'Início' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /Molho extra/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /X-Burger/ })).toBeInTheDocument()

  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Lanches' }))
  expect(screen.queryByRole('button', { name: /Molho extra/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /X-Burger/ })).toBeInTheDocument()
})

it('searches by name across the cardápio', async () => {
  const user = userEvent.setup()
  renderMenu()

  await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'batata')

  expect(screen.getByRole('button', { name: /Batata rústica/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Smash da casa/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Refrigerante lata/ })).not.toBeInTheDocument()
})

it('opens the detail popup and blocks a sold-out item', async () => {
  const user = userEvent.setup()
  renderMenu()

  await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
  const detail = screen.getByRole('dialog', { name: 'Smash da casa' })
  expect(detail).toHaveTextContent('molho da casa')
  expect(detail).toHaveTextContent('Cheddar')
  const close = within(detail).getByRole('button', { name: 'Fechar' })
  expect(close).toHaveClass('mark-btn')
  expect(close).not.toHaveTextContent('Fechar')
  await user.click(close)

  await user.click(screen.getByRole('button', { name: /Smash picante/ }))
  const sold = screen.getByRole('dialog', { name: 'Smash picante' })
  expect(sold).toHaveTextContent('Esgotado')
  const add = within(sold).getByRole('button', { name: 'Adicionar' })
  expect(add).toBeDisabled()
  await user.click(add)
  expect(screen.getByRole('navigation', { name: 'Atalhos' }).querySelector('.dock__count')).toHaveTextContent('0')
})

it('keeps each stored description line as a light italic item', async () => {
  const stored = '1 X-Bacon: pão brioche, carne 100g, bacon, queijo cheddar, tomate, alface e molho\r\n1 batata P: 190g\n1 Coca lata'
  expect(descriptionItems(stored)).toEqual([
    '1 X-Bacon: pão brioche, carne 100g, bacon, queijo cheddar, tomate, alface e molho',
    '1 batata P: 190g',
    '1 Coca lata',
  ])
  expect(descriptionItems('Pão brioche, blend 80g, queijo cheddar e molho da casa.')).toEqual([
    'Pão brioche, blend 80g, queijo cheddar e molho da casa.',
  ])

  const user = userEvent.setup()
  render(
    <AuthProvider>
      <MemoryRouter>
        <MenuScreen />
      </MemoryRouter>
    </AuthProvider>,
  )
  await act(async () => {
    emit('categories', [{ id: 'lanches', name: 'Lanches', order: 1, destaque: false }])
    emit('products', [
      {
        id: 'combo',
        categoryId: 'lanches',
        name: 'Combo da casa',
        description: stored,
        price: 30,
        available: true,
        image: '',
      },
    ])
  })
  await user.click(screen.getByRole('button', { name: /Combo da casa/ }))
  const detail = screen.getByRole('dialog', { name: 'Combo da casa' })
  const lines = within(detail).getAllByRole('listitem')
  expect(lines.map((line) => line.textContent)).toEqual(descriptionItems(stored))
  for (const line of lines) {
    expect(line).toHaveClass('product__item')
    const style = getComputedStyle(line)
    expect(style.fontStyle).toBe('italic')
    expect(Number(style.fontWeight)).toBeLessThanOrEqual(300)
  }
})

it('enlarges the product photo and returns to the popup without blocking add', async () => {
  const user = userEvent.setup()
  renderMenu()

  await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
  const detail = screen.getByRole('dialog', { name: 'Smash da casa' })
  const thumb = within(detail).getByRole('button', { name: 'Ampliar foto de Smash da casa' })
  expect(thumb.closest('.product')?.firstElementChild).toBe(thumb)
  expect(getComputedStyle(thumb).width).toContain('100%')
  expect(getComputedStyle(thumb).maxHeight).toContain('320px')

  await user.click(thumb)
  const zoom = screen.getByRole('dialog', { name: 'Foto de Smash da casa' })
  const big = within(zoom).getByRole('button', { name: 'Foto ampliada' })
  expect(getComputedStyle(big).width).not.toContain('100% + 32px')
  expect(zoom).toHaveTextContent('Toque para fechar')
  expect(within(detail).getByRole('button', { name: 'Adicionar' })).toBeEnabled()

  await user.click(within(zoom).getByRole('button', { name: 'Fechar foto' }))
  expect(screen.queryByRole('dialog', { name: 'Foto de Smash da casa' })).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Smash da casa' })).toBe(detail)

  await user.click(within(detail).getByRole('button', { name: 'Ampliar foto de Smash da casa' }))
  await user.click(screen.getByRole('button', { name: 'Foto ampliada' }))
  expect(screen.queryByRole('dialog', { name: 'Foto de Smash da casa' })).not.toBeInTheDocument()

  await user.click(within(detail).getByRole('button', { name: 'Adicionar' }))
  expect(screen.getByRole('navigation', { name: 'Atalhos' }).querySelector('.dock__count')).toHaveTextContent('1')
})

it('updates the product price live with quantity and add-ons', async () => {
  const user = userEvent.setup()
  renderMenu()

  await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
  const detail = screen.getByRole('dialog', { name: 'Smash da casa' })
  const price = () => detail.querySelector('.product__total') as HTMLElement

  expect(price()).toHaveTextContent('R$ 28,00')
  await user.click(within(detail).getByRole('button', { name: 'Aumentar' }))
  await user.click(within(detail).getByRole('button', { name: 'Aumentar' }))
  expect(price()).toHaveTextContent('R$ 84,00')

  await user.click(within(detail).getByRole('checkbox', { name: /Cheddar/ }))
  expect(price()).toHaveTextContent('R$ 96,00')
  await user.click(within(detail).getByRole('button', { name: 'Diminuir' }))
  expect(price()).toHaveTextContent('R$ 64,00')
})

it('adds the chosen quantity, then another product as its own line', async () => {
  const user = userEvent.setup()
  renderMenu()

  await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
  const detail = screen.getByRole('dialog', { name: 'Smash da casa' })
  const less = within(detail).getByRole('button', { name: 'Diminuir' })
  expect(less).toBeDisabled()
  await user.click(within(detail).getByRole('button', { name: 'Aumentar' }))
  await user.click(within(detail).getByRole('button', { name: 'Aumentar' }))
  expect(within(detail).getByRole('group', { name: 'Quantidade' })).toHaveTextContent('3')
  await user.click(within(detail).getByRole('button', { name: 'Adicionar' }))
  expect(screen.getByRole('navigation', { name: 'Atalhos' }).querySelector('.dock__count')).toHaveTextContent('3')

  await user.click(screen.getByRole('button', { name: /Batata rústica/ }))
  await user.click(within(screen.getByRole('dialog', { name: 'Batata rústica' })).getByRole('button', { name: 'Adicionar' }))
  await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))

  const cart = screen.getByRole('dialog', { name: 'Carrinho' })
  const rows = cart.querySelectorAll('.cart li')
  expect(rows).toHaveLength(2)
  expect(within(cart).getByText('3 × R$ 28,00')).toBeInTheDocument()
  expect(within(cart).getByText('1 × R$ 16,00')).toBeInTheDocument()
})

it('adds a note and updates the cart count and total', async () => {
  const user = userEvent.setup()
  renderMenu()

  await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
  const detail = screen.getByRole('dialog', { name: 'Smash da casa' })
  expect(within(detail).getByRole('textbox', { name: 'Observação' })).toHaveAttribute(
    'placeholder',
    'Ex.: tirar cebola, ponto da carne',
  )
  expect(detail).toHaveTextContent('Exemplo: tirar cebola, sem molho, bem passado.')
  await user.type(within(detail).getByRole('textbox', { name: 'Observação' }), 'sem cebola')
  await user.click(within(detail).getByRole('button', { name: 'Adicionar' }))

  const dock = screen.getByRole('navigation', { name: 'Atalhos' })
  expect(dock.querySelector('.dock__count')).toHaveTextContent('1')
  expect(dock.querySelector('.dock__sum')).toHaveTextContent('R$ 28,00')
  expect(dock.querySelector('.dock__count')).not.toHaveClass('is-zero')
  expect(screen.getByRole('button', { name: 'Abrir carrinho, 1 item' })).toHaveTextContent('1')

  await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
  const cart = screen.getByRole('dialog', { name: 'Carrinho' })
  expect(cart).toHaveTextContent('sem cebola')
  expect(cart).toHaveTextContent('Smash da casa')
  expect(cart).toHaveTextContent('R$ 28,00')
  expect(dock.querySelector('.dock__item.is-active .dock__sum')).toHaveTextContent('R$ 28,00')
})

it('confirms an added item with a gold border and lets the customer stay on the menu', async () => {
  vi.useFakeTimers()
  renderMenu()

  fireEvent.click(screen.getByRole('button', { name: /Smash da casa/ }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Smash da casa' })).getByRole('button', { name: 'Adicionar' }))

  const added = screen.getByRole('region', { name: 'Item adicionado' })
  expect(within(added).getByRole('status')).toHaveTextContent('Adicionado: Smash da casa')
  expect(added.closest('[role="dialog"]')).toBeNull()
  const style = getComputedStyle(added)
  expect(style.borderTopColor).toBe('rgb(227, 177, 90)')
  expect(style.borderTopWidth).toBe('2px')
  expect(style.top).toBe('auto')
  expect(style.bottom).toBe('96px')
  const status = within(added).getByRole('status')
  expect(getComputedStyle(status).whiteSpace).toBe('normal')
  expect(parseFloat(getComputedStyle(status).fontSize)).toBeGreaterThanOrEqual(18)
  for (const name of ['Ir ao carrinho', 'Continuar no cardápio']) {
    const button = within(added).getByRole('button', { name })
    const buttonStyle = getComputedStyle(button)
    expect(buttonStyle.textTransform).toBe('none')
    expect(parseFloat(buttonStyle.fontSize)).toBeGreaterThanOrEqual(16)
    expect(parseFloat(buttonStyle.minHeight)).toBeGreaterThanOrEqual(48)
  }

  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000)
  })
  expect(screen.getByRole('region', { name: 'Item adicionado' })).toBeInTheDocument()

  fireEvent.click(within(added).getByRole('button', { name: 'Continuar no cardápio' }))
  expect(screen.queryByRole('region', { name: 'Item adicionado' })).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'Carrinho' })).not.toBeInTheDocument()
})

it('opens the cart from the added-item confirmation', async () => {
  const user = userEvent.setup()
  renderMenu()

  await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
  await user.click(within(screen.getByRole('dialog', { name: 'Smash da casa' })).getByRole('button', { name: 'Adicionar' }))
  const added = screen.getByRole('region', { name: 'Item adicionado' })
  await user.click(within(added).getByRole('button', { name: 'Ir ao carrinho' }))

  expect(screen.queryByRole('region', { name: 'Item adicionado' })).not.toBeInTheDocument()
  const cart = screen.getByRole('dialog', { name: 'Carrinho' })
  expect(cart).toHaveTextContent('Smash da casa')
  expect(cart).toHaveTextContent('R$ 28,00')
})

it('fits the item name on one line and does not head the cart with the customer name', async () => {
  signInAs(customerProfile)
  const user = userEvent.setup()
  renderMenu()
  await screen.findByRole('heading', { name: 'Ana' })

  await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
  const detail = screen.getByRole('dialog', { name: 'Smash da casa' })
  await user.click(within(detail).getByRole('checkbox', { name: /Cheddar/ }))
  await user.click(within(detail).getByRole('button', { name: 'Adicionar' }))
  await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))

  const cart = screen.getByRole('dialog', { name: 'Carrinho' })
  expect(within(cart).queryByRole('heading', { name: 'Ana' })).not.toBeInTheDocument()
  expect(within(cart).queryByRole('heading', { name: 'Ana Souza' })).not.toBeInTheDocument()
  expect(within(cart).getByRole('heading', { name: 'Carrinho' })).toBeInTheDocument()

  const name = within(cart).getByText('Smash da casa + Cheddar')
  const nameStyle = getComputedStyle(name)
  expect(nameStyle.whiteSpace).toBe('nowrap')
  expect(nameStyle.overflow).toBe('hidden')
  expect(nameStyle.textOverflow).toBe('ellipsis')
  expect(getComputedStyle(name.parentElement as HTMLElement).minWidth).toBe('0px')

  const close = within(cart).getByRole('button', { name: 'Fechar' })
  expect(close).toHaveClass('mark-btn')
  expect(close).not.toHaveTextContent('Fechar')
  expect(close.querySelector('svg')).toBeInTheDocument()
  const closeStyle = getComputedStyle(close)
  expect(closeStyle.borderRadius).toBe('50%')
  expect(closeStyle.borderColor).toBe('rgb(227, 177, 90)')
  expect(closeStyle.color).toBe('rgb(244, 245, 246)')

  const remove = within(cart).getByRole('button', { name: 'Remover' })
  expect(remove).toHaveClass('mark-btn')
  expect(remove).not.toHaveTextContent('Remover')
  expect(remove.querySelector('svg')).toBeInTheDocument()
  expect(remove.querySelectorAll('svg path')).toHaveLength(3)
  expect(remove.querySelector('svg path[d*="M7 7l10 10"]')).toBeNull()
  expect(getComputedStyle(remove).borderRadius).toBe('50%')
  expect(getComputedStyle(remove).borderColor).toBe('rgb(227, 177, 90)')
  expect(getComputedStyle(remove).color).toBe('rgb(244, 245, 246)')
  expect(getComputedStyle(remove).width).toBe('34px')
  expect(getComputedStyle(remove).height).toBe('34px')

  const total = cart.querySelector('.cart__line-total') as HTMLElement
  expect(total).toHaveTextContent('R$ 32,00')
  expect(getComputedStyle(total).whiteSpace).toBe('nowrap')
  expect(getComputedStyle(total.parentElement as HTMLElement).flexGrow).toBe('0')
  expect(within(cart).getByText('1 × R$ 32,00')).toBeInTheDocument()
  expect(remove).toBeInTheDocument()
  expect(within(cart).getByTestId('cart-total')).toBeInTheDocument()
  expect(within(cart).getByRole('group', { name: 'Forma de pagamento' })).toBeInTheDocument()
})

it('hides the sample cardápio until Firestore answers, then follows edits', async () => {
  render(
    <AuthProvider>
      <MemoryRouter>
        <MenuScreen />
      </MemoryRouter>
    </AuthProvider>,
  )
  const loading = screen.getByRole('status', { name: 'Carregando o cardápio.' })
  expect(loading).toHaveClass('menu-loading')
  expect(loading.querySelector('.menu-loading__spin')).not.toBeNull()
  expect(getComputedStyle(loading.querySelector('.menu-loading__spin') as HTMLElement).animationName).toBe('board-spin')
  expect(getComputedStyle(loading.querySelector('.menu-loading__spin') as HTMLElement).borderTopColor).toBe(
    'rgb(227, 177, 90)',
  )
  expect(screen.queryByRole('button', { name: 'Início' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Acompanhamentos' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Bebidas' })).not.toBeInTheDocument()
  expect(screen.queryByText('Smash da casa')).not.toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()

  await act(async () => {
    emit('categories', [{ id: 'petisco', name: 'Petisco', order: 1, destaque: false }])
    emit('products', [{ id: 'batata', categoryId: 'petisco', name: 'Batata', description: '', price: 10, available: true, image: '' }])
  })
  expect(screen.queryByRole('status', { name: 'Carregando o cardápio.' })).not.toBeInTheDocument()
  const chips = within(screen.getByRole('toolbar', { name: 'Categorias' })).getAllByRole('button')
  expect(chips[0]).toHaveTextContent('Início')
  expect(chips[0]).not.toHaveClass('chip--destaque')
  expect(screen.getByRole('button', { name: 'Petisco' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Batata/ })).toHaveTextContent('R$ 10,00')

  await act(async () => {
    emit('categories', [{ id: 'petisco', name: 'Porções', order: 1, destaque: true }])
    emit('products', [
      { id: 'batata', categoryId: 'petisco', name: 'Batata grande', description: '', price: 12, available: true, image: '' },
      { id: 'anel', categoryId: 'petisco', name: 'Anel', description: '', price: 8, available: true, image: '' },
    ])
  })
  expect(screen.getByRole('button', { name: 'Porções' })).toHaveClass('chip--destaque')
  expect(screen.queryByRole('button', { name: 'Petisco' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Batata grande/ })).toHaveTextContent('R$ 12,00')
  expect(screen.getByRole('button', { name: /Anel/ })).toBeInTheDocument()

  await act(async () => {
    emit('products', [{ id: 'anel', categoryId: 'petisco', name: 'Anel', description: '', price: 8, available: true, image: '' }])
  })
  expect(screen.queryByRole('button', { name: /Batata grande/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Anel/ })).toBeInTheDocument()
})

it('keeps the griddle behind a readable bar', () => {
  render(
    <>
      <Griddle />
      <AuthProvider>
        <MemoryRouter>
          <MenuScreen />
        </MemoryRouter>
      </AuthProvider>
    </>,
  )
  act(() => {
    emitSeedCatalog()
  })

  const griddle = screen.getByTestId('griddle')
  expect(griddle).toHaveAttribute('aria-hidden', 'true')
  const nightStyle = getComputedStyle(griddle)
  expect(nightStyle.position).toBe('fixed')
  expect(nightStyle.pointerEvents).toBe('none')
  expect(getComputedStyle(document.querySelector('.menu') as HTMLElement).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  expect(document.querySelector('.grill__flame, .grill__grate, .grill__ember, .menu__night')).toBeNull()

  const dock = screen.getByRole('navigation', { name: 'Atalhos' })
  const dockStyle = getComputedStyle(dock)
  expect(dockStyle.backgroundColor).toBe('rgb(20, 20, 22)')
  expect(dockStyle.color).toBe('rgb(244, 245, 246)')
  expect(Number(dockStyle.zIndex)).toBeGreaterThan(Number(nightStyle.zIndex))

  const price = screen.getAllByText('R$ 28,00')[0]
  expect(getComputedStyle(price).color).toBe('rgb(227, 177, 90)')
  const name = screen.getByText('Smash da casa')
  expect(getComputedStyle(name).color).toBe('rgb(244, 245, 246)')
})

it('uses a flush bottom bar with small labels and marks the active shortcut in gold', async () => {
  const user = userEvent.setup()
  renderMenu()

  const dock = screen.getByRole('navigation', { name: 'Atalhos' })
  expect(dock.querySelectorAll('.dock__item')).toHaveLength(4)
  expect(dock.querySelector('.is-active')).toBeNull()

  const style = getComputedStyle(dock)
  expect(style.position).toBe('fixed')
  expect(style.borderRadius).toBe('18px 18px 0px 0px')
  expect(style.backgroundColor).toBe('rgb(20, 20, 22)')

  const labels = Array.from(dock.querySelectorAll('.dock__label')).map((label) => label.textContent)
  expect(labels).toEqual(['Histórico', 'WhatsApp', 'R$ 0,00', 'Conta'])
  expect(dock.querySelector('.dock__count')).toHaveClass('is-zero')

  const whatsapp = screen.getByRole('button', { name: 'WhatsApp' })
  const mark = whatsapp.querySelector('svg')
  expect(mark).toHaveAttribute('data-icon', 'whatsapp')
  expect(mark?.querySelector('path')).toHaveAttribute('fill', 'currentColor')
  expect(getComputedStyle(whatsapp).color).toBe('rgb(244, 245, 246)')

  await user.click(screen.getByRole('button', { name: 'Conta' }))
  const active = dock.querySelector('.dock__item.is-active') as HTMLElement
  expect(active).toHaveAttribute('aria-label', 'Conta')
  expect(getComputedStyle(active).color).toBe('rgb(227, 177, 90)')
  expect(active).toHaveAttribute('aria-current', 'true')
  expect(getComputedStyle(dock.querySelector('.dock__pill') as HTMLElement).backgroundColor).toBe('rgba(227, 177, 90, 0.14)')
  expect(getComputedStyle(active.querySelector('.dock__label') as HTMLElement).color).toBe('rgb(227, 177, 90)')
})

it('hides the hamburger and shows history with short dividers on the customer bar', () => {
  renderMenu()
  expect(screen.queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument()
  expect(document.querySelector('.menu__burger')).toBeNull()

  const dock = screen.getByRole('navigation', { name: 'Atalhos' })
  const history = screen.getByRole('button', { name: /^(Meus pedidos|Histórico)/ })
  expect(history.closest('nav')).toBe(dock)
  expect(history.querySelector('circle')).toBeNull()
  expect(history.querySelector('svg')).not.toBeNull()
  expect(dock.querySelector('.dock__count')).toHaveTextContent('0')
  expect(dock.querySelector('.dock__sum')).toHaveTextContent('R$ 0,00')
  const whatsapp = screen.getByRole('button', { name: 'WhatsApp' })
  expect(whatsapp.querySelector('svg')).toHaveAttribute('data-icon', 'whatsapp')

  const items = Array.from(dock.querySelectorAll('.dock__item')) as HTMLElement[]
  const cart = screen.getByRole('button', { name: /^Carrinho,/ })
  expect(cart.querySelector('.dock__count')).not.toBeNull()
  expect(cart.querySelector('.dock__sum')).not.toBeNull()
  for (const item of items) {
    const style = getComputedStyle(item)
    expect(style.justifyContent).toBe('center')
    expect(style.alignItems).toBe('center')
    expect(Number(style.flexGrow)).toBeGreaterThan(0)
  }
  const rules = Array.from(dock.querySelectorAll('.dock__rule')) as HTMLElement[]
  expect(items).toHaveLength(4)
  expect(rules).toHaveLength(items.length - 1)

  const itemHeight = parseFloat(getComputedStyle(items[0]).height)
  const paddingTop = parseFloat(getComputedStyle(dock).paddingTop)
  const paddingBottom = parseFloat(getComputedStyle(dock).paddingBottom)
  expect(paddingTop).toBeGreaterThan(0)
  expect(paddingBottom).toBeGreaterThan(0)

  for (const rule of rules) {
    const style = getComputedStyle(rule)
    const height = parseFloat(style.height)
    expect(rule.previousElementSibling).toHaveClass('dock__item')
    expect(rule.nextElementSibling).toHaveClass('dock__item')
    expect(style.alignSelf).toBe('center')
    expect(height).toBe(18)
    expect(height).toBeLessThan(itemHeight)
  }
})

it('lists products vertically with photo, name, price, a short description and an add mark', () => {
  renderMenu()
  const items = Array.from(document.querySelectorAll('.items .item')) as HTMLElement[]
  expect(items.length).toBeGreaterThan(1)
  expect(getComputedStyle(document.querySelector('.items') as HTMLElement).display).toBe('grid')
  for (const item of items) {
    expect(item.firstElementChild?.tagName).toBe('IMG')
    expect(item.querySelector('.item__copy .item__name')).not.toBeNull()
    expect(item.querySelector('.item__copy .item__price')).not.toBeNull()
  }
  const described = items.find((item) => item.querySelector('.item__desc')) as HTMLElement
  expect(described).toBeDefined()
  expect(getComputedStyle(described.querySelector('.item__desc') as HTMLElement).overflow).toBe('hidden')
  const add = items.find((item) => !item.classList.contains('item--sold'))?.querySelector('.item__add')
  expect(add).toHaveAttribute('aria-hidden', 'true')
})
