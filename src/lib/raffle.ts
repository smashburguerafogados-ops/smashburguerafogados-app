import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { Order } from './orders'

export const RAFFLE_DOC = 'settings/raffle'
export const EMPTY_DRAW_MESSAGE = 'Ninguém com pedido finalizado hoje para sortear.'
export const WAITING_MESSAGE = 'aguardando sorteio'
export const TITLE_REQUIRED = 'Informe o que será sorteado.'
export const RAFFLE_DAYS = 3

export type Raffle = {
  title: string
  active: boolean
  day: string
  winnerId: string
  winnerName: string
  drawnAtMs: number
}

export const EMPTY_RAFFLE: Raffle = {
  title: '',
  active: false,
  day: '',
  winnerId: '',
  winnerName: '',
  drawnAtMs: 0,
}

export type Entrant = { id: string; name: string }

export type DrawOutcome =
  | { kind: 'kept'; winnerId: string; winnerName: string }
  | { kind: 'empty' }
  | { kind: 'drawn'; winnerId: string; winnerName: string }

export function localDay(ms: number): string {
  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function dayStart(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date).getTime()
}

export function raffleExpired(day: string, now: number): boolean {
  if (!day) return true
  return now >= dayStart(day) + RAFFLE_DAYS * 24 * 60 * 60 * 1000
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function readRaffle(data: Record<string, unknown> | undefined): Raffle {
  if (!data) return EMPTY_RAFFLE
  return {
    title: asString(data.title),
    active: data.active === true,
    day: asString(data.day),
    winnerId: asString(data.winnerId),
    winnerName: asString(data.winnerName),
    drawnAtMs: typeof data.drawnAtMs === 'number' ? data.drawnAtMs : 0,
  }
}

/** One entry per customer with a finalized order created on that local day. */
export function eligibleCustomers(orders: Order[], day: string): Entrant[] {
  const names = new Map<string, string>()
  for (const order of orders) {
    if (order.status !== 'finalizado') continue
    if (!order.customerId || localDay(order.createdAtMs) !== day) continue
    if (!names.has(order.customerId)) names.set(order.customerId, order.customerName.trim() || 'Cliente')
  }
  return [...names.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function customerBought(orders: Order[], customerId: string, day: string): boolean {
  return eligibleCustomers(orders, day).some((person) => person.id === customerId)
}

export function showHourglass(input: {
  raffle: Raffle
  orders: Order[]
  customerId: string
  dismissed: boolean
  now: number
}): boolean {
  const { raffle, orders, customerId, dismissed, now } = input
  if (!raffle.active || !customerId || !raffle.day) return false
  if (!customerBought(orders, customerId, raffle.day)) return false
  if (raffleExpired(raffle.day, now)) return false
  if (raffle.winnerId && dismissed) return false
  return true
}

export function watchRaffle(onNext: (raffle: Raffle) => void, onError: () => void): () => void {
  return onSnapshot(
    doc(db, 'settings', 'raffle'),
    (snapshot) => onNext(readRaffle(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : undefined)),
    () => onError(),
  )
}

export function watchDismissal(
  customerId: string,
  day: string,
  onNext: (dismissed: boolean) => void,
  onError: () => void,
): () => void {
  if (!customerId || !day) return () => undefined
  return onSnapshot(
    doc(db, 'raffleDismissals', `${customerId}_${day}`),
    (snapshot) => onNext(snapshot.exists()),
    () => onError(),
  )
}

export async function activateRaffle(current: Raffle, title: string, now = Date.now()): Promise<void> {
  const clean = title.trim()
  if (!clean) throw new Error(TITLE_REQUIRED)
  const day = localDay(now)
  const sameDay = current.day === day
  await setDoc(
    doc(db, 'settings', 'raffle'),
    {
      title: clean,
      active: true,
      day,
      winnerId: sameDay ? current.winnerId : '',
      winnerName: sameDay ? current.winnerName : '',
      drawnAtMs: sameDay ? current.drawnAtMs : 0,
    },
    { merge: true },
  )
}

export async function drawRaffle(
  raffle: Raffle,
  orders: Order[],
  random: () => number = Math.random,
  now = Date.now(),
): Promise<DrawOutcome> {
  if (raffle.winnerId) return { kind: 'kept', winnerId: raffle.winnerId, winnerName: raffle.winnerName }
  const people = eligibleCustomers(orders, raffle.day)
  if (people.length === 0) return { kind: 'empty' }
  const index = Math.min(people.length - 1, Math.floor(random() * people.length))
  const winner = people[index]
  await setDoc(
    doc(db, 'settings', 'raffle'),
    { winnerId: winner.id, winnerName: winner.name, drawnAtMs: now },
    { merge: true },
  )
  return { kind: 'drawn', winnerId: winner.id, winnerName: winner.name }
}

export async function dismissRaffle(customerId: string, day: string): Promise<void> {
  await setDoc(doc(db, 'raffleDismissals', `${customerId}_${day}`), { customerId, day })
}
