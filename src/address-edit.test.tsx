import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { firebaseMocks } from './test/mocks'
import { customerProfile, renderApp, signInAs } from './test/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('replaces the saved address from the cart without looking up the phone', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('ViaCEP must not run for a saved address'))))
  signInAs(customerProfile)
  const user = userEvent.setup()
  renderApp()
  await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())

  await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Adicionar' }))
  await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
  const cart = screen.getByRole('dialog', { name: 'Carrinho' })
  expect(cart).toHaveTextContent('Rua das Flores, 120')
  await user.click(within(cart).getByRole('button', { name: 'Alterar endereço' }))

  const form = screen.getByRole('dialog', { name: 'Dados para entrega' })
  expect(form).toHaveTextContent('Altere o endereço. O próximo pedido usa o que você salvar.')
  expect(within(form).getByRole('textbox', { name: 'Endereço' })).toHaveValue('Rua das Flores')
  expect(within(form).queryByText('Buscando cadastro...')).not.toBeInTheDocument()
  expect(firebaseMocks.signInWithEmailAndPassword).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()

  const number = within(form).getByRole('textbox', { name: 'Número' })
  await user.clear(number)
  await user.type(number, '200')
  await user.click(within(form).getByRole('button', { name: 'Salvar endereço' }))

  await waitFor(() => expect(firebaseMocks.updateDoc).toHaveBeenCalled())
  const [ref, patch] = firebaseMocks.updateDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>]
  expect(ref.path).toBe('users/cliente-1')
  expect(patch).toMatchObject({ address: { street: 'Rua das Flores', number: '200' } })
  expect(screen.queryByRole('dialog', { name: 'Dados para entrega' })).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Carrinho' })).toHaveTextContent('Rua das Flores, 200')

  await user.click(within(screen.getByRole('dialog', { name: 'Carrinho' })).getByRole('radio', { name: 'Pix' }))
  await user.click(screen.getByRole('button', { name: 'Fazer Pedido' }))
  expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
  const [, order] = firebaseMocks.addDoc.mock.calls[0] as [unknown, Record<string, unknown>]
  expect(order).toMatchObject({ address: { street: 'Rua das Flores', number: '200' }, fulfillment: 'entrega' })
  expect(firebaseMocks.signInWithEmailAndPassword).not.toHaveBeenCalled()
})

it('replaces the saved address from Conta without a phone lookup', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('ViaCEP must not run for a saved address'))))
  signInAs(customerProfile)
  const user = userEvent.setup()
  renderApp()
  await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())

  await user.click(screen.getByRole('button', { name: 'Conta' }))
  const form = screen.getByRole('dialog', { name: 'Dados para entrega' })
  expect(within(form).getByRole('textbox', { name: 'Endereço' })).toHaveValue('Rua das Flores')
  expect(firebaseMocks.signInWithEmailAndPassword).not.toHaveBeenCalled()
  const number = within(form).getByRole('textbox', { name: 'Número' })
  await user.clear(number)
  await user.type(number, '88')
  await user.click(within(form).getByRole('button', { name: 'Salvar endereço' }))

  await waitFor(() => expect(firebaseMocks.updateDoc).toHaveBeenCalled())
  const [, patch] = firebaseMocks.updateDoc.mock.calls[0] as [unknown, { address: { number: string } }]
  expect(patch.address.number).toBe('88')
  expect(fetch).not.toHaveBeenCalled()
})
