import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Overlay } from './components/Overlay'
import { isTextField, useKeyboardOpen } from './lib/keyboard'
import { renderApp } from './test/render'
import './index.css'
import './menu.css'

function Nested() {
  const [outer, setOuter] = useState(true)
  const [inner, setInner] = useState(false)
  return (
    <>
      <button type="button">Fora</button>
      {outer && (
        <Overlay label="Primeiro" onClose={() => setOuter(false)}>
          <button type="button" onClick={() => setInner(true)}>
            Abrir segundo
          </button>
          <input aria-label="Campo do primeiro" />
          {inner && (
            <Overlay label="Segundo" variant="popup" onClose={() => setInner(false)}>
              <input aria-label="Campo do segundo" />
              <button type="button">Último do segundo</button>
            </Overlay>
          )}
        </Overlay>
      )}
    </>
  )
}

describe('modal panels', () => {
  it('lock the page, take focus, keep Tab inside and give focus back, whichever panel opens', async () => {
    const user = userEvent.setup()
    renderApp()
    const open = screen.getByRole('button', { name: /^Carrinho,/ })
    await user.click(open)
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(cart).toHaveFocus()

    await user.tab()
    expect(cart.contains(document.activeElement)).toBe(true)
    await user.tab({ shift: true })
    await user.tab({ shift: true })
    expect(cart.contains(document.activeElement)).toBe(true)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Carrinho' })).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
    expect(open).toHaveFocus()
  })

  it('also lock product, account and history panels', async () => {
    const user = userEvent.setup()
    renderApp()
    for (const [open, name] of [
      [screen.getByRole('button', { name: /Smash da casa/ }), 'Smash da casa'],
      [screen.getByRole('button', { name: 'Conta' }), 'Dados para entrega'],
      [screen.getByRole('button', { name: /^(Meus pedidos|Histórico)/ }), 'Meus pedidos'],
    ] as const) {
      await user.click(open)
      const dialog = screen.getByRole('dialog', { name })
      expect(document.body.style.overflow, name).toBe('hidden')
      expect(dialog).toHaveFocus()
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog', { name })).not.toBeInTheDocument()
      expect(document.body.style.overflow, name).toBe('')
    }
  })

  it('answer ESC and Tab only in the top panel, and keep the page locked until the last one closes', async () => {
    const user = userEvent.setup()
    render(<Nested />)
    await user.click(screen.getByRole('button', { name: 'Abrir segundo' }))
    const second = screen.getByRole('dialog', { name: 'Segundo' })
    expect(second).toHaveFocus()

    await user.tab()
    await user.tab()
    await user.tab()
    expect(second.contains(document.activeElement)).toBe(true)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Segundo' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Primeiro' })).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Primeiro' })).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })

  it('treat a radio group as one stop, so Tab from the last group wraps instead of leaving', async () => {
    const user = userEvent.setup()
    render(
      <Overlay label="Opções" onClose={() => undefined}>
        <button type="button">Primeiro</button>
        <label>
          <input type="radio" name="forma" value="a" defaultChecked readOnly /> A
        </label>
        <label>
          <input type="radio" name="forma" value="b" readOnly /> B
        </label>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Opções' })
    screen.getByRole('radio', { name: 'A' }).focus()
    await user.tab()
    expect(within(dialog).getByRole('button', { name: 'Fechar' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(within(dialog).getByRole('radio', { name: 'A' })).toHaveFocus()
  })

  it('stop the scroll from chaining into the page behind', async () => {
    const css = (await import('./menu.css?raw')).default
    expect(css).toMatch(/\.sheet__panel,\s*\.popup__panel \{[^}]*overscroll-behavior: contain/)
    expect(css).toMatch(/\.sheet,\s*\.popup \{[^}]*overscroll-behavior: contain/)
  })

  it('reserve the bottom-bar spacer only for sheets', () => {
    render(
      <>
        <Overlay label="Folha" onClose={() => undefined}>
          <p>a</p>
        </Overlay>
        <Overlay label="Janela" variant="popup" onClose={() => undefined}>
          <p>b</p>
        </Overlay>
      </>,
    )
    expect(screen.getByRole('dialog', { name: 'Folha' }).querySelector('.dock-spacer')).not.toBeNull()
    expect(screen.getByRole('dialog', { name: 'Janela' }).querySelector('.dock-spacer')).toBeNull()
  })
})

describe('keyboard and the bottom bar', () => {
  function setTouch(coarse: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: coarse && query.includes('coarse'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  }

  it('knows which fields open the on-screen keyboard', () => {
    const text = document.createElement('input')
    const radio = Object.assign(document.createElement('input'), { type: 'radio' })
    const area = document.createElement('textarea')
    const readOnly = Object.assign(document.createElement('input'), { readOnly: true })
    expect([text, area].every(isTextField)).toBe(true)
    expect([radio, readOnly, document.createElement('button')].some(isTextField)).toBe(false)
  })

  it('hides the bar and scrolls the cash field into view while a touch keyboard is open', async () => {
    setTouch(true)
    const scroll = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
    const user = userEvent.setup()
    renderApp()
    const dock = screen.getByRole('navigation', { name: 'Atalhos' })
    await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Adicionar' }))
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    await user.click(within(cart).getByRole('radio', { name: 'Dinheiro' }))
    await user.click(within(cart).getByRole('radio', { name: 'Sim' }))
    expect(dock).not.toHaveClass('is-away')

    await user.click(within(cart).getByRole('textbox', { name: /Valor em dinheiro/ }))
    expect(dock).toHaveClass('is-away')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120))
    })
    expect(scroll).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' })

    await user.click(within(cart).getByRole('radio', { name: 'Não' }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    expect(dock).not.toHaveClass('is-away')
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
    setTouch(false)
  })

  it('keeps the bar on a mouse and keyboard desktop', async () => {
    setTouch(false)
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('searchbox'))
    expect(screen.getByRole('navigation', { name: 'Atalhos' })).not.toHaveClass('is-away')
  })

  it('reports an open keyboard when the visual viewport shrinks, even without a touch screen', async () => {
    setTouch(false)
    const user = userEvent.setup()
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: Object.assign(new EventTarget(), { height: 300 }),
    })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 })
    function Probe() {
      return <output aria-label="teclado">{String(useKeyboardOpen())}</output>
    }
    render(
      <>
        <input aria-label="Campo" />
        <Probe />
      </>,
    )
    expect(screen.getByLabelText('teclado')).toHaveTextContent('false')
    await user.click(screen.getByLabelText('Campo'))
    expect(screen.getByLabelText('teclado')).toHaveTextContent('true')
    Reflect.deleteProperty(window, 'visualViewport')
  })
})
