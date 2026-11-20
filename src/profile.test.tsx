import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { AUTH_EMAIL_DOMAIN } from './lib/identity'
import { firebaseMocks } from './test/mocks'
import { customerProfile, renderApp, signInAs } from './test/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('opens the delivery form from the user icon and saves it on the user', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo) => {
      const url = String(input)
      if (!url.includes('viacep.com.br/ws/01001000/json')) throw new Error(`unexpected ${url}`)
      return {
        ok: true,
        json: async () => ({
          logradouro: 'Praça da Sé',
          bairro: 'Sé',
          localidade: 'São Paulo',
          uf: 'SP',
        }),
      }
    }),
  )
  signInAs({ ...customerProfile, nome: '', whatsapp: '', address: null })
  const user = userEvent.setup()
  renderApp()
  await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())

  await user.click(screen.getByRole('button', { name: 'Conta' }))
  const form = screen.getByRole('dialog', { name: 'Dados para entrega' })
  expect(screen.queryByRole('dialog', { name: 'Conta' })).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Entrar' })).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Criar conta' })).not.toBeInTheDocument()
  expect(within(form).getByRole('textbox', { name: 'Nome' })).toBeRequired()
  expect(within(form).getByRole('textbox', { name: 'DDD' })).toHaveValue('87')
  expect(form.querySelector('.phone-join__prefix')).toHaveTextContent('9')
  expect(within(form).getByRole('textbox', { name: 'Telefone' })).toBeRequired()
  expect(within(form).getByRole('textbox', { name: 'CEP' })).toBeInTheDocument()

  await user.type(within(form).getByRole('textbox', { name: 'Nome' }), 'João Lima')
  await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '88887777')
  await user.type(within(form).getByRole('textbox', { name: 'CEP' }), '01001000')
  expect(await within(form).findByDisplayValue('Praça da Sé')).toBeInTheDocument()
  expect(within(form).getByDisplayValue('Sé')).toBeInTheDocument()
  expect(within(form).getByDisplayValue('São Paulo')).toBeInTheDocument()
  const number = within(form).getByRole('textbox', { name: 'Número' })
  expect(number).toBeRequired()
  await user.type(number, '15')
  await user.click(within(form).getByRole('button', { name: 'Salvar e pedir' }))

  await waitFor(() => expect(firebaseMocks.updateDoc).toHaveBeenCalled())
  const [userRef, patch] = firebaseMocks.updateDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>]
  expect(userRef.path).toBe('users/cliente-1')
  expect(patch).toMatchObject({
    nome: 'João Lima',
    whatsapp: '5587988887777',
    address: {
      cep: '01001000',
      street: 'Praça da Sé',
      number: '15',
      neighborhood: 'Sé',
      city: 'São Paulo',
      state: 'SP',
    },
  })
  expect(firebaseMocks.addDoc).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog', { name: 'Dados para entrega' })).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Entrar' })).not.toBeInTheDocument()
})

it('saves the address without an existing account', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo) => {
      const url = String(input)
      if (!url.includes('viacep.com.br/ws/01001000/json')) throw new Error(`unexpected ${url}`)
      return {
        ok: true,
        json: async () => ({
          logradouro: 'Praça da Sé',
          bairro: 'Sé',
          localidade: 'São Paulo',
          uf: 'SP',
        }),
      }
    }),
  )
  const user = userEvent.setup()
  renderApp()

  await user.click(screen.getByRole('button', { name: 'Conta' }))
  const form = screen.getByRole('dialog', { name: 'Dados para entrega' })
  await user.type(within(form).getByRole('textbox', { name: 'Nome' }), 'João Lima')
  await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '88887777')
  await user.type(within(form).getByRole('textbox', { name: 'CEP' }), '01001000')
  expect(await within(form).findByDisplayValue('Praça da Sé')).toBeInTheDocument()
  await user.type(within(form).getByRole('textbox', { name: 'Número' }), '15')
  await user.click(within(form).getByRole('button', { name: 'Salvar e pedir' }))

  await waitFor(() => expect(firebaseMocks.createUserWithEmailAndPassword).toHaveBeenCalled())
  const [auth, email, password] = firebaseMocks.createUserWithEmailAndPassword.mock.calls[0] as [
    unknown,
    string,
    string,
  ]
  expect(auth).toBeDefined()
  expect(email).toBe(`5587988887777@${AUTH_EMAIL_DOMAIN}`)
  expect(password.length).toBeGreaterThanOrEqual(6)
  const [userRef, profile] = firebaseMocks.setDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>]
  expect(userRef.path).toBe('users/cliente-novo')
  expect(profile).toMatchObject({
    uid: 'cliente-novo',
    role: 'customer',
    nome: 'João Lima',
    whatsapp: '5587988887777',
    address: {
      cep: '01001000',
      street: 'Praça da Sé',
      number: '15',
      neighborhood: 'Sé',
      city: 'São Paulo',
      state: 'SP',
    },
  })
  expect(localStorage.getItem('smash.customerId')).toBe('cliente-novo')
  expect(screen.queryByText(/entrar na conta/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Entrar' })).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Criar conta' })).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'Dados para entrega' })).not.toBeInTheDocument()
})

it('does not open login when the user icon is tapped while signed out', async () => {
  const user = userEvent.setup()
  renderApp()

  await user.click(screen.getByRole('button', { name: 'Conta' }))
  const form = screen.getByRole('dialog', { name: 'Dados para entrega' })
  expect(within(form).getByRole('textbox', { name: 'Nome' })).toBeInTheDocument()
  expect(within(form).getByRole('textbox', { name: 'DDD' })).toHaveValue('87')
  expect(form.querySelector('.phone-join__prefix')).toHaveTextContent('9')
  expect(within(form).getByRole('textbox', { name: 'CEP' })).toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Entrar' })).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Criar conta' })).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'Conta' })).not.toBeInTheDocument()
})

it('saves a DDD edited the same way as the phone number', async () => {
  signInAs({ ...customerProfile, whatsapp: '5581911112222' })
  const user = userEvent.setup()
  renderApp()
  await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())

  await user.click(screen.getByRole('button', { name: 'Conta' }))
  const form = screen.getByRole('dialog', { name: 'Dados para entrega' })
  const ddd = within(form).getByRole('textbox', { name: 'DDD' })
  expect(ddd).toHaveValue('81')
  expect(within(form).getByRole('textbox', { name: 'Telefone' })).toHaveValue('11112222')
  expect(form.querySelector('.phone-join__prefix')).toHaveTextContent('9')

  await user.clear(ddd)
  await user.type(ddd, '87')
  await user.click(within(form).getByRole('button', { name: 'Salvar endereço' }))

  await waitFor(() => expect(firebaseMocks.updateDoc).toHaveBeenCalled())
  const [, patch] = firebaseMocks.updateDoc.mock.calls[0] as [unknown, Record<string, unknown>]
  expect(patch.whatsapp).toBe('5587911112222')
  expect(patch).not.toHaveProperty('ddd')
})
