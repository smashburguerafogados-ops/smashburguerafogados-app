import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { BUSINESS_WHATSAPP, SYMBOLS } from './lib/whatsapp'
import { activeListeners, emit } from './test/mocks'
import { adminProfile, renderApp, signInAs } from './test/render'
import './menu.css'

const customers = [
  { id: 'cliente-1', uid: 'cliente-1', role: 'customer', nome: 'Ana Souza', whatsapp: '5587988887777', address: null },
  { id: 'cliente-2', uid: 'cliente-2', role: 'customer', nome: 'Bruno Lima', whatsapp: '5587911112222', address: null },
  { id: 'admin-1', uid: 'admin-1', role: 'admin', nome: 'Gerente', whatsapp: '', address: null },
]

async function openContacts() {
  signInAs(adminProfile)
  const user = userEvent.setup()
  renderApp('/admin')
  await screen.findByRole('heading', { name: 'Painel' })
  await waitFor(() => expect(activeListeners('users')).toHaveLength(1))
  await act(async () => {
    emit('users', customers)
  })
  await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
  await user.click(screen.getByRole('button', { name: 'Contato' }))
  return { user, sheet: screen.getByRole('dialog', { name: 'Contato' }) }
}

function lastWhatsapp(): { number: string; text: string } {
  const calls = vi.mocked(window.open).mock.calls
  const url = String(calls[calls.length - 1]?.[0])
  const match = url.match(/^https:\/\/wa\.me\/(\d+)\?text=(.*)$/)
  if (!match) throw new Error(`not a wa.me link: ${url}`)
  return { number: match[1], text: decodeURIComponent(match[2]) }
}

it('searches the customer list by name', async () => {
  const { user, sheet } = await openContacts()
  expect(within(sheet).getByRole('button', { name: /Ana Souza/ })).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: /Bruno Lima/ })).toBeInTheDocument()
  expect(within(sheet).queryByRole('button', { name: /Gerente/ })).not.toBeInTheDocument()

  await user.type(within(sheet).getByRole('searchbox', { name: 'Buscar' }), 'souza')
  expect(within(sheet).getByRole('button', { name: /Ana Souza/ })).toBeInTheDocument()
  expect(within(sheet).queryByRole('button', { name: /Bruno Lima/ })).not.toBeInTheDocument()
})

it('searches the customer list by phone number', async () => {
  const { user, sheet } = await openContacts()
  await user.type(within(sheet).getByRole('searchbox', { name: 'Buscar' }), '11112222')
  expect(within(sheet).getByRole('button', { name: /Bruno Lima/ })).toBeInTheDocument()
  expect(within(sheet).queryByRole('button', { name: /Ana Souza/ })).not.toBeInTheDocument()
})

it('sends the typed message to that customer on WhatsApp', async () => {
  const { user, sheet } = await openContacts()
  await user.click(within(sheet).getByRole('button', { name: /Ana Souza/ }))
  const send = within(sheet).getByRole('button', { name: 'Enviar' })
  expect(send).toBeDisabled()
  expect(send).not.toHaveTextContent('Enviar')
  expect(send.querySelector('svg')).toBeInTheDocument()
  expect(getComputedStyle(send).borderRadius).toBe('50%')

  await user.type(within(sheet).getByRole('textbox', { name: 'Mensagem para Ana Souza' }), 'Seu pedido saiu')
  expect(send).toBeEnabled()
  await user.click(send)

  expect(lastWhatsapp()).toEqual({ number: '5587988887777', text: 'Seu pedido saiu' })
})

async function openBroadcast() {
  signInAs(adminProfile)
  const user = userEvent.setup()
  renderApp('/admin')
  await screen.findByRole('heading', { name: 'Painel' })
  await waitFor(() => expect(activeListeners('users')).toHaveLength(1))
  await act(async () => {
    emit('users', customers)
  })
  await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
  await user.click(screen.getByRole('button', { name: 'Enviar WhatsApp' }))
  return { user, sheet: screen.getByRole('dialog', { name: 'Enviar WhatsApp' }) }
}

function openedTexts(): { number: string; text: string }[] {
  return vi.mocked(window.open).mock.calls.map((call) => {
    const url = String(call[0])
    const match = url.match(/^https:\/\/wa\.me\/(\d+)\?text=(.*)$/)
    if (!match) throw new Error(`not a wa.me link: ${url}`)
    return { number: match[1], text: decodeURIComponent(match[2]) }
  })
}

it('closes the recipient list on an outside tap and keeps the message field at 16px', async () => {
  const { user, sheet } = await openBroadcast()
  const stack = sheet.querySelector('.wa-screen') as HTMLElement
  expect(parseFloat(getComputedStyle(stack).rowGap || getComputedStyle(stack).gap)).toBeGreaterThanOrEqual(16)

  const message = within(sheet).getByRole('textbox', { name: 'Mensagem' })
  expect(parseFloat(getComputedStyle(message).fontSize)).toBeGreaterThanOrEqual(16)

  await user.click(within(sheet).getByRole('button', { name: /Todos os cadastrados/ }))
  expect(within(sheet).getByRole('listbox', { name: 'Para' })).toBeInTheDocument()
  await user.click(message)
  expect(within(sheet).queryByRole('listbox', { name: 'Para' })).not.toBeInTheDocument()

  await user.click(within(sheet).getByRole('button', { name: /Todos os cadastrados/ }))
  expect(within(sheet).getByRole('listbox', { name: 'Para' })).toBeInTheDocument()
  await user.click(within(sheet).getByText('A mensagem sai com o ícone do Smash e este texto. Todos usa o mesmo texto.'))
  expect(within(sheet).queryByRole('listbox', { name: 'Para' })).not.toBeInTheDocument()
})

it('shows each registered number with the name underneath and sends Todos with the Smash icon', async () => {
  const { user, sheet } = await openBroadcast()
  expect(sheet).toHaveTextContent('+55 (87) 9661-9629')
  expect(BUSINESS_WHATSAPP).toBe('558796619629')

  await user.click(within(sheet).getByRole('button', { name: /Todos os cadastrados/ }))
  const ana = within(sheet).getByRole('option', { name: /Ana Souza/ })
  const name = ana.querySelector('.wa-option__name') as HTMLElement
  const number = ana.querySelector('.wa-option__number') as HTMLElement
  expect(number).toHaveTextContent('+55 (87) 98888-7777')
  expect(name).toHaveTextContent('Ana Souza')
  expect(parseFloat(getComputedStyle(name).fontSize)).toBeLessThan(parseFloat(getComputedStyle(number).fontSize))

  await user.click(ana)
  const message = within(sheet).getByRole('textbox', { name: 'Mensagem' })
  await user.type(message, 'Hoje tem combo')
  await user.click(within(sheet).getByRole('button', { name: 'Enviar' }))
  expect(openedTexts()).toEqual([{ number: '5587988887777', text: `${SYMBOLS.burger} Hoje tem combo` }])

  await user.click(within(sheet).getByRole('button', { name: /Ana Souza/ }))
  await user.click(within(sheet).getByRole('option', { name: /Todos os cadastrados/ }))
  vi.mocked(window.open).mockClear()
  await user.click(within(sheet).getByRole('button', { name: 'Enviar' }))
  expect(openedTexts().map((item) => item.number)).toEqual(['5587988887777', '5587911112222'])
  expect(openedTexts().every((item) => item.text === `${SYMBOLS.burger} Hoje tem combo`)).toBe(true)
  expect(sheet).toHaveTextContent('Conversas abertas no WhatsApp.')
})

it('opens the next WhatsApp chat when the browser blocks more than one', async () => {
  const { user, sheet } = await openBroadcast()
  let calls = 0
  vi.mocked(window.open).mockImplementation(() => {
    calls += 1
    return calls === 1 ? ({ opener: {} } as Window) : null
  })
  await user.type(within(sheet).getByRole('textbox', { name: 'Mensagem' }), 'Volta logo')
  await user.click(within(sheet).getByRole('button', { name: 'Enviar' }))

  expect(sheet).toHaveTextContent('O navegador só abre uma conversa do WhatsApp por toque.')
  expect(sheet).toHaveTextContent('A de Ana Souza foi aberta.')
  expect(sheet).toHaveTextContent('Falta 1 pessoa')
  expect(openedTexts()[0]).toEqual({ number: '5587988887777', text: `${SYMBOLS.burger} Volta logo` })
  expect(vi.mocked(window.open).mock.results[1]?.value).toBeNull()

  vi.mocked(window.open).mockImplementation(() => ({ opener: {} }) as Window)
  await user.click(within(sheet).getByRole('button', { name: 'Abrir a próxima' }))
  expect(openedTexts().map((item) => item.number)).toContain('5587911112222')
  expect(sheet).not.toHaveTextContent('Falta 1 pessoa')
})
