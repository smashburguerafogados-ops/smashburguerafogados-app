import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
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
