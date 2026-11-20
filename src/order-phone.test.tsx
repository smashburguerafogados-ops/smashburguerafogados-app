import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AUTH_EMAIL_DOMAIN, customerAccessKey } from './lib/identity'
import { activeListeners, authState, emitDoc, firebaseMocks } from './test/mocks'
import { customerProfile, renderApp, signInAs } from './test/render'
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

async function openCheckout(user: ReturnType<typeof userEvent.setup>, mode: 'Entrega' | 'Retirada' = 'Entrega') {
  await user.click(screen.getByRole('button', { name: /Smash da casa/ }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Adicionar' }))
  await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
  const cart = screen.getByRole('dialog', { name: 'Carrinho' })
  await waitFor(() => expect(activeListeners('settings/shop').length).toBeGreaterThan(0))
  if (mode === 'Retirada') await user.click(within(cart).getByRole('radio', { name: 'Retirada' }))
  await user.click(within(cart).getByRole('radio', { name: 'Pix' }))
  return cart
}

describe('phone before the order', () => {
  it('shows only the phone, searches after eight digits, then asks to finish the cadastro', async () => {
    let open = false
    const queued: Array<(value: { user: null }) => void> = []
    firebaseMocks.signInWithEmailAndPassword.mockImplementation(
      () =>
        new Promise((resolve) => {
          if (open) resolve({ user: null })
          else queued.push(resolve)
        }),
    )
    const user = userEvent.setup()
    renderApp()
    const cart = await openCheckout(user)
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    const form = screen.getByRole('dialog', { name: 'Dados para entrega' })

    expect(within(form).getByRole('textbox', { name: 'Telefone' })).toBeInTheDocument()
    expect(within(form).queryByRole('textbox', { name: 'Nome' })).not.toBeInTheDocument()
    expect(within(form).queryByRole('textbox', { name: 'CEP' })).not.toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: 'Salvar e pedir' })).not.toBeInTheDocument()

    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '8888777')
    expect(firebaseMocks.signInWithEmailAndPassword).not.toHaveBeenCalled()
    expect(form).not.toHaveTextContent('Buscando cadastro...')

    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '7')
    expect(await within(form).findByText('Buscando cadastro...')).toBeInTheDocument()
    expect(firebaseMocks.signInWithEmailAndPassword).toHaveBeenCalledTimes(1)
    expect(within(form).queryByRole('textbox', { name: 'CEP' })).not.toBeInTheDocument()

    await act(async () => {
      open = true
      queued.splice(0).forEach((resolve) => resolve({ user: null }))
    })
    expect(await within(form).findByText('Finalize seu cadastro.')).toBeInTheDocument()
    expect(within(form).getByRole('textbox', { name: 'CEP' })).toBeInTheDocument()
    expect(within(form).queryByRole('textbox', { name: 'Nome' })).not.toBeInTheDocument()
    expect(form).not.toHaveTextContent('Entre com a senha')
  })

  it('places the order from a saved customer and does not look the number up again', async () => {
    firebaseMocks.signInWithEmailAndPassword.mockImplementation(async (...args: unknown[]) => {
      const [, email, key] = args as [unknown, string, string]
      if (email === `${NUMBER}@${AUTH_EMAIL_DOMAIN}` && key === customerAccessKey(NUMBER)) {
        return { user: { uid: saved.uid } }
      }
      throw authError('auth/invalid-credential')
    })
    firebaseMocks.getDoc.mockImplementation(async (...args: unknown[]) => {
      const [ref] = args as [{ path: string }]
      const data = ref.path === `users/${saved.uid}` ? saved : undefined
      return { exists: () => Boolean(data), data: () => data }
    })
    const user = userEvent.setup()
    renderApp()
    const cart = await openCheckout(user)
    await act(async () => {
      emitDoc('settings/shop', { online: true, deliveryFeeCents: 500 })
    })
    const summary = within(cart).getByRole('group', { name: 'Resumo do pedido' })
    expect(summary).toHaveTextContent('Taxa de entrega')
    expect(summary).toHaveTextContent('R$ 5,00')
    expect(within(summary).getByTestId('cart-total')).toHaveTextContent('R$ 33,00')

    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    const form = screen.getByRole('dialog', { name: 'Dados para entrega' })
    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '88887777')

    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar e pedir' })).not.toBeInTheDocument()
    const lookups = firebaseMocks.signInWithEmailAndPassword.mock.calls.length
    expect(lookups).toBeGreaterThan(0)
    const [, first] = firebaseMocks.addDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(first).toMatchObject({
      customerId: saved.uid,
      customerName: 'Jameson',
      customerWhatsapp: NUMBER,
      fulfillment: 'entrega',
      deliveryFeeCents: 500,
      totalCents: 3300,
      address: { street: 'Rua das Flores', number: '42' },
    })

    await user.click(screen.getByRole('button', { name: 'Voltar ao cardápio' }))
    const again = await openCheckout(user)
    await user.click(within(again).getByRole('button', { name: 'Fazer Pedido' }))
    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Dados para entrega' })).not.toBeInTheDocument()
    expect(firebaseMocks.signInWithEmailAndPassword).toHaveBeenCalledTimes(lookups)
    expect(firebaseMocks.addDoc).toHaveBeenCalledTimes(2)
  })

  it('persists a successful phone lookup so the next visit does not ask again', async () => {
    firebaseMocks.signInWithEmailAndPassword.mockImplementation(async (...args: unknown[]) => {
      const [, email, key] = args as [unknown, string, string]
      if (email === RECOVERY) {
        setTimeout(() => {
          authState.user = null
        }, 0)
        throw authError('auth/invalid-credential')
      }
      if (email === PRIMARY && key === customerAccessKey(NUMBER)) return { user: { uid: saved.uid } }
      throw authError('auth/invalid-credential')
    })
    firebaseMocks.getDoc.mockImplementation(async (...args: unknown[]) => {
      const [ref] = args as [{ path: string }]
      const data = ref.path === `users/${saved.uid}` ? saved : undefined
      return { exists: () => Boolean(data), data: () => data }
    })
    const user = userEvent.setup()
    const first = renderApp()
    const cart = await openCheckout(user)
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    await user.type(
      within(screen.getByRole('dialog', { name: 'Dados para entrega' })).getByRole('textbox', { name: 'Telefone' }),
      '88887777',
    )

    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    expect(firebaseMocks.signOut).not.toHaveBeenCalled()
    await waitFor(() => expect(authState.user?.uid).toBe(saved.uid))
    expect(localStorage.getItem('smash.customerId')).toBe(saved.uid)
    const lookups = firebaseMocks.signInWithEmailAndPassword.mock.calls.length

    first.unmount()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Jameson' })).toBeInTheDocument()
    const again = await openCheckout(user, 'Retirada')
    await user.click(within(again).getByRole('button', { name: 'Fazer Pedido' }))

    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Telefone' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Dados para entrega' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Dados para retirada' })).not.toBeInTheDocument()
    expect(firebaseMocks.signInWithEmailAndPassword).toHaveBeenCalledTimes(lookups)
    expect(firebaseMocks.signOut).not.toHaveBeenCalled()
    const [, pickedUp] = firebaseMocks.addDoc.mock.calls[1] as [unknown, Record<string, unknown>]
    expect(pickedUp).toMatchObject({ customerId: saved.uid, fulfillment: 'retirada', customerName: 'Jameson' })
  })

  it('persists the recovery login the same way', async () => {
    const recovered = { ...saved, uid: 'cliente-recuperado' }
    firebaseMocks.signInWithEmailAndPassword.mockImplementation(async (...args: unknown[]) => {
      const [, email, key] = args as [unknown, string, string]
      if (email === PRIMARY) {
        setTimeout(() => {
          authState.user = null
        }, 0)
        throw authError('auth/invalid-credential')
      }
      if (email === RECOVERY && key === customerAccessKey(NUMBER)) return { user: { uid: recovered.uid } }
      throw authError('auth/invalid-credential')
    })
    firebaseMocks.getDoc.mockImplementation(async (...args: unknown[]) => {
      const [ref] = args as [{ path: string }]
      const data = ref.path === `users/${recovered.uid}` ? recovered : undefined
      return { exists: () => Boolean(data), data: () => data }
    })
    const user = userEvent.setup()
    const first = renderApp()
    const cart = await openCheckout(user, 'Retirada')
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    await user.type(
      within(screen.getByRole('dialog', { name: 'Dados para retirada' })).getByRole('textbox', { name: 'Telefone' }),
      '88887777',
    )

    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    await waitFor(() => expect(authState.user?.uid).toBe(recovered.uid))
    expect(firebaseMocks.signOut).not.toHaveBeenCalled()
    const lookups = firebaseMocks.signInWithEmailAndPassword.mock.calls.length

    first.unmount()
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Jameson' })).toBeInTheDocument()
    const again = await openCheckout(user)
    await user.click(within(again).getByRole('button', { name: 'Fazer Pedido' }))
    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Telefone' })).not.toBeInTheDocument()
    expect(firebaseMocks.signInWithEmailAndPassword).toHaveBeenCalledTimes(lookups)
  })

  it('lets a signed-in customer order again without the phone, and pickup stays free', async () => {
    signInAs(customerProfile)
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    const cart = await openCheckout(user)
    await act(async () => {
      emitDoc('settings/shop', { online: true, deliveryFeeCents: 500 })
    })
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))

    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Telefone' })).not.toBeInTheDocument()
    expect(firebaseMocks.signInWithEmailAndPassword).not.toHaveBeenCalled()
    const [, delivery] = firebaseMocks.addDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(delivery).toMatchObject({
      customerName: 'Ana Souza',
      fulfillment: 'entrega',
      deliveryFeeCents: 500,
      totalCents: 3300,
    })

    await user.click(screen.getByRole('button', { name: 'Voltar ao cardápio' }))
    const pickup = await openCheckout(user, 'Retirada')
    const pickupSummary = within(pickup).getByRole('group', { name: 'Resumo do pedido' })
    expect(pickupSummary).not.toHaveTextContent('Taxa de entrega')
    expect(within(pickupSummary).getByTestId('cart-total')).toHaveTextContent('R$ 28,00')
    await user.click(within(pickup).getByRole('button', { name: 'Fazer Pedido' }))
    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    expect(firebaseMocks.signInWithEmailAndPassword).not.toHaveBeenCalled()
    const [, collected] = firebaseMocks.addDoc.mock.calls[1] as [unknown, Record<string, unknown>]
    expect(collected).toMatchObject({ fulfillment: 'retirada', deliveryFeeCents: 0, totalCents: 2800, address: null })
  })
})
