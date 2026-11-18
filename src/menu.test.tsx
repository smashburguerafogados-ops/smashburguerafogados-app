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
  expect(dock.querySelectorAll('.dock__item')).toHaveLength(3)
  expect(dock.querySelector('.is-active')).toBeNull()

  const style = getComputedStyle(dock)
  expect(style.position).toBe('fixed')
  expect(style.borderRadius).toBe('999px')
  expect(style.backgroundColor).toBe('rgb(20, 20, 22)')

  const whatsapp = screen.getByRole('button', { name: 'WhatsApp' })
  expect(whatsapp.querySelector('.dock__label')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Conta' }))
  const active = dock.querySelector('.dock__item.is-active') as HTMLElement
  expect(active.querySelector('.dock__label')).toHaveTextContent('Conta')
  expect(getComputedStyle(active).backgroundColor).toBe('rgb(227, 177, 90)')
  expect(dock.querySelectorAll('.dock__label')).toHaveLength(1)
})
