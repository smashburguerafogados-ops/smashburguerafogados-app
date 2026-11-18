import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { Order, OrderStatus } from './orders'

export type RevenueFilter = 'geral' | 'dia' | 'semana' | 'quinzena' | 'mensal' | 'total'

export type RevenueEntry = {
  orderId: string
  totalCents: number
  finalizedAtMs: number
}

export const REVENUE_FILTERS: RevenueFilter[] = ['geral', 'dia', 'semana', 'quinzena', 'mensal', 'total']

export const REVENUE_LABEL: Record<RevenueFilter, string> = {
  geral: 'Geral',
  dia: 'Dia',
  semana: 'Semana',
  quinzena: 'Quinzena',
  mensal: 'Mensal',
  total: 'Total',
}

/** Em andamento covers preparo and the delivery that follows it. */
export function countsAsRevenue(from: OrderStatus): boolean {
  return from === 'andamento' || from === 'enviado'
}

export function periodStart(filter: RevenueFilter, now: Date): number | null {
  if (filter === 'geral' || filter === 'total') return null
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (filter === 'dia') return start.getTime()
  if (filter === 'semana') {
    const day = start.getDay()
    const mondayOffset = day === 0 ? 6 : day - 1
    start.setDate(start.getDate() - mondayOffset)
    return start.getTime()
  }
  if (filter === 'quinzena') {
    start.setDate(start.getDate() <= 15 ? 1 : 16)
    return start.getTime()
  }
  start.setDate(1)
  return start.getTime()
}

export function revenueTotal(entries: RevenueEntry[], filter: RevenueFilter, now = new Date()): number {
  const start = periodStart(filter, now)
  return entries.reduce((sum, entry) => {
    if (start !== null && entry.finalizedAtMs < start) return sum
    return sum + entry.totalCents
  }, 0)
}

export function watchRevenue(onNext: (entries: RevenueEntry[]) => void, onError: () => void): () => void {
  return onSnapshot(
    collection(db, 'faturamento'),
    (snapshot) => {
      const entries: RevenueEntry[] = []
      snapshot.docs.forEach((entry) => {
        const data = entry.data() as Record<string, unknown>
        const totalCents = typeof data.totalCents === 'number' ? data.totalCents : 0
        const finalizedAtMs = typeof data.finalizedAtMs === 'number' ? data.finalizedAtMs : 0
        if (totalCents <= 0) return
        entries.push({ orderId: entry.id, totalCents, finalizedAtMs })
      })
      onNext(entries)
    },
    () => onError(),
  )
}

export async function recordRevenue(order: Order, at = Date.now()): Promise<void> {
  if (!countsAsRevenue(order.status)) return
  try {
    await setDoc(doc(db, 'faturamento', order.id), {
      orderId: order.id,
      totalCents: order.totalCents,
      finalizedAtMs: at,
    })
  } catch {
    // The first write stands. A later status change does not remove it.
  }
}
