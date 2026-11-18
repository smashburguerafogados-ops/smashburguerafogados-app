import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { MenuScreen } from './components/MenuScreen'
import { Griddle } from './components/Griddle'
import { customerProfile, signInAs } from './test/render'
import './index.css'
import './menu.css'
import './griddle.css'

afterEach(() => {
  vi.useRealTimers()
})

function renderMenu() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <MenuScreen />
      </MemoryRouter>
    </AuthProvider>,
  )
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

it('shows every category by default and has no Geral chip', () => {
  renderMenu()
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
  expect(screen.getByRole('button', { name: /Smash da casa/ })).toBeInTheDocument()
})

it('restores the last category from the session', () => {
  sessionStorage.setItem('smash.category', 'sides')
  renderMenu()
  expect(screen.getByRole('button', { name: /Batata rústica/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Smash da casa/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Acompanhamentos' })).toHaveAttribute('aria-pressed', 'true')
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

it('updates the product price live with quantity and add-ons', async () => {
  const user = userEvent.setup()
  renderMenu()

  await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
  const detail = screen.getByRole('dialog', { name: 'Smash da casa' })
  const price = () => within(detail).getByText(/^R\$ /)

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
  await user.click(screen.getByRole('button', { name: /carrinho/i }))

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
  await user.type(within(detail).getByRole('textbox', { name: 'Observação' }), 'sem cebola')
  await user.click(within(detail).getByRole('button', { name: 'Adicionar' }))

  const dock = screen.getByRole('navigation', { name: 'Atalhos' })
  expect(dock.querySelector('.dock__count')).toHaveTextContent('1')
  expect(dock.querySelector('.dock__sum')).toHaveTextContent('R$ 28,00')
  expect(dock.querySelector('.dock__label')).toBeNull()

  await user.click(screen.getByRole('button', { name: /carrinho/i }))
  const cart = screen.getByRole('dialog', { name: 'Carrinho' })
  expect(cart).toHaveTextContent('sem cebola')
  expect(cart).toHaveTextContent('Smash da casa')
  expect(cart).toHaveTextContent('R$ 28,00')
  expect(dock.querySelector('.dock__label')).toBeNull()
  expect(dock.querySelector('.dock__item.is-active')).not.toBeNull()
})

it('shows a thin toast when a product is added and clears it after 3 seconds', async () => {
  vi.useFakeTimers()
  renderMenu()

  fireEvent.click(screen.getByRole('button', { name: /Smash da casa/ }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Smash da casa' })).getByRole('button', { name: 'Adicionar' }))

  const toast = screen.getByRole('status')
  expect(toast).toHaveTextContent('Adicionado: Smash da casa')
  expect(toast).toHaveClass('toast')
  expect(toast.closest('[role="dialog"]')).toBeNull()
  expect(getComputedStyle(toast).pointerEvents).toBe('none')

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2999)
  })
  expect(screen.getByRole('status')).toHaveTextContent('Adicionado: Smash da casa')

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
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
  await user.click(screen.getByRole('button', { name: /carrinho/i }))

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
  expect(getComputedStyle(remove).borderRadius).toBe('50%')

  const total = cart.querySelector('.cart__line-total') as HTMLElement
  expect(total).toHaveTextContent('R$ 32,00')
  expect(getComputedStyle(total).whiteSpace).toBe('nowrap')
  expect(getComputedStyle(total.parentElement as HTMLElement).flexGrow).toBe('0')
  expect(within(cart).getByText('1 × R$ 32,00')).toBeInTheDocument()
  expect(remove).toBeInTheDocument()
  expect(within(cart).getByTestId('cart-total')).toBeInTheDocument()
  expect(within(cart).getByRole('group', { name: 'Forma de pagamento' })).toBeInTheDocument()
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

it('uses a floating gold pill for the active shortcut and icons otherwise', async () => {
  const user = userEvent.setup()
  renderMenu()

  const dock = screen.getByRole('navigation', { name: 'Atalhos' })
  expect(dock.querySelectorAll('.dock__item')).toHaveLength(4)
  expect(dock.querySelector('.is-active')).toBeNull()

  const style = getComputedStyle(dock)
  expect(style.position).toBe('fixed')
  expect(style.borderRadius).toBe('999px')
  expect(style.backgroundColor).toBe('rgb(20, 20, 22)')

  const whatsapp = screen.getByRole('button', { name: 'WhatsApp' })
  expect(whatsapp.querySelector('.dock__label')).toBeNull()
  const mark = whatsapp.querySelector('svg')
  expect(mark).toHaveAttribute('data-icon', 'whatsapp')
  expect(mark?.querySelector('path')).toHaveAttribute('fill', 'currentColor')
  expect(getComputedStyle(whatsapp).color).toBe('rgb(244, 245, 246)')

  await user.click(screen.getByRole('button', { name: 'Conta' }))
  const active = dock.querySelector('.dock__item.is-active') as HTMLElement
  expect(active).toHaveAttribute('aria-label', 'Conta')
  expect(active.querySelector('.dock__label')).toBeNull()
  expect(active.textContent?.trim()).toBe('')
  expect(getComputedStyle(active).backgroundColor).toBe('rgb(227, 177, 90)')
  expect(dock.querySelectorAll('.dock__label')).toHaveLength(0)
  for (const button of dock.querySelectorAll('.dock__item')) {
    expect(button.querySelector('.dock__label')).toBeNull()
  }
})

it('hides the hamburger and shows history with short dividers on the customer bar', () => {
  renderMenu()
  expect(screen.queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument()
  expect(document.querySelector('.menu__burger')).toBeNull()

  const dock = screen.getByRole('navigation', { name: 'Atalhos' })
  const history = screen.getByRole('button', { name: 'Meus pedidos' })
  expect(history.closest('nav')).toBe(dock)
  expect(history.querySelector('circle')).toBeNull()
  expect(history.querySelector('svg')).not.toBeNull()
  expect(dock.querySelector('.dock__count')).toHaveTextContent('0')
  expect(dock.querySelector('.dock__sum')).toHaveTextContent('R$ 0,00')
  const whatsapp = screen.getByRole('button', { name: 'WhatsApp' })
  expect(whatsapp.querySelector('svg')).toHaveAttribute('data-icon', 'whatsapp')

  const items = Array.from(dock.querySelectorAll('.dock__item')) as HTMLElement[]
  const cart = screen.getByRole('button', { name: /Carrinho/ })
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
