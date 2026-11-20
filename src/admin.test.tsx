import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Griddle } from './components/Griddle'
import { activeListeners, emit, firebaseMocks } from './test/mocks'
import { adminProfile, makeOrder, Providers, renderApp, signInAs } from './test/render'
import { AdminRoute } from './components/AdminRoute'
import { Route, Routes } from 'react-router-dom'
import './index.css'
import './menu.css'
import './griddle.css'

const novo = makeOrder({ id: 'pedido-00001', status: 'novo' })
const andamento = makeOrder({ id: 'pedido-00002', status: 'andamento', customerName: 'Bruno Lima' })
const enviado = makeOrder({ id: 'pedido-00003', status: 'enviado', customerName: 'Carla Dias' })
const finalizado = makeOrder({ id: 'pedido-00004', status: 'finalizado', customerName: 'Davi Reis' })

async function openBoard() {
  signInAs(adminProfile)
  renderApp('/admin')
  await screen.findByRole('heading', { name: 'Painel' })
  await waitFor(() => expect(activeListeners('orders')).toHaveLength(1))
  await act(async () => {
    emit('orders', [novo, andamento, enviado, finalizado])
  })
}

function listNames(): string[] {
  return Array.from(document.querySelectorAll('.board__list .order-card__name')).map((node) => node.textContent ?? '')
}

function lastWhatsapp(): { number: string; text: string } {
  const calls = vi.mocked(window.open).mock.calls
  const url = String(calls[calls.length - 1][0])
  const match = url.match(/^https:\/\/wa\.me\/(\d+)\?text=(.*)$/)
  if (!match) throw new Error(`not a wa.me link: ${url}`)
  return { number: match[1], text: decodeURIComponent(match[2]) }
}

function lastUpdate(): { path: string; patch: Record<string, unknown> } {
  const calls = firebaseMocks.updateDoc.mock.calls
  const [ref, patch] = calls[calls.length - 1] as [{ path: string }, Record<string, unknown>]
  return { path: ref.path, patch }
}

describe('admin board', () => {
  it('finds orders by customer name, WhatsApp number, or order number', async () => {
    signInAs(adminProfile)
    const user = userEvent.setup()
    renderApp('/admin')
    await screen.findByRole('heading', { name: 'Painel' })
    await waitFor(() => expect(activeListeners('orders')).toHaveLength(1))
    await act(async () => {
      emit('orders', [
        novo,
        { ...andamento, customerWhatsapp: '5511912345678' },
        enviado,
        { ...finalizado, id: 'pedido-ab7k9' },
      ])
    })
    const search = screen.getByRole('searchbox', { name: 'Buscar pedido' })
    expect(listNames()).toEqual(['Ana Souza'])

    await user.type(search, 'bruno')
    expect(listNames()).toEqual(['Bruno Lima'])
    const found = screen.getByRole('button', { name: /Bruno Lima/ })
    expect(found).toHaveTextContent('2× Smash da casa')
    expect(found).not.toHaveTextContent('#00002')
    expect(found).not.toHaveTextContent('Aceito, em preparo')

    await user.clear(search)
    await user.type(search, '(11) 91234')
    expect(listNames()).toEqual(['Bruno Lima'])

    await user.clear(search)
    await user.type(search, '#AB7K9')
    expect(listNames()).toEqual(['Davi Reis'])

    await user.clear(search)
    await user.type(search, 'clã')
    expect(screen.getByText('Nenhum pedido encontrado.')).toBeInTheDocument()

    await user.clear(search)
    expect(listNames()).toEqual(['Ana Souza'])
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('shows the hamburger only on the admin screen', async () => {
    await openBoard()
    const burger = screen.getByRole('button', { name: 'Abrir menu' })
    expect(burger.querySelectorAll('path')[0]?.getAttribute('d')).toContain('M4 7h16')
    expect(document.querySelector('.menu__burger')).toBe(burger)
  })

  it('reads the whole orders collection for the admin', async () => {
    await openBoard()
    const [listener] = activeListeners('orders')
    expect(listener.ref.path).toBe('orders')
    expect(listener.ref.constraints ?? []).toEqual([])
  })

  it('is a plain black screen without the logo, griddle, or cardápio header', async () => {
    signInAs(adminProfile)
    render(
      <Providers path="/admin">
        <Griddle />
        <Routes>
          <Route path="/admin" element={<AdminRoute />} />
        </Routes>
      </Providers>,
    )
    await screen.findByRole('heading', { name: 'Painel' })
    const admin = document.querySelector('.admin') as HTMLElement
    const style = getComputedStyle(admin)
    expect(style.backgroundColor).toBe('rgb(0, 0, 0)')
    expect(Number(style.zIndex)).toBeGreaterThan(Number(getComputedStyle(screen.getByTestId('griddle')).zIndex))
    expect(admin.querySelector('img, video, .griddle, .griddle__glow, .menu__top, .topbar__brand')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Smash Burger' })).not.toBeInTheDocument()
    expect(document.querySelector('.menu__title')).toBeNull()
  })

  it('fits Novos, Em Andamento and Finalizados inside a phone-width card', async () => {
    await openBoard()
    const main = document.querySelector('.admin__main') as HTMLElement
    const columns = document.querySelector('.board__columns') as HTMLElement
    const column = document.querySelector('.board__column') as HTMLElement
    const mainStyle = getComputedStyle(main)
    const columnsStyle = getComputedStyle(columns)
    const columnStyle = getComputedStyle(column)
    const phone = 320
    const board = phone - parseFloat(mainStyle.paddingLeft) - parseFloat(mainStyle.paddingRight)
    const gap = parseFloat(columnsStyle.columnGap)
    const content =
      (board - gap * 2) / 3 -
      parseFloat(columnStyle.paddingLeft) -
      parseFloat(columnStyle.paddingRight) -
      parseFloat(columnStyle.borderLeftWidth) -
      parseFloat(columnStyle.borderRightWidth)

    // Manrope 700 widths measured in Chrome, in em: Andamento 5.61, Finalizados 5.41.
    const widestWordEm = 5.61
    for (const name of ['Novos', 'Em Andamento', 'Finalizados']) {
      const tab = screen.getByRole('tab', { name: new RegExp(name) })
      const title = tab.querySelector('.board__title') as HTMLElement
      const style = getComputedStyle(title)
      expect(tab).toHaveStyle({ minWidth: '0px' })
      expect(style.fontFamily).toContain('Manrope')
      expect(style.whiteSpace).toBe('normal')
      expect(style.overflowWrap).toBe('normal')
      expect(style.wordBreak).toBe('normal')
      expect(style.overflow).not.toBe('hidden')
      expect(style.textOverflow).not.toBe('ellipsis')
      const fontPx = parseFloat(style.fontSize)
      expect(fontPx * widestWordEm).toBeLessThanOrEqual(content)
    }
    expect(content).toBeGreaterThan(60)
  })

  it('shows Novos, Em Andamento and Finalizados and filters when a column is clicked', async () => {
    const user = userEvent.setup()
    await openBoard()

    const novos = screen.getByRole('tab', { name: /Novos/ })
    const emAndamento = screen.getByRole('tab', { name: /Em Andamento/ })
    const finalizados = screen.getByRole('tab', { name: /Finalizados/ })
    expect(novos).toHaveTextContent('1')
    expect(emAndamento).toHaveTextContent('2')
    expect(finalizados).toHaveTextContent('1')

    expect(novos).toHaveAttribute('aria-selected', 'true')
    expect(listNames()).toEqual(['Ana Souza'])

    await user.click(emAndamento)
    expect(listNames().sort()).toEqual(['Bruno Lima', 'Carla Dias'])

    await user.click(finalizados)
    expect(listNames()).toEqual(['Davi Reis'])
  })

  it('blinks the Novos title only when a new order arrives in realtime', async () => {
    const user = userEvent.setup()
    await openBoard()
    const title = () => screen.getByRole('tab', { name: /Novos/ }).querySelector('.board__title') as HTMLElement

    expect(title()).not.toHaveClass('is-blinking')

    await user.click(screen.getByRole('tab', { name: /Em Andamento/ }))
    await act(async () => {
      emit('orders', [makeOrder({ id: 'pedido-00009', status: 'novo', customerName: 'Elisa' }), novo, andamento])
    })
    expect(title()).toHaveClass('is-blinking')
    expect(getComputedStyle(title()).animationName).toBe('novos-blink')

    await act(async () => {
      emit('orders', [makeOrder({ id: 'pedido-00009', status: 'andamento' }), novo, andamento])
    })
    expect(title()).toHaveClass('is-blinking')

    await user.click(screen.getByRole('tab', { name: /Novos/ }))
    expect(title()).not.toHaveClass('is-blinking')
  })

  it('shows a spinner while orders load, then the list or the empty state', async () => {
    signInAs(adminProfile)
    renderApp('/admin')
    await screen.findByRole('heading', { name: 'Painel' })
    const loading = screen.getByRole('status')
    expect(loading).toHaveTextContent('Carregando pedidos.')
    expect(loading.querySelector('.board-loading__spin')).toBeTruthy()
    expect(getComputedStyle(loading.querySelector('.board-loading__spin') as HTMLElement).animationName).toBe('board-spin')
    expect(screen.queryByText('Nenhum pedido aqui.')).not.toBeInTheDocument()
    expect(document.querySelector('.order-card')).toBeNull()
    expect(document.querySelector('.admin')).not.toHaveAttribute('data-theme')

    await act(async () => {
      emit('orders', [])
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('Nenhum pedido aqui.')).toBeInTheDocument()
    expect(document.querySelector('.order-card')).toBeNull()

    await act(async () => {
      emit('orders', [novo])
    })
    expect(screen.queryByText('Carregando pedidos.')).not.toBeInTheDocument()
    expect(screen.queryByText('Nenhum pedido aqui.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ana Souza/ })).toHaveTextContent('2× Smash da casa')
  })

  it('shows the customer name and the items on the closed card', async () => {
    await openBoard()
    const card = screen.getByRole('button', { name: /Ana Souza/ })
    expect(card).toHaveTextContent('Ana Souza')
    expect(card).toHaveTextContent('2× Smash da casa')
    expect(card).not.toHaveTextContent('#00001')
    expect(card.querySelectorAll('.order-card__name, .order-card__mode, .order-card__order')).toHaveLength(3)
    expect(card).toHaveTextContent('Entrega')
    expect(card).not.toHaveTextContent('98888')
    expect(card).not.toHaveTextContent('R$')
    expect(card).not.toHaveTextContent('Recebido')
    expect(card).not.toHaveTextContent('sem cebola')
    const style = getComputedStyle(card)
    expect(style.display).toBe('grid')
    expect(parseFloat(style.paddingTop)).toBeLessThanOrEqual(12)
    expect(parseFloat(style.fontSize) * 2 + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)).toBeLessThan(80)
  })

  it('opens a popup with everything the customer entered', async () => {
    const user = userEvent.setup()
    await openBoard()
    const card = screen.getByRole('button', { name: /Ana Souza/ })
    expect(card).not.toHaveTextContent('Rua das Flores')
    await user.click(card)

    const dialog = screen.getByRole('dialog', { name: 'Pedido #00001' })
    expect(dialog).toHaveTextContent('Recebido')
    expect(dialog).toHaveTextContent('#00001')
    expect(dialog).toHaveTextContent('Ana Souza')
    expect(dialog).toHaveTextContent('+55 (87) 98888-7777')
    expect(dialog).toHaveTextContent('Entrega')
    expect(dialog).toHaveTextContent('Rua das Flores, 120')
    expect(dialog).toHaveTextContent('Centro - Petrolina - PE')
    expect(dialog).toHaveTextContent('Perto da praça')
    expect(dialog).toHaveTextContent('56300000')
    expect(dialog).toHaveTextContent('2× Smash da casa')
    expect(dialog).toHaveTextContent('Obs.: sem cebola')
    expect(dialog).toHaveTextContent('R$ 56,00')
    expect(dialog).toHaveTextContent('Dinheiro, troco para R$ 100,00 (troco R$ 44,00)')
  })

  it('shows pickup on the card and in the dialog without an address', async () => {
    const user = userEvent.setup()
    signInAs(adminProfile)
    renderApp('/admin')
    await screen.findByRole('heading', { name: 'Painel' })
    await waitFor(() => expect(activeListeners('orders')).toHaveLength(1))
    await act(async () => {
      emit('orders', [
        makeOrder({
          id: 'pedido-00011',
          status: 'novo',
          fulfillment: 'retirada',
          address: null,
          customerName: 'Bruno Lima',
        }),
      ])
    })
    const card = screen.getByRole('button', { name: /Bruno Lima/ })
    expect(card).toHaveTextContent('Retirada')
    expect(card).not.toHaveTextContent('Entrega')
    await user.click(card)
    const dialog = screen.getByRole('dialog', { name: 'Pedido #00011' })
    expect(dialog).toHaveTextContent('Retirada')
    expect(dialog).toHaveTextContent('Retirada no balcão')
    expect(dialog).not.toHaveTextContent('Rua das Flores')
  })

  it('Aceitar sends the accepted WhatsApp first, then moves the order to Em Andamento', async () => {
    const user = userEvent.setup()
    await openBoard()
    await user.click(screen.getByRole('button', { name: /Ana Souza/ }))
    await user.click(screen.getByRole('button', { name: 'Aceitar' }))

    const message = lastWhatsapp()
    expect(message.number).toBe('5587988887777')
    expect(message.text).toContain('\u2705')
    expect(message.text).toContain('Olá, Ana!')
    expect(message.text).toContain('foi aceito')
    expect(message.text).toContain('Smash Burger')
    expect(lastUpdate()).toEqual({ path: 'orders/pedido-00001', patch: { status: 'andamento', updatedAt: 'SERVER_TIME' } })
    const openedAt = vi.mocked(window.open).mock.invocationCallOrder[0]
    expect(openedAt).toBeLessThan(firebaseMocks.updateDoc.mock.invocationCallOrder[0])
  })

  it('Recusar requires a reason, sends it on WhatsApp and stores it on the order', async () => {
    const user = userEvent.setup()
    await openBoard()
    await user.click(screen.getByRole('button', { name: /Ana Souza/ }))
    await user.click(screen.getByRole('button', { name: 'Recusar' }))

    const send = screen.getByRole('button', { name: 'Enviar recusa' })
    expect(send).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Motivo da recusa' }), 'Fora da área de entrega')
    await user.click(send)

    const message = lastWhatsapp()
    expect(message.number).toBe('5587988887777')
    expect(message.text).toContain('\u274C')
    expect(message.text).toContain('Motivo: Fora da área de entrega')
    expect(lastUpdate()).toEqual({
      path: 'orders/pedido-00001',
      patch: { status: 'recusado', reason: 'Fora da área de entrega', updatedAt: 'SERVER_TIME' },
    })
  })

  it('Enviar pedido sends photo, product, Smash Burger, total, address and on the way', async () => {
    const user = userEvent.setup()
    await openBoard()
    await user.click(screen.getByRole('tab', { name: /Em Andamento/ }))
    await user.click(screen.getByRole('button', { name: /Bruno Lima/ }))
    expect(screen.queryByRole('button', { name: 'Aceitar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Enviar pedido' }))

    const { text } = lastWhatsapp()
    expect(text).toContain('\u{1F4F8} Foto: https://smashburguerafogados-ops.github.io/smashburguerafogados-app/menu/smash.svg')
    expect(text).toContain('2x Smash da casa')
    expect(text).toContain('Smash Burger')
    expect(text).toContain('Total: R$ 56,00')
    expect(text).toContain('Endereço: Rua das Flores, 120 | Centro - Petrolina - PE | Ref.: Perto da praça')
    expect(text).toContain('A entrega está a caminho!')
    expect(text).toContain('\u{1F6F5}')
    expect(lastUpdate().patch).toMatchObject({ status: 'enviado' })
  })

  it('links the product page as the photo when the product photo is stored inline', async () => {
    const user = userEvent.setup()
    signInAs(adminProfile)
    renderApp('/admin')
    await screen.findByRole('heading', { name: 'Painel' })
    await waitFor(() => expect(activeListeners('orders')).toHaveLength(1))
    const order = makeOrder({ id: 'pedido-00005', status: 'andamento' }) as Record<string, unknown>
    order.items = [{ productId: 'abc 1', name: 'X-Tudo', image: '', priceCents: 3000, qty: 1, note: '' }]
    await act(async () => {
      emit('orders', [order as never])
    })
    await user.click(screen.getByRole('tab', { name: /Em Andamento/ }))
    await user.click(screen.getByRole('button', { name: /Ana Souza/ }))
    await user.click(screen.getByRole('button', { name: 'Enviar pedido' }))
    expect(lastWhatsapp().text).toContain(`Foto: ${window.location.origin}/?produto=abc%201`)
  })

  it('Cancelar asks for a reason and sends it on WhatsApp', async () => {
    const user = userEvent.setup()
    await openBoard()
    await user.click(screen.getByRole('tab', { name: /Em Andamento/ }))
    await user.click(screen.getByRole('button', { name: /Bruno Lima/ }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    const send = screen.getByRole('button', { name: 'Enviar cancelamento' })
    expect(send).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Motivo do cancelamento' }), '   ')
    expect(send).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Motivo do cancelamento' }), 'Acabou o pão')
    await user.click(send)

    const message = lastWhatsapp()
    expect(message.text).toContain('foi cancelado')
    expect(message.text).toContain('Motivo: Acabou o pão')
    expect(lastUpdate().patch).toMatchObject({ status: 'cancelado', reason: 'Acabou o pão' })
  })

  it('lets the admin conclude an order that is out for delivery', async () => {
    const user = userEvent.setup()
    await openBoard()
    await user.click(screen.getByRole('tab', { name: /Em Andamento/ }))
    await user.click(screen.getByRole('button', { name: /Carla Dias/ }))
    const dialog = screen.getByRole('dialog', { name: 'Pedido #00003' })
    expect(within(dialog).queryByRole('button', { name: 'Enviar pedido' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }))
    expect(lastUpdate()).toEqual({ path: 'orders/pedido-00003', patch: { status: 'finalizado', updatedAt: 'SERVER_TIME' } })
    expect(window.open).not.toHaveBeenCalled()
    expect(firebaseMocks.setDoc).toHaveBeenCalledWith(
      { path: 'faturamento/pedido-00003' },
      expect.objectContaining({ orderId: 'pedido-00003', totalCents: 5600 }),
    )
  })

  it('adds to faturamento only when an order leaves em andamento', async () => {
    const user = userEvent.setup()
    await openBoard()
    await waitFor(() => expect(activeListeners('faturamento')).toHaveLength(1))

    await user.click(screen.getByRole('button', { name: /Ana Souza/ }))
    await user.click(screen.getByRole('button', { name: 'Aceitar' }))
    expect(firebaseMocks.setDoc).not.toHaveBeenCalled()

    await user.click(screen.getByRole('tab', { name: /Em Andamento/ }))
    await user.click(screen.getByRole('button', { name: /Bruno Lima/ }))
    await user.click(screen.getByRole('button', { name: 'Enviar pedido' }))
    expect(firebaseMocks.setDoc).not.toHaveBeenCalled()
  })

  it('opens Faturamento on Geral with the stored amounts', async () => {
    const user = userEvent.setup()
    await openBoard()
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    await user.click(screen.getByRole('button', { name: 'Faturamento' }))
    const sheet = screen.getByRole('dialog', { name: 'Faturamento' })
    expect(within(sheet).getByRole('tab', { name: 'Geral' })).toHaveAttribute('aria-selected', 'true')

    const now = Date.now()
    await act(async () => {
      emit('faturamento', [
        { id: 'pedido-00003', orderId: 'pedido-00003', totalCents: 5600, finalizedAtMs: now },
        { id: 'antigo', orderId: 'antigo', totalCents: 1000, finalizedAtMs: now - 40 * 24 * 60 * 60 * 1000 },
      ])
    })

    const rows = sheet.querySelectorAll('.revenue__list li')
    expect(rows[0]).toHaveTextContent('Dia')
    expect(rows[0]).toHaveTextContent('R$ 56,00')
    expect(rows[4]).toHaveTextContent('Total')
    expect(rows[4]).toHaveTextContent('R$ 66,00')
    await user.click(within(sheet).getByRole('tab', { name: 'Dia' }))
    expect(within(sheet).getByRole('tab', { name: 'Dia' })).toHaveAttribute('aria-selected', 'true')
    expect(sheet).toHaveTextContent('R$ 56,00')
    expect(sheet).not.toHaveTextContent('R$ 66,00')
  })
})
