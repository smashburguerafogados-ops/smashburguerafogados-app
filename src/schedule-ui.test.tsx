import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { clock } from './lib/clock'
import { activeListeners, emitDoc, firebaseMocks } from './test/mocks'
import { adminProfile, customerProfile, renderApp, signInAs } from './test/render'
import { recife } from './test/times'
import './index.css'
import './menu.css'
import menuCss from './menu.css?raw'

const WED = 25
const THU = 26

async function shopReady(data: Record<string, unknown> = { online: true }) {
  await waitFor(() => expect(activeListeners('settings/shop').length).toBeGreaterThan(0))
  await act(async () => {
    emitDoc('settings/shop', data)
  })
}

describe('opening hours on the customer menu', () => {
  it('shows the menu inside the hours', async () => {
    clock.now = () => recife(2026, 11, THU, 16, 0)
    renderApp()
    await shopReady()
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
    expect(document.querySelector('.menu__hours')).toHaveTextContent('Seg–Ter e Qui–Dom, 16h às 23h')
  })

  it('keeps the menu before opening and says when it opens', async () => {
    clock.now = () => recife(2026, 11, THU, 15, 59)
    renderApp()
    await shopReady()
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Loja fechada. Abrimos hoje às 16h' })).toBeInTheDocument()
    expect(document.querySelector('.menu__closed-dot')).toBeInTheDocument()
    expect(screen.getByText('Abrimos hoje às 16h')).toBeInTheDocument()
  })

  it('is closed all Wednesday and names Thursday', async () => {
    clock.now = () => recife(2026, 11, WED, 20, 0)
    renderApp()
    await shopReady({ online: true })
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
    expect(screen.getByText('Fechado às quartas. Abrimos quinta às 16h')).toBeInTheDocument()
  })

  it('keeps the default week when the settings cannot be read', async () => {
    clock.now = () => recife(2026, 11, WED, 20, 0)
    renderApp()
    await waitFor(() => expect(activeListeners('settings/shop')).toHaveLength(1))
    await act(async () => {
      activeListeners('settings/shop')[0].error?.(new Error('offline'))
    })
    expect(screen.getByText('Fechado às quartas. Abrimos quinta às 16h')).toBeInTheDocument()
  })

  it('closes by itself at 23:00 without reloading the page', async () => {
    const start = recife(2026, 11, THU, 22, 59, 59, 800)
    const t0 = performance.now()
    clock.now = () => start + (performance.now() - t0)
    renderApp()
    await shopReady()
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
    expect(document.querySelector('.menu__closed-dot')).not.toBeInTheDocument()
    expect(await screen.findByText('Abrimos amanhã às 16h')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('opens by itself at 16:00', async () => {
    const start = recife(2026, 11, THU, 15, 59, 59, 800)
    const t0 = performance.now()
    clock.now = () => start + (performance.now() - t0)
    renderApp()
    await shopReady()
    expect(screen.getByText('Abrimos hoje às 16h')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.menu__closed-dot')).not.toBeInTheDocument())
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('re-evaluates when the tab comes back to the front', async () => {
    clock.now = () => recife(2026, 11, THU, 18, 0)
    renderApp()
    await shopReady()
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()

    clock.now = () => recife(2026, 11, THU, 23, 5)
    act(() => {
      fireEvent(document, new Event('visibilitychange'))
    })
    expect(screen.getByText('Abrimos amanhã às 16h')).toBeInTheDocument()

    clock.now = () => recife(2026, 11, 27, 16, 5)
    act(() => {
      fireEvent(window, new Event('focus'))
    })
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('shows the admin message when the admin closes the shop by hand inside the hours', async () => {
    clock.now = () => recife(2026, 11, THU, 19, 0)
    renderApp()
    await shopReady({ online: false, closedAtMs: recife(2026, 11, THU, 18, 0), message: 'Acabou o pão.' })
    expect(screen.getByText('Acabou o pão. Abrimos amanhã às 16h')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('goes back to the schedule the next day after a manual close', async () => {
    clock.now = () => recife(2026, 11, 27, 17, 0)
    renderApp()
    await shopReady({ online: false, closedAtMs: recife(2026, 11, THU, 18, 0), message: 'Acabou o pão.' })
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  })
})

describe('placing an order', () => {
  async function fillCart(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Adicionar' }))
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    await user.click(within(cart).getByRole('radio', { name: 'Retirada' }))
    await user.click(within(cart).getByRole('radio', { name: 'Pix' }))
    return cart
  }

  it('sends the order while open', async () => {
    clock.now = () => recife(2026, 11, THU, 22, 59)
    signInAs(customerProfile)
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    await shopReady()
    const cart = await fillCart(user)
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    expect(firebaseMocks.addDoc).toHaveBeenCalledTimes(1)
  })

  it('refuses the order at the moment the shop closes, even before the screen updates', async () => {
    clock.now = () => recife(2026, 11, THU, 22, 59)
    signInAs(customerProfile)
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    await shopReady()
    const cart = await fillCart(user)

    clock.now = () => recife(2026, 11, THU, 23, 0)
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    expect(await within(cart).findByText(/Loja fechada\. Abrimos amanhã às 16h/)).toBeInTheDocument()
    expect(firebaseMocks.addDoc).not.toHaveBeenCalled()
    expect(screen.queryByText('Pedido enviado')).not.toBeInTheDocument()
  })

  it('does not let the admin order while the shop is closed, but keeps the menu to look at', async () => {
    clock.now = () => recife(2026, 11, WED, 20, 0)
    signInAs(adminProfile)
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    await shopReady()
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Adicionar' }))
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    expect(within(cart).getByText(/Loja fechada\. Fechado às quartas\. Abrimos quinta às 16h/)).toBeInTheDocument()
    expect(within(cart).getByRole('button', { name: 'Fazer Pedido' })).toBeDisabled()
  })
})

describe('closed shop keeps the menu and the cart', () => {
  async function addSmash(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Adicionar' }))
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    await user.click(within(cart).getByRole('radio', { name: 'Retirada' }))
    await user.click(within(cart).getByRole('radio', { name: 'Pix' }))
    return cart
  }

  it('lets a customer add to the cart on a closed Wednesday, with the order button off and the opening time', async () => {
    clock.now = () => recife(2026, 11, WED, 20, 0)
    signInAs(customerProfile)
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    await shopReady()
    const cart = await addSmash(user)
    const button = within(cart).getByRole('button', { name: 'Fazer Pedido' })
    expect(button).toBeDisabled()
    expect(within(cart).getByText('Loja fechada. Fechado às quartas. Abrimos quinta às 16h')).toBeInTheDocument()
    expect(button).toHaveAccessibleDescription(/Abrimos quinta às 16h/)
    expect(firebaseMocks.addDoc).not.toHaveBeenCalled()
  })

  it('enables the order button by itself when the shop opens', async () => {
    clock.now = () => recife(2026, 11, THU, 15, 59)
    signInAs(customerProfile)
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    await shopReady()
    const cart = await addSmash(user)
    expect(within(cart).getByRole('button', { name: 'Fazer Pedido' })).toBeDisabled()
    expect(within(cart).getByText('Loja fechada. Abrimos hoje às 16h')).toBeInTheDocument()

    clock.now = () => recife(2026, 11, THU, 16, 0)
    act(() => {
      fireEvent(window, new Event('focus'))
    })
    await waitFor(() => expect(within(cart).getByRole('button', { name: 'Fazer Pedido' })).toBeEnabled())
    expect(within(cart).queryByText(/Loja fechada/)).not.toBeInTheDocument()
    expect(document.querySelector('.menu__closed-dot')).not.toBeInTheDocument()
  })

  it('refuses to send in code when the shop closes while the pickup form is open', async () => {
    clock.now = () => recife(2026, 11, THU, 22, 58)
    signInAs({ ...customerProfile, whatsapp: '' })
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    await shopReady()
    const cart = await addSmash(user)
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    const form = await screen.findByRole('dialog', { name: 'Dados para retirada' })
    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '87988887777')

    clock.now = () => recife(2026, 11, THU, 23, 0)
    await user.click(within(form).getByRole('button', { name: 'Salvar e pedir' }))
    expect(await within(form).findByText(/Loja fechada\. Abrimos amanhã às 16h/)).toBeInTheDocument()
    expect(firebaseMocks.addDoc).not.toHaveBeenCalled()
    expect(screen.queryByText('Pedido enviado')).not.toBeInTheDocument()
  })

  it('keeps the closed dot still with reduced motion', () => {
    expect(menuCss).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.menu__closed-dot,\s*\.cart__closed-dot\s*\{\s*animation: none;/)
  })
})

describe('Funcionamento in the admin', () => {
  async function openShop() {
    signInAs(adminProfile)
    const user = userEvent.setup()
    renderApp('/admin')
    await screen.findByRole('heading', { name: 'Painel' })
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    await user.click(screen.getByRole('button', { name: 'Funcionamento' }))
    const sheet = await screen.findByRole('dialog', { name: 'Funcionamento' })
    await waitFor(() => expect(activeListeners('settings/shop')).toHaveLength(1))
    await act(async () => {
      emitDoc('settings/shop', { online: true })
    })
    return { user, sheet }
  }

  it('lists the week with the default hours and Wednesday closed', async () => {
    clock.now = () => recife(2026, 11, THU, 18, 0)
    const { sheet } = await openShop()
    for (const day of ['segunda', 'terça', 'quinta', 'sexta', 'sábado', 'domingo']) {
      expect(within(sheet).getByLabelText(`Abrir ${day}`)).toBeChecked()
      expect(within(sheet).getByLabelText(`Abre ${day}`)).toHaveValue('16:00')
      expect(within(sheet).getByLabelText(`Fecha ${day}`)).toHaveValue('23:00')
    }
    expect(within(sheet).getByLabelText('Abrir quarta')).not.toBeChecked()
    expect(within(sheet).queryByLabelText('Abre quarta')).not.toBeInTheDocument()
    expect(within(sheet).getByText('Fechado o dia todo')).toBeInTheDocument()
    expect(within(sheet).getByText('Agora: aberto pela agenda.')).toBeInTheDocument()
  })

  it('saves an edited schedule', async () => {
    clock.now = () => recife(2026, 11, THU, 18, 0)
    const { user, sheet } = await openShop()
    fireEvent.change(within(sheet).getByLabelText('Abre sexta'), { target: { value: '17:30' } })
    await user.click(within(sheet).getByLabelText('Abrir quarta'))
    fireEvent.change(within(sheet).getByLabelText('Fecha quarta'), { target: { value: '21:00' } })
    await user.click(within(sheet).getByRole('button', { name: 'Salvar agenda' }))
    const [ref, data, options] = firebaseMocks.setDoc.mock.calls.at(-1) as [
      { path: string },
      { schedule: Record<string, { open: boolean; from: number; to: number }> },
      unknown,
    ]
    expect(ref).toEqual({ path: 'settings/shop' })
    expect(options).toEqual({ merge: true })
    expect(data.schedule.fri).toEqual({ open: true, from: 17 * 60 + 30, to: 23 * 60 })
    expect(data.schedule.wed).toEqual({ open: true, from: 16 * 60, to: 21 * 60 })
    expect(data.schedule.mon).toEqual({ open: true, from: 16 * 60, to: 23 * 60 })
    expect(Object.keys(data)).toEqual(['schedule'])
    expect(await within(sheet).findByText('Agenda salva.')).toBeInTheDocument()
  })

  it('refuses a day that closes before it opens', async () => {
    clock.now = () => recife(2026, 11, THU, 18, 0)
    const { user, sheet } = await openShop()
    firebaseMocks.setDoc.mockClear()
    fireEvent.change(within(sheet).getByLabelText('Fecha sábado'), { target: { value: '15:00' } })
    await user.click(within(sheet).getByRole('button', { name: 'Salvar agenda' }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('sábado')
    expect(firebaseMocks.setDoc).not.toHaveBeenCalled()
  })

  it('restores the default hours', async () => {
    clock.now = () => recife(2026, 11, THU, 18, 0)
    const { user, sheet } = await openShop()
    fireEvent.change(within(sheet).getByLabelText('Abre sexta'), { target: { value: '19:00' } })
    await user.click(within(sheet).getByRole('button', { name: 'Restaurar horário padrão' }))
    expect(within(sheet).getByLabelText('Abre sexta')).toHaveValue('16:00')
  })

  it('does not apply a manual close outside the hours', async () => {
    clock.now = () => recife(2026, 11, WED, 12, 0)
    const { user, sheet } = await openShop()
    expect(within(sheet).getByText(/Agora: fechado pela agenda\. Fechado às quartas/)).toBeInTheDocument()
    firebaseMocks.setDoc.mockClear()
    await user.click(within(sheet).getByRole('switch', { name: 'Online' }))
    expect(firebaseMocks.setDoc).not.toHaveBeenCalled()
    expect(within(sheet).getByText(/vale só durante o expediente/)).toBeInTheDocument()
  })

  it('turning the switch back on clears the manual close', async () => {
    clock.now = () => recife(2026, 11, THU, 19, 0)
    const { user, sheet } = await openShop()
    await act(async () => {
      emitDoc('settings/shop', { online: false, closedAtMs: recife(2026, 11, THU, 18, 0) })
    })
    expect(within(sheet).getByText('Agora: fechado manualmente até 23h.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('switch', { name: 'Online' }))
    expect(firebaseMocks.setDoc).toHaveBeenLastCalledWith(
      { path: 'settings/shop' },
      expect.objectContaining({ online: true, closedAtMs: 'DELETE_FIELD' }),
      { merge: true },
    )
  })
})
