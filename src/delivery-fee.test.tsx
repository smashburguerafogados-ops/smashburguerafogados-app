import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { deliveryCharge, type Order } from './lib/orders'
import { sentMessage } from './lib/whatsapp'
import { activeListeners, emit, emitDoc, firebaseMocks } from './test/mocks'
import { adminProfile, customerProfile, makeOrder, renderApp, signInAs } from './test/render'
import './index.css'
import './menu.css'

async function openCart(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Adicionar' }))
  await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
  const cart = screen.getByRole('dialog', { name: 'Carrinho' })
  await waitFor(() => expect(activeListeners('settings/shop').length).toBeGreaterThan(0))
  return cart
}

function summary(cart: HTMLElement) {
  return within(cart).getByRole('group', { name: 'Resumo do pedido' })
}

describe('delivery fee', () => {
  it('charges nothing until the shop sets a fee, and never charges pickup', () => {
    expect(deliveryCharge('entrega', 0)).toBe(0)
    expect(deliveryCharge('entrega', Number.NaN)).toBe(0)
    expect(deliveryCharge('retirada', 500)).toBe(0)
    expect(deliveryCharge('entrega', 500)).toBe(500)
  })

  it('lets the admin save the fee on the shop settings, in the same money mask', async () => {
    signInAs(adminProfile)
    const user = userEvent.setup()
    renderApp('/admin')
    await user.click(await screen.findByRole('button', { name: 'Abrir menu' }))
    await user.click(screen.getByRole('button', { name: 'Gerenciamento' }))
    const screenBox = await screen.findByRole('dialog', { name: 'Gerenciamento' })
    await waitFor(() => expect(activeListeners('settings/shop')).toHaveLength(1))
    await act(async () => {
      emitDoc('settings/shop', { online: true, message: 'Aberto', hours: '18h' })
    })

    expect(getComputedStyle(screenBox).backgroundColor).toBe('rgb(0, 0, 0)')
    expect(getComputedStyle(screenBox).color).toBe('rgb(244, 245, 246)')
    const field = within(screenBox).getByRole('textbox', { name: 'Valor da entrega' })
    expect(field).toHaveValue('')
    expect(field.parentElement?.querySelector('.money-join__prefix')).toHaveTextContent('R$')
    expect(getComputedStyle(field.parentElement?.querySelector('.money-join__prefix') as HTMLElement).color).toBe(
      'rgb(227, 177, 90)',
    )
    const save = within(screenBox).getByRole('button', { name: 'Salvar valor da entrega' })
    expect(getComputedStyle(save).color).toBe('rgb(255, 255, 255)')
    expect(getComputedStyle(save).borderColor).toBe('rgb(227, 177, 90)')

    await user.type(field, '500')
    expect(field).toHaveValue('5,00')
    await user.click(save)
    expect(firebaseMocks.setDoc).toHaveBeenCalledWith(
      { path: 'settings/shop' },
      { deliveryFeeCents: 500 },
      { merge: true },
    )
    expect(await within(screenBox).findByText('Valor da entrega salvo.')).toBeInTheDocument()
    expect(within(screenBox).getByText('Valor atual: R$ 5,00')).toBeInTheDocument()
  })

  it('adds the fee to a delivery and shows it before the customer sends the order', async () => {
    signInAs(customerProfile)
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    const cart = await openCart(user)
    await waitFor(() => expect(activeListeners('settings/shop').length).toBeGreaterThanOrEqual(2))
    expect(summary(cart)).toHaveTextContent('Taxa de entrega')
    expect(summary(cart)).toHaveTextContent('R$ 0,00')
    expect(within(summary(cart)).getByTestId('cart-total')).toHaveTextContent('R$ 28,00')
    await act(async () => {
      emitDoc('settings/shop', { online: true, deliveryFeeCents: 500 })
    })

    const box = summary(cart)
    expect(box).toHaveTextContent('Subtotal')
    expect(box).toHaveTextContent('R$ 28,00')
    expect(box).toHaveTextContent('Taxa de entrega')
    expect(box).toHaveTextContent('R$ 5,00')
    expect(within(box).getByTestId('cart-total')).toHaveTextContent('R$ 33,00')

    await user.click(within(cart).getByRole('radio', { name: 'Pix' }))
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    const [, payload] = firebaseMocks.addDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(payload).toMatchObject({
      fulfillment: 'entrega',
      deliveryFeeCents: 500,
      totalCents: 3300,
    })

    await act(async () => {
      emitDoc('settings/shop', { online: true, deliveryFeeCents: 900 })
    })
    expect(firebaseMocks.addDoc).toHaveBeenCalledTimes(1)
    expect(firebaseMocks.updateDoc).not.toHaveBeenCalled()
    expect(payload).toMatchObject({ deliveryFeeCents: 500, totalCents: 3300 })
  })

  it('charges no fee on pickup and keeps the line visible at zero', async () => {
    signInAs(customerProfile)
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    const cart = await openCart(user)
    await act(async () => {
      emitDoc('settings/shop', { online: true, deliveryFeeCents: 500 })
    })
    expect(summary(cart)).toHaveTextContent('R$ 5,00')

    await user.click(within(cart).getByRole('radio', { name: 'Retirada' }))
    const box = summary(cart)
    expect(box).toHaveTextContent('Taxa de entrega')
    expect(box).toHaveTextContent('R$ 0,00')
    expect(within(box).getByTestId('cart-total')).toHaveTextContent('R$ 28,00')

    await user.click(within(cart).getByRole('radio', { name: 'Pix' }))
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    const [, payload] = firebaseMocks.addDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(payload).toMatchObject({ fulfillment: 'retirada', deliveryFeeCents: 0, totalCents: 2800, address: null })
  })

  it('shows the fee saved on the order in the customer history, not the fee saved later', async () => {
    signInAs(customerProfile)
    renderApp()
    await waitFor(() => expect(activeListeners('orders')).toHaveLength(1))
    await waitFor(() => expect(activeListeners('settings/shop').length).toBeGreaterThan(0))
    await act(async () => {
      emitDoc('settings/shop', { online: true, deliveryFeeCents: 900 })
      emit('orders', [makeOrder({ deliveryFeeCents: 500, totalCents: 6100 })])
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Meus pedidos' }))
    const card = screen.getByRole('listitem', { name: 'Pedido #00001' })
    expect(card).toHaveTextContent('Taxa de entrega: R$ 5,00')
    expect(card).toHaveTextContent('R$ 61,00')
    expect(card).not.toHaveTextContent('R$ 9,00')
  })

  it('shows the charged fee on the admin order and in the WhatsApp text', async () => {
    const stored = makeOrder({
      id: 'pedido-00001',
      status: 'andamento',
      deliveryFeeCents: 500,
      totalCents: 6100,
    }) as unknown as Order
    signInAs(adminProfile)
    const user = userEvent.setup()
    renderApp('/admin')
    await screen.findByRole('heading', { name: 'Painel' })
    await waitFor(() => expect(activeListeners('orders')).toHaveLength(1))
    await act(async () => {
      emit('orders', [stored])
    })
    await user.click(screen.getByRole('tab', { name: /Em Andamento/ }))
    await user.click(screen.getByRole('button', { name: /Ana Souza/ }))
    const dialog = screen.getByRole('dialog', { name: 'Pedido #00001' })
    expect(within(dialog).getByText('Taxa de entrega')).toBeInTheDocument()
    expect(dialog).toHaveTextContent('R$ 5,00')
    expect(within(dialog).getByText('Total').parentElement).toHaveTextContent('R$ 61,00')

    await user.click(within(dialog).getByRole('button', { name: 'Enviar pedido' }))
    const url = String(vi.mocked(window.open).mock.calls.at(-1)?.[0])
    const message = decodeURIComponent(url.split('text=')[1] ?? '')
    expect(message).toContain('Taxa de entrega: R$ 5,00')
    expect(message).toContain('Total: R$ 61,00')
    expect(message).toBe(sentMessage(stored))
  })
})
