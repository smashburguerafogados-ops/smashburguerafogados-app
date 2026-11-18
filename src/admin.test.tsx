import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { activeListeners, emit, firebaseMocks } from './test/mocks'
import { adminProfile, makeOrder, renderApp, signInAs } from './test/render'
import './index.css'
import './menu.css'

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

  it('opens a popup with everything the customer entered', async () => {
    const user = userEvent.setup()
    await openBoard()
    await user.click(screen.getByRole('button', { name: /Ana Souza/ }))

    const dialog = screen.getByRole('dialog', { name: 'Pedido #00001' })
    expect(dialog).toHaveTextContent('Ana Souza')
    expect(dialog).toHaveTextContent('+55 (87) 98888-7777')
    expect(dialog).toHaveTextContent('Rua das Flores, 120')
    expect(dialog).toHaveTextContent('Centro - Petrolina - PE')
    expect(dialog).toHaveTextContent('Perto da praça')
    expect(dialog).toHaveTextContent('56300000')
    expect(dialog).toHaveTextContent('2× Smash da casa')
    expect(dialog).toHaveTextContent('Obs.: sem cebola')
    expect(dialog).toHaveTextContent('R$ 56,00')
    expect(dialog).toHaveTextContent('Dinheiro, troco para R$ 100,00 (troco R$ 44,00)')
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
  })
})
