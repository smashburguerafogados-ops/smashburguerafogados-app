import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { MenuScreen } from './components/MenuScreen'
import { Griddle } from './components/Griddle'
import './index.css'
import './menu.css'
import './griddle.css'

function renderMenu() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <MenuScreen />
      </MemoryRouter>
    </AuthProvider>,
  )
}

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
  await user.click(within(detail).getByRole('button', { name: 'Fechar' }))

  await user.click(screen.getByRole('button', { name: /Smash picante/ }))
  const sold = screen.getByRole('dialog', { name: 'Smash picante' })
  expect(sold).toHaveTextContent('Esgotado')
  const add = within(sold).getByRole('button', { name: 'Adicionar' })
  expect(add).toBeDisabled()
  await user.click(add)
  expect(screen.getByRole('navigation', { name: 'Atalhos' }).querySelector('.dock__count')).toHaveTextContent('0')
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
  expect(dock.querySelector('.dock__item.is-active .dock__label')).toHaveTextContent('Carrinho')
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
  expect(active.querySelector('.dock__label')).toHaveTextContent('Conta')
  expect(getComputedStyle(active).backgroundColor).toBe('rgb(227, 177, 90)')
  expect(dock.querySelectorAll('.dock__label')).toHaveLength(1)
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
