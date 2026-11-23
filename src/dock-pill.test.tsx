import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { MenuScreen } from './components/MenuScreen'
import { emitSeedCatalog } from './test/render'
import './index.css'
import './menu.css'
import menuCss from './menu.css?raw'

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

const dockEl = () => screen.getByRole('navigation', { name: 'Atalhos' })
const pill = () => dockEl().querySelector('.dock__pill') as HTMLElement

const names = [/^(Meus pedidos|Histórico)/, 'WhatsApp', /^Carrinho,/, 'Conta']

it('keeps one hidden decorative pill inside the bar while nothing is selected', () => {
  renderMenu()
  expect(dockEl().querySelectorAll('.dock__pill')).toHaveLength(1)
  expect(pill()).toHaveAttribute('aria-hidden', 'true')
  expect(pill()).not.toHaveClass('is-visible')
  expect(getComputedStyle(pill()).opacity).toBe('0')
  expect(dockEl().querySelector('[aria-current]')).toBeNull()
  expect(dockEl().querySelectorAll('.dock__item')).toHaveLength(4)
})

it('moves the pill and aria-current to each of the four items', async () => {
  const user = userEvent.setup()
  renderMenu()
  for (let i = 0; i < names.length; i++) {
    await user.click(screen.getByRole('button', { name: names[i] }))
    const current = dockEl().querySelectorAll('[aria-current]')
    expect(current).toHaveLength(1)
    expect(current[0]).toBe(dockEl().querySelectorAll('.dock__item')[i])
    expect(pill()).toHaveClass('is-visible')
    expect(pill().style.getPropertyValue('--dock-index')).toBe(String(i))
    expect(getComputedStyle(pill()).opacity).toBe('1')
  }
})

it('slides between items without hiding the pill in between', async () => {
  const user = userEvent.setup()
  renderMenu()
  await user.click(screen.getByRole('button', { name: /^(Meus pedidos|Histórico)/ }))
  expect(pill()).toHaveClass('is-entering')
  await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
  expect(pill()).not.toHaveClass('is-entering')
  expect(pill()).toHaveClass('is-visible')
  expect(pill().style.getPropertyValue('--dock-index')).toBe('2')
  const duration = parseFloat(getComputedStyle(pill()).transitionDuration.split(',')[0])
  expect(getComputedStyle(pill()).transitionProperty).toContain('transform')
  expect(duration).toBeGreaterThanOrEqual(0.3)
  expect(duration).toBeLessThanOrEqual(0.45)
})

it('fades out when the sheet closes and slides in from there on the next selection', async () => {
  const user = userEvent.setup()
  renderMenu()
  await user.click(screen.getByRole('button', { name: 'Conta' }))
  expect(pill().style.getPropertyValue('--dock-index')).toBe('3')
  await user.click(screen.getByRole('button', { name: 'Fechar' }))
  expect(pill()).not.toHaveClass('is-visible')
  expect(pill().style.getPropertyValue('--dock-index')).toBe('3')
  await user.click(screen.getByRole('button', { name: /^(Meus pedidos|Histórico)/ }))
  expect(pill()).toHaveClass('is-visible')
  expect(pill()).not.toHaveClass('is-entering')
  expect(pill().style.getPropertyValue('--dock-index')).toBe('0')
})

it('does not react to hover and is not part of the layout', async () => {
  const user = userEvent.setup()
  renderMenu()
  await user.click(screen.getByRole('button', { name: 'Conta' }))
  await user.hover(screen.getByRole('button', { name: 'WhatsApp' }))
  expect(pill().style.getPropertyValue('--dock-index')).toBe('3')
  expect(getComputedStyle(pill()).position).toBe('absolute')
  expect(getComputedStyle(pill()).pointerEvents).toBe('none')
  expect(menuCss).not.toMatch(/\.dock__item:hover/)
})

it('turns the transition off for reduced motion and keeps focus visible', () => {
  expect(menuCss).toMatch(
    /prefers-reduced-motion: reduce\) \{\s*\.dock__pill,\s*\.dock__pill\.is-entering \{\s*transition: none;/,
  )
  expect(menuCss).toMatch(/\.dock__item:focus-visible \{[^}]*outline: 2px solid/)
  expect(menuCss).toMatch(/\.dock__item \{[^}]*height: 54px/)
})
