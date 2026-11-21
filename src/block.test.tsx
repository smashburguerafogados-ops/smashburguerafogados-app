import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { MAX_WAIT_MS } from './components/Splash'
import { blockKey, blockKeyFromEmail } from './lib/blocked'
import { AUTH_EMAIL_DOMAIN } from './lib/identity'
import { activeListeners, authState, blockedPhones, blockedState, emit, emitDoc, firebaseMocks } from './test/mocks'
import { adminProfile, customerProfile, makeOrder, renderApp, signInAs } from './test/render'

const NUMBER = customerProfile.whatsapp

afterEach(() => {
  vi.useRealTimers()
})

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function expectLocked() {
  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Entrar no cardápio/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('searchbox', { name: 'Buscar' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Carrinho,/ })).not.toBeInTheDocument()
}

describe('blocked list keys', () => {
  it('normalizes a phone and reads the phone out of a customer login email', () => {
    expect(blockKey('(87) 98888-7777')).toBe(NUMBER)
    expect(blockKey('')).toBeNull()
    expect(blockKeyFromEmail(`${NUMBER}@${AUTH_EMAIL_DOMAIN}`)).toBe(NUMBER)
    expect(blockKeyFromEmail(`${NUMBER}.r@${AUTH_EMAIL_DOMAIN}`)).toBe(NUMBER)
    expect(blockKeyFromEmail('admin@loja.com')).toBeNull()
    expect(blockKeyFromEmail(null)).toBeNull()
  })
})

describe('Bloquear (admin)', () => {
  async function openBlock() {
    signInAs(adminProfile)
    const user = userEvent.setup()
    renderApp('/admin')
    await screen.findByRole('heading', { name: 'Painel' })
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    await user.click(screen.getByRole('button', { name: 'Bloquear' }))
    const screenEl = await screen.findByRole('dialog', { name: 'Bloquear' })
    await waitFor(() => expect(activeListeners('blocked')).toHaveLength(1))
    return { user, screenEl }
  }

  it('blocks a number with a note, lists it and unblocks it', async () => {
    const { user, screenEl } = await openBlock()
    await act(async () => {
      emit('blocked', [])
    })
    expect(within(screenEl).getByText('Nenhum número bloqueado.')).toBeInTheDocument()

    const phone = within(screenEl).getByRole('textbox', { name: 'Telefone' })
    await user.type(phone, '87988887777')
    expect(phone).toHaveValue('(87) 98888-7777')
    await user.type(within(screenEl).getByRole('textbox', { name: /Observação/ }), 'Pedido falso')
    await user.click(within(screenEl).getByRole('button', { name: 'Bloquear número' }))

    await waitFor(() => expect(firebaseMocks.setDoc).toHaveBeenCalledTimes(2))
    const [[blockedRef, blockedData], [noteRef, noteData]] = firebaseMocks.setDoc.mock.calls as [
      [{ path: string }, Record<string, unknown>],
      [{ path: string }, Record<string, unknown>],
    ]
    expect(blockedRef.path).toBe(`blocked/${NUMBER}`)
    expect(blockedData).toMatchObject({ phone: NUMBER })
    expect(noteRef.path).toBe(`blockedNotes/${NUMBER}`)
    expect(noteData).toEqual({ note: 'Pedido falso' })
    expect(phone).toHaveValue('')

    await act(async () => {
      emit('blocked', [{ id: NUMBER, phone: NUMBER, createdAtMs: 2 }])
      emit('blockedNotes', [{ id: NUMBER, note: 'Pedido falso' }])
    })
    const card = within(screenEl).getByRole('article', { name: '+55 (87) 98888-7777' })
    expect(card).toHaveTextContent('Pedido falso')

    await user.click(within(card).getByRole('button', { name: /Desbloquear/ }))
    const removed = firebaseMocks.deleteDoc.mock.calls.map(([ref]) => (ref as { path: string }).path)
    expect(removed).toEqual([`blocked/${NUMBER}`, `blockedNotes/${NUMBER}`])
  })

  it('refuses an incomplete number and filters the list', async () => {
    const { user, screenEl } = await openBlock()
    await act(async () => {
      emit('blocked', [
        { id: '5587988887777', phone: '5587988887777', createdAtMs: 1 },
        { id: '5587911112222', phone: '5587911112222', createdAtMs: 2 },
      ])
      emit('blockedNotes', [{ id: '5587911112222', note: 'Trote' }])
    })
    await user.type(within(screenEl).getByRole('textbox', { name: 'Telefone' }), '8798888')
    await user.click(within(screenEl).getByRole('button', { name: 'Bloquear número' }))
    expect(await within(screenEl).findByRole('alert')).toHaveTextContent('Informe o telefone com DDD.')
    expect(firebaseMocks.setDoc).not.toHaveBeenCalled()

    const articles = () => within(screenEl).getAllByRole('article').map((item) => item.getAttribute('aria-label'))
    expect(articles()).toEqual(['+55 (87) 91111-2222', '+55 (87) 98888-7777'])
    await user.type(within(screenEl).getByRole('searchbox', { name: 'Buscar' }), '9888')
    expect(articles()).toEqual(['+55 (87) 98888-7777'])
    await user.clear(within(screenEl).getByRole('searchbox', { name: 'Buscar' }))
    await user.type(within(screenEl).getByRole('searchbox', { name: 'Buscar' }), 'trote')
    expect(articles()).toEqual(['+55 (87) 91111-2222'])
  })

  it('tells the admin to publish the rules when Firestore denies the list', async () => {
    const { screenEl } = await openBlock()
    const [listener] = activeListeners('blocked')
    await act(async () => {
      listener.error?.({ code: 'permission-denied' })
    })
    expect(within(screenEl).getByRole('alert')).toHaveTextContent('Publique as regras novas no Firebase')
  })
})

describe('customer blocked', () => {
  it('keeps a saved session on the loading screen at app open', async () => {
    vi.useFakeTimers()
    localStorage.setItem('smash.customerId', customerProfile.uid)
    blockedPhones.add(NUMBER)
    signInAs(customerProfile)
    render(<App />)

    await tick(2400)
    await tick(MAX_WAIT_MS + 1000)
    expectLocked()
    expect(localStorage.getItem('smash.customerId')).toBe(customerProfile.uid)
    expect(activeListeners('orders')).toHaveLength(0)
  })

  it('blocks by the login email even when the saved profile shows another phone', async () => {
    vi.useFakeTimers()
    blockedPhones.add(NUMBER)
    signInAs({ ...customerProfile, whatsapp: '5587900000000' })
    authState.user = { uid: customerProfile.uid, email: `${NUMBER}.r@${AUTH_EMAIL_DOMAIN}` } as typeof authState.user
    render(<App />)

    await tick(2400)
    await tick(MAX_WAIT_MS + 1000)
    expectLocked()
  })

  it('lets a customer in when the blocked lookup is denied before the rules are published', async () => {
    vi.useFakeTimers()
    blockedState.denied = true
    blockedPhones.add(NUMBER)
    localStorage.setItem('smash.customerId', customerProfile.uid)
    signInAs(customerProfile)
    render(<App />)

    await tick(100)
    await act(async () => {
      emit('orders', [makeOrder({ status: 'andamento' })])
    })
    await tick(2400)
    await tick(700)

    expect(firebaseMocks.blockedLookup).toHaveBeenCalled()
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('locks the app when the admin blocks a customer who is already inside', async () => {
    vi.useFakeTimers()
    localStorage.setItem('smash.customerId', customerProfile.uid)
    signInAs(customerProfile)
    render(<App />)
    await tick(100)
    await act(async () => {
      emit('orders', [makeOrder({ status: 'andamento' })])
    })
    await tick(2400)
    await tick(700)
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()

    expect(activeListeners(`blocked/${NUMBER}`)).toHaveLength(1)
    await act(async () => {
      emitDoc(`blocked/${NUMBER}`, { phone: NUMBER })
    })
    await tick(MAX_WAIT_MS + 1000)
    expectLocked()
  })

  it('locks the app at checkout when the typed phone is blocked, and sends no order', async () => {
    const saved = { ...customerProfile, uid: 'cliente-antigo', nome: 'Jameson' }
    blockedPhones.add(NUMBER)
    firebaseMocks.signInWithEmailAndPassword.mockImplementation(async (...args: unknown[]) => {
      const [, email] = args as [unknown, string]
      if (email === `${NUMBER}@${AUTH_EMAIL_DOMAIN}`) return { user: { uid: saved.uid, email } }
      throw Object.assign(new Error('auth/invalid-credential'), { code: 'auth/invalid-credential' })
    })
    firebaseMocks.getDoc.mockImplementation(async (...args: unknown[]) => {
      const [ref] = args as [{ path: string }]
      const data = ref.path === `users/${saved.uid}` ? saved : undefined
      return { exists: () => Boolean(data), data: () => data }
    })
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /Entrar no cardápio/ }, { timeout: 4000 }))
    await screen.findByRole('searchbox', { name: 'Buscar' }, { timeout: 4000 })
    act(() => {
      emit('categories', [{ id: 'burgers', name: 'Burgers', order: 1, destaque: false }])
      emit('products', [
        {
          id: 'smash-casa',
          name: 'Smash da casa',
          categoryId: 'burgers',
          price: 28,
          description: 'Pão e carne',
          image: '',
          available: true,
          extras: [],
        },
      ])
    })
    await user.click(await screen.findByRole('button', { name: /Smash da casa/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Adicionar' }))
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    await user.click(within(cart).getByRole('radio', { name: 'Pix' }))
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    const form = screen.getByRole('dialog', { name: 'Dados para entrega' })
    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '87988887777')

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Dados para entrega' })).not.toBeInTheDocument())
    expect(screen.queryByRole('searchbox', { name: 'Buscar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Entrar no cardápio/ })).not.toBeInTheDocument()
    expect(firebaseMocks.addDoc).not.toHaveBeenCalled()
  })
})
