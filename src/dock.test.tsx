import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { MenuScreen } from './components/MenuScreen'
import { stepDock } from './lib/dockScroll'
import { emitSeedCatalog } from './test/render'
import './index.css'
import './menu.css'

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

function setWindowScroll(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true })
  window.dispatchEvent(new Event('scroll'))
}

async function flushScroll() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
  })
}

it('hides the bar after a downward step and shows it again on the way up', () => {
  expect(stepDock(false, 0, 0)).toEqual({ hidden: false, anchor: 0 })
  expect(stepDock(false, 0, 8)).toEqual({ hidden: false, anchor: 0 })
  expect(stepDock(false, 0, 40)).toEqual({ hidden: true, anchor: 40 })
  expect(stepDock(true, 40, 48)).toEqual({ hidden: true, anchor: 40 })
  expect(stepDock(true, 40, 20)).toEqual({ hidden: false, anchor: 20 })
  expect(stepDock(true, 200, 0)).toEqual({ hidden: false, anchor: 0 })
})

it('slides the bar away when the page scrolls down and brings it back when scrolling up', async () => {
  renderMenu()
  const dock = screen.getByRole('navigation', { name: 'Atalhos' })
  expect(dock).not.toHaveClass('is-away')
  expect(getComputedStyle(dock).transitionProperty).toContain('transform')

  setWindowScroll(0)
  setWindowScroll(80)
  await flushScroll()
  expect(dock).toHaveClass('is-away')
  expect(getComputedStyle(dock).opacity).toBe('0')
  expect(getComputedStyle(dock).pointerEvents).toBe('none')
  expect(getComputedStyle(dock).transform).toContain('48')

  setWindowScroll(40)
  await flushScroll()
  expect(dock).not.toHaveClass('is-away')
  expect(getComputedStyle(dock).pointerEvents).not.toBe('none')
})

it('hides the bar when the cart sheet scrolls down', async () => {
  const user = userEvent.setup()
  renderMenu()
  await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
  const panel = document.querySelector('.sheet__panel') as HTMLElement
  panel.scrollTop = 0
  panel.dispatchEvent(new Event('scroll'))
  Object.defineProperty(panel, 'scrollTop', { value: 90, configurable: true })
  panel.dispatchEvent(new Event('scroll'))
  await flushScroll()
  expect(screen.getByRole('navigation', { name: 'Atalhos' })).toHaveClass('is-away')
  Object.defineProperty(panel, 'scrollTop', { value: 40, configurable: true })
  panel.dispatchEvent(new Event('scroll'))
  await flushScroll()
  expect(screen.getByRole('navigation', { name: 'Atalhos' })).not.toHaveClass('is-away')
})

it('leaves room under the address, product, cart and account buttons', async () => {
  const user = userEvent.setup()
  renderMenu()

  await user.click(screen.getByRole('button', { name: 'Conta' }))
  const address = screen.getByRole('dialog', { name: 'Dados para entrega' })
  const addressSpacer = address.querySelector('.dock-spacer') as HTMLElement
  expect(parseFloat(getComputedStyle(addressSpacer).height)).toBe(108)
  expect(getComputedStyle(addressSpacer).boxSizing).toBe('content-box')
  const save = within(address).getByRole('button', { name: 'Salvar e pedir' })
  expect(save.compareDocumentPosition(addressSpacer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  await user.click(within(address).getByRole('button', { name: 'Fechar' }))

  await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
  const product = screen.getByRole('dialog', { name: 'Smash da casa' })
  const add = within(product).getByRole('button', { name: 'Adicionar' })
  const productSpacer = product.querySelector('.dock-spacer') as HTMLElement
  expect(parseFloat(getComputedStyle(productSpacer).height)).toBe(108)
  expect(add.compareDocumentPosition(productSpacer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  await user.click(within(product).getByRole('button', { name: 'Fechar' }))

  await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
  const cart = screen.getByRole('dialog', { name: 'Carrinho' })
  expect(cart.querySelector('.dock-spacer')).toBeTruthy()
  expect(parseFloat(getComputedStyle(cart.querySelector('.dock-spacer') as HTMLElement).height)).toBe(108)
})
