import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { CartSheet } from './components/CartSheet'
import { EMPTY_RAFFLE, activateRaffle, drawRaffle, eligibleCustomers, localDay, showHourglass, TITLE_REQUIRED } from './lib/raffle'
import type { Order } from './lib/orders'
import { activeListeners, emit, emitDoc, firebaseMocks } from './test/mocks'
import { adminProfile, customerProfile, Providers, renderApp, signInAs } from './test/render'

const noon = new Date(2026, 10, 18, 12).getTime()
const day = localDay(noon)

function order(patch: Partial<Order> & Pick<Order, 'id' | 'status' | 'customerId'>): Order {
  return {
    customerName: 'Ana Souza',
    customerWhatsapp: '5587988887777',
    address: null,
    items: [],
    totalCents: 2800,
    payment: { method: 'pix', needsChange: false, cashCents: null, changeCents: null },
    reason: '',
    createdAtMs: noon,
    ...patch,
  }
}

const sources = import.meta.glob(['./**/*.{ts,tsx}', '../index.html', '../README.md'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

it('spells Burger wherever a person can read it', () => {
  const files = Object.entries(sources).filter(([path]) => !path.endsWith('raffle.test.tsx'))
  expect(files.length).toBeGreaterThan(10)
  for (const [path, code] of files) {
    const visible = code.replace(/smashburguerafogados/gi, '')
    expect(visible, path).not.toMatch(/burguer/i)
  }
})

it('counts only customers with a finalized order that day', () => {
  const orders = [
    order({ id: 'hoje', status: 'finalizado', customerId: 'cliente-1', customerName: 'Ana Souza' }),
    order({ id: 'de-novo', status: 'finalizado', customerId: 'cliente-1', customerName: 'Ana Souza' }),
    order({ id: 'caminho', status: 'enviado', customerId: 'cliente-2', customerName: 'Bruno Lima' }),
    order({
      id: 'ontem',
      status: 'finalizado',
      customerId: 'cliente-3',
      customerName: 'Carla Dias',
      createdAtMs: noon - 24 * 60 * 60 * 1000,
    }),
    order({ id: 'outro', status: 'finalizado', customerId: 'cliente-4', customerName: 'Davi Nunes' }),
  ]
  expect(eligibleCustomers(orders, day).map((person) => person.id)).toEqual(['cliente-1', 'cliente-4'])
})

it('keeps the first winner and refuses an empty draw', async () => {
  const orders = [order({ id: 'hoje', status: 'finalizado', customerId: 'cliente-1' })]
  const raffle = { ...EMPTY_RAFFLE, active: true, day, title: 'Batata' }
  firebaseMocks.setDoc.mockClear()
  const drawn = await drawRaffle(raffle, [], () => 0)
  expect(drawn.kind).toBe('empty')
  expect(firebaseMocks.setDoc).not.toHaveBeenCalled()

  const first = await drawRaffle(raffle, orders, () => 0.99)
  expect(first).toMatchObject({ kind: 'drawn', winnerId: 'cliente-1', winnerName: 'Ana Souza' })
  firebaseMocks.setDoc.mockClear()
  const again = await drawRaffle({ ...raffle, winnerId: 'cliente-1', winnerName: 'Ana Souza' }, orders, () => 0)
  expect(again).toMatchObject({ kind: 'kept', winnerId: 'cliente-1' })
  expect(firebaseMocks.setDoc).not.toHaveBeenCalled()
  await expect(activateRaffle(EMPTY_RAFFLE, '   ')).rejects.toThrow(TITLE_REQUIRED)
})

it('hides the hourglass after dismiss or three days, and skips anyone without a finalized order', () => {
  const orders = [order({ id: 'hoje', status: 'finalizado', customerId: 'cliente-1' })]
  const raffle = { ...EMPTY_RAFFLE, active: true, day, title: 'Batata' }
  expect(showHourglass({ raffle, orders, customerId: 'cliente-2', dismissed: false, now: noon })).toBe(false)
  expect(
    showHourglass({
      raffle,
      orders: [order({ id: 'caminho', status: 'enviado', customerId: 'cliente-1' })],
      customerId: 'cliente-1',
      dismissed: false,
      now: noon,
    }),
  ).toBe(false)
  expect(showHourglass({ raffle, orders, customerId: 'cliente-1', dismissed: false, now: noon })).toBe(true)
  expect(
    showHourglass({
      raffle: { ...raffle, winnerId: 'cliente-4', winnerName: 'Davi Nunes' },
      orders,
      customerId: 'cliente-1',
      dismissed: true,
      now: noon,
    }),
  ).toBe(false)
  expect(
    showHourglass({
      raffle: { ...raffle, winnerId: 'cliente-4', winnerName: 'Davi Nunes' },
      orders,
      customerId: 'cliente-1',
      dismissed: false,
      now: noon + 3 * 24 * 60 * 60 * 1000,
    }),
  ).toBe(false)
})

it('tells the buyer that a finalized order today enters the raffle', async () => {
  render(
    <Providers>
      <CartSheet lines={[]} onClose={() => undefined} onRemove={() => undefined} onPlaced={() => undefined} />
    </Providers>,
  )
  await waitFor(() => expect(activeListeners('settings/raffle')).toHaveLength(1))
  expect(screen.queryByText(/entra no sorteio/)).not.toBeInTheDocument()
  await act(async () => {
    emitDoc('settings/raffle', { title: 'Batata grande', active: true, day: localDay(Date.now()), winnerId: '', winnerName: '', drawnAtMs: 0 })
  })
  expect(screen.getByText('Comprando hoje você entra no sorteio: Batata grande. Vale o pedido finalizado.')).toBeInTheDocument()
})

it('shows aguardando sorteio, then the winner, and dismisses only after the draw', async () => {
  signInAs(customerProfile)
  renderApp()
  await screen.findByRole('searchbox', { name: 'Buscar' })
  await waitFor(() => expect(activeListeners('settings/raffle')).toHaveLength(1))
  const today = localDay(Date.now())
  await act(async () => {
    emitDoc('settings/raffle', { title: 'Batata grande', active: true, day: today, winnerId: '', winnerName: '', drawnAtMs: 0 })
    emit('orders', [
      {
        id: 'pedido-1',
        customerId: 'cliente-1',
        customerName: 'Ana Souza',
        status: 'enviado',
        createdAtMs: Date.now(),
        totalCents: 2800,
        payment: { method: 'pix' },
        items: [],
      },
    ])
  })
  expect(screen.queryByRole('button', { name: 'Ampulheta do sorteio' })).not.toBeInTheDocument()

  await act(async () => {
    emit('orders', [
      {
        id: 'pedido-1',
        customerId: 'cliente-1',
        customerName: 'Ana Souza',
        status: 'finalizado',
        createdAtMs: Date.now(),
        totalCents: 2800,
        payment: { method: 'pix' },
        items: [],
      },
    ])
  })
  fireEvent.click(screen.getByRole('button', { name: 'Ampulheta do sorteio' }))
  expect(screen.getByRole('dialog', { name: 'Sorteio' })).toHaveTextContent('aguardando sorteio')
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  expect(screen.getByRole('button', { name: 'Ampulheta do sorteio' })).toBeInTheDocument()
  expect(firebaseMocks.setDoc).not.toHaveBeenCalledWith(
    expect.objectContaining({ path: expect.stringContaining('raffleDismissals') }),
    expect.anything(),
  )

  await act(async () => {
    emitDoc('settings/raffle', {
      title: 'Batata grande',
      active: true,
      day: today,
      winnerId: 'cliente-4',
      winnerName: 'Davi Nunes',
      drawnAtMs: Date.now(),
    })
  })
  fireEvent.click(screen.getByRole('button', { name: 'Ampulheta do sorteio' }))
  expect(screen.getByRole('dialog', { name: 'Sorteio' })).toHaveTextContent('Davi Nunes')
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  expect(screen.queryByRole('button', { name: 'Ampulheta do sorteio' })).not.toBeInTheDocument()
  expect(firebaseMocks.setDoc).toHaveBeenCalledWith(
    { path: `raffleDismissals/cliente-1_${today}` },
    { customerId: 'cliente-1', day: today },
  )
})

it('blocks an empty title, reports nobody eligible, and does not redraw', async () => {
  signInAs(adminProfile)
  const user = userEvent.setup()
  renderApp('/admin')
  await screen.findByRole('heading', { name: 'Painel' })
  expect(screen.queryByRole('button', { name: 'Ampulheta do sorteio' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
  await user.click(screen.getByRole('button', { name: 'Sorteio Smash Burger' }))
  const sheet = screen.getByRole('dialog', { name: 'Sorteio Smash Burger' })
  await user.click(screen.getByRole('button', { name: 'Ativar sorteio de hoje' }))
  expect(sheet).toHaveTextContent(TITLE_REQUIRED)
  expect(firebaseMocks.setDoc).not.toHaveBeenCalled()

  await user.type(screen.getByRole('textbox'), 'Batata grande')
  await user.click(screen.getByRole('button', { name: 'Ativar sorteio de hoje' }))
  expect(firebaseMocks.setDoc).toHaveBeenCalledWith(
    { path: 'settings/raffle' },
    expect.objectContaining({ title: 'Batata grande', active: true, day: localDay(Date.now()), winnerId: '' }),
    { merge: true },
  )
  await act(async () => {
    emitDoc('settings/raffle', {
      title: 'Batata grande',
      active: true,
      day: localDay(Date.now()),
      winnerId: '',
      winnerName: '',
      drawnAtMs: 0,
    })
    emit('orders', [
      {
        id: 'caminho',
        customerId: 'cliente-2',
        customerName: 'Bruno Lima',
        status: 'enviado',
        createdAtMs: Date.now(),
        totalCents: 1600,
        payment: { method: 'pix' },
        items: [],
      },
    ])
  })
  firebaseMocks.setDoc.mockClear()
  await user.click(screen.getByRole('button', { name: 'Sortear' }))
  expect(sheet).toHaveTextContent('Ninguém com pedido finalizado hoje para sortear.')
  expect(firebaseMocks.setDoc).not.toHaveBeenCalled()

  await act(async () => {
    emit('orders', [
      {
        id: 'hoje',
        customerId: 'cliente-1',
        customerName: 'Ana Souza',
        status: 'finalizado',
        createdAtMs: Date.now(),
        totalCents: 2800,
        payment: { method: 'pix' },
        items: [],
      },
      {
        id: 'caminho',
        customerId: 'cliente-2',
        customerName: 'Bruno Lima',
        status: 'enviado',
        createdAtMs: Date.now(),
        totalCents: 1600,
        payment: { method: 'pix' },
        items: [],
      },
    ])
  })
  await user.click(screen.getByRole('button', { name: 'Sortear' }))
  expect(firebaseMocks.setDoc).toHaveBeenCalledWith(
    { path: 'settings/raffle' },
    expect.objectContaining({ winnerId: 'cliente-1', winnerName: 'Ana Souza' }),
    { merge: true },
  )
  firebaseMocks.setDoc.mockClear()
  await user.click(screen.getByRole('button', { name: 'Sortear' }))
  expect(sheet).toHaveTextContent('Ganhador: Ana Souza')
  expect(firebaseMocks.setDoc).not.toHaveBeenCalled()
})
