import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchCustomers } from './lib/contacts'
import { mapCustomerError } from './lib/errors'
import { AUTH_EMAIL_DOMAIN, customerAccessKey, whatsappToRecoveryEmail } from './lib/identity'
import { emit, firebaseMocks } from './test/mocks'
import { renderApp } from './test/render'
import type { UserProfile } from './types'

const NUMBER = '5587988887777'
const PRIMARY = `${NUMBER}@${AUTH_EMAIL_DOMAIN}`
const RECOVERY = `${NUMBER}.r@${AUTH_EMAIL_DOMAIN}`

const saved: UserProfile = {
  uid: 'cliente-antigo',
  role: 'customer',
  nome: 'Jameson',
  whatsapp: NUMBER,
  address: {
    cep: '56300000',
    street: 'Rua das Flores',
    number: '42',
    neighborhood: 'Centro',
    city: 'Petrolina',
    state: 'PE',
    reference: 'Perto da praça',
  },
}

function authError(code: string) {
  return Object.assign(new Error(code), { code })
}

/** Firebase: only `opens` has a login with the access key; any other address fails. */
function loginsThatOpen(opens: string, uid: string) {
  firebaseMocks.signInWithEmailAndPassword.mockImplementation(async (...args: unknown[]) => {
    const [, email, key] = args as [unknown, string, string]
    if (email === opens && key === customerAccessKey(NUMBER)) return { user: { uid } }
    throw authError('auth/invalid-credential')
  })
}

function userDocs(docs: Record<string, Record<string, unknown>>) {
  firebaseMocks.getDoc.mockImplementation(async (...args: unknown[]) => {
    const [ref] = args as [{ path: string }]
    const data = docs[ref.path]
    return { exists: () => Boolean(data), data: () => data }
  })
}

async function openDeliveryForm(user: ReturnType<typeof userEvent.setup>) {
  renderApp()
  await user.click(screen.getByRole('button', { name: 'Conta' }))
  return screen.getByRole('dialog', { name: 'Dados para entrega' })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('customer logins', () => {
  it('derives the recovery login and access key from the number on the same domain', () => {
    expect(whatsappToRecoveryEmail('(87) 98888-7777')).toBe(RECOVERY)
    expect(customerAccessKey('87988887777')).toBe(customerAccessKey(NUMBER))
    expect(customerAccessKey('123')).toBeNull()
  })

  it('never asks for a password on the customer forms', () => {
    expect(mapCustomerError(authError('auth/email-already-in-use'))).not.toMatch(/senha/i)
    expect(mapCustomerError(authError('auth/invalid-credential'))).not.toMatch(/senha/i)
  })
})

describe('returning customer in a new browser session', () => {
  it('reopens the saved customer when the same WhatsApp is typed, prefilling name and address', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('ViaCEP must not run for a saved address'))))
    loginsThatOpen(PRIMARY, saved.uid)
    userDocs({ [`users/${saved.uid}`]: saved })
    const user = userEvent.setup()
    const form = await openDeliveryForm(user)

    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '88887777')

    expect(await within(form).findByText('Encontramos seu cadastro. Confira os dados e peça.')).toBeInTheDocument()
    expect(within(form).getByRole('textbox', { name: 'Nome' })).toHaveValue('Jameson')
    expect(within(form).getByRole('textbox', { name: 'CEP' })).toHaveValue('56300-000')
    expect(within(form).getByRole('textbox', { name: 'Endereço' })).toHaveValue('Rua das Flores')
    expect(within(form).getByRole('textbox', { name: 'Número' })).toHaveValue('42')
    expect(within(form).getByRole('textbox', { name: 'Bairro' })).toHaveValue('Centro')
    expect(within(form).getByRole('textbox', { name: 'Cidade' })).toHaveValue('Petrolina')

    await user.click(within(form).getByRole('button', { name: 'Salvar e pedir' }))

    await waitFor(() => expect(firebaseMocks.updateDoc).toHaveBeenCalled())
    expect(firebaseMocks.updateDoc).toHaveBeenCalledWith(
      { path: `users/${saved.uid}` },
      expect.objectContaining({ nome: 'Jameson', whatsapp: NUMBER, address: saved.address }),
    )
    expect(firebaseMocks.createUserWithEmailAndPassword).not.toHaveBeenCalled()
    expect(firebaseMocks.setDoc).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(localStorage.getItem('smash.customerId')).toBe(saved.uid)
    expect(screen.queryByText(/senha/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Dados para entrega' })).not.toBeInTheDocument()
  })

  it('reopens on save even if the person typed everything before the lookup finished', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ erro: true }) })))
    loginsThatOpen(PRIMARY, saved.uid)
    userDocs({ [`users/${saved.uid}`]: saved })
    firebaseMocks.signInWithEmailAndPassword.mockRejectedValueOnce(authError('auth/invalid-credential'))
    firebaseMocks.signInWithEmailAndPassword.mockRejectedValueOnce(authError('auth/network-request-failed'))
    const user = userEvent.setup()
    const form = await openDeliveryForm(user)

    await user.type(within(form).getByRole('textbox', { name: 'Nome' }), 'Jameson S')
    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '88887777')
    await user.type(within(form).getByRole('textbox', { name: 'CEP' }), '56300000')
    await user.type(await within(form).findByRole('textbox', { name: 'Endereço' }), 'Rua Nova')
    await user.type(within(form).getByRole('textbox', { name: 'Número' }), '7')
    await user.type(within(form).getByRole('textbox', { name: 'Bairro' }), 'Centro')
    await user.type(within(form).getByRole('textbox', { name: 'Cidade' }), 'Petrolina')
    await user.click(within(form).getByRole('button', { name: 'Salvar e pedir' }))

    await waitFor(() => expect(firebaseMocks.updateDoc).toHaveBeenCalled())
    expect(firebaseMocks.updateDoc).toHaveBeenCalledWith(
      { path: `users/${saved.uid}` },
      expect.objectContaining({ nome: 'Jameson S', whatsapp: NUMBER }),
    )
    expect(firebaseMocks.createUserWithEmailAndPassword).not.toHaveBeenCalled()
    expect(screen.queryByText(/já está cadastrado/i)).not.toBeInTheDocument()
  })

  it('recovers a number whose first login has a lost random password, without asking for it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ erro: true }) })))
    firebaseMocks.createUserWithEmailAndPassword.mockImplementation(async (...args: unknown[]) => {
      const [, email] = args as [unknown, string]
      if (email === PRIMARY) throw authError('auth/email-already-in-use')
      return { user: { uid: 'cliente-recuperado' } }
    })
    const user = userEvent.setup()
    const form = await openDeliveryForm(user)

    await user.type(within(form).getByRole('textbox', { name: 'Nome' }), 'Jameson')
    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '88887777')
    await user.type(within(form).getByRole('textbox', { name: 'CEP' }), '56300000')
    await user.type(await within(form).findByRole('textbox', { name: 'Endereço' }), 'Rua das Flores')
    await user.type(within(form).getByRole('textbox', { name: 'Número' }), '42')
    await user.type(within(form).getByRole('textbox', { name: 'Bairro' }), 'Centro')
    await user.type(within(form).getByRole('textbox', { name: 'Cidade' }), 'Petrolina')
    await user.click(within(form).getByRole('button', { name: 'Salvar e pedir' }))

    await waitFor(() => expect(firebaseMocks.setDoc).toHaveBeenCalled())
    const emails = firebaseMocks.createUserWithEmailAndPassword.mock.calls.map((call) => call[1])
    expect(emails).toEqual([PRIMARY, RECOVERY])
    const [ref, profile] = firebaseMocks.setDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>]
    expect(ref.path).toBe('users/cliente-recuperado')
    expect(profile).toMatchObject({ uid: 'cliente-recuperado', role: 'customer', nome: 'Jameson', whatsapp: NUMBER })
    expect(localStorage.getItem('smash.customerId')).toBe('cliente-recuperado')
    expect(screen.queryByText(/senha/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Dados para entrega' })).not.toBeInTheDocument()
  })

  it('comes back through the recovery login on later visits instead of making another account', async () => {
    vi.stubGlobal('fetch', vi.fn())
    loginsThatOpen(RECOVERY, 'cliente-recuperado')
    userDocs({ 'users/cliente-recuperado': { ...saved, uid: 'cliente-recuperado' } })
    const user = userEvent.setup()
    const form = await openDeliveryForm(user)

    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '88887777')
    expect(await within(form).findByDisplayValue('Rua das Flores')).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Salvar e pedir' }))

    await waitFor(() => expect(firebaseMocks.updateDoc).toHaveBeenCalled())
    expect(firebaseMocks.signInWithEmailAndPassword.mock.calls[0][1]).toBe(RECOVERY)
    expect(firebaseMocks.createUserWithEmailAndPassword).not.toHaveBeenCalled()
    expect(localStorage.getItem('smash.customerId')).toBe('cliente-recuperado')
  })

  it('does not open an admin account from the customer form', async () => {
    loginsThatOpen(PRIMARY, 'admin-1')
    userDocs({ 'users/admin-1': { uid: 'admin-1', role: 'admin', nome: 'Admin', whatsapp: NUMBER } })
    const user = userEvent.setup()
    const form = await openDeliveryForm(user)

    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '88887777')

    await waitFor(() => expect(firebaseMocks.signOut).toHaveBeenCalled())
    expect(within(form).getByRole('textbox', { name: 'Nome' })).toHaveValue('')
    expect(screen.queryByText('Encontramos seu cadastro. Confira os dados e peça.')).not.toBeInTheDocument()
  })

  it('reopens the saved customer on the pickup form too', async () => {
    loginsThatOpen(PRIMARY, saved.uid)
    userDocs({ [`users/${saved.uid}`]: saved })
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Adicionar' }))
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    await user.click(within(cart).getByRole('radio', { name: 'Retirada' }))
    await user.click(within(cart).getByRole('radio', { name: 'Pix' }))
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    const form = screen.getByRole('dialog', { name: 'Dados para retirada' })

    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '88887777')

    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar e pedir' })).not.toBeInTheDocument()
    expect(firebaseMocks.updateDoc).not.toHaveBeenCalled()
    expect(firebaseMocks.createUserWithEmailAndPassword).not.toHaveBeenCalled()
    const [, payload] = firebaseMocks.addDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(payload).toMatchObject({ customerId: saved.uid, fulfillment: 'retirada' })
    expect(screen.queryByText(/senha/i)).not.toBeInTheDocument()
  })
})

describe('admin contacts', () => {
  it('lists a recovered number once, keeping its newest record', () => {
    const onNext = vi.fn()
    watchCustomers(onNext, () => {})
    emit('users', [
      { id: 'velho', ...saved, uid: 'velho', nome: 'Jameson antigo', createdAt: { toMillis: () => 1 } },
      { id: 'novo', ...saved, uid: 'novo', nome: 'Jameson', createdAt: { toMillis: () => 2 } },
      { id: 'ana', ...saved, uid: 'ana', nome: 'Ana', whatsapp: '5587999990000' },
    ])
    const people = onNext.mock.calls[0][0] as UserProfile[]
    expect(people.map((person) => person.uid)).toEqual(['ana', 'novo'])
  })
})
