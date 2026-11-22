import type { Product } from '../data/catalog'
import { cartLineFor, type CartLine } from './menu'
import type { Order } from './orders'

export const REORDER_LIMIT = 3

export type ReorderEntry = { line: Omit<CartLine, 'qty'>; qty: number }

export type ReorderLineStatus = 'ok' | 'esgotado' | 'ausente'

/** One purchased item as the panel shows it today. */
export type ReorderLine = {
  key: string
  name: string
  image: string
  qty: number
  status: ReorderLineStatus
  /** Current unit price, extras included. Null when the item cannot be ordered again. */
  unitCents: number | null
  note: string
  extras: string[]
  /** Extras of the old order that no longer exist. */
  goneExtras: string[]
}

export type ReorderPlan = {
  orderId: string
  createdAtMs: number
  entries: ReorderEntry[]
  /** Units in the original order. */
  wanted: number
  /** Units that can be ordered again today. */
  available: number
  totalCents: number
  images: string[]
  lines: ReorderLine[]
}

/** Latest orders the customer can repeat: refused and cancelled ones never count. */
export function recentOrders(orders: Order[]): Order[] {
  return orders
    .filter((order) => order.status !== 'recusado' && order.status !== 'cancelado' && order.items.length > 0)
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, REORDER_LIMIT)
}

/**
 * Rebuilds an old order from today's cardápio. The price is the current one,
 * the note is repeated, and extras come back only when they still exist.
 * Products that are gone or sold out are skipped.
 */
export function planReorder(order: Order, products: Product[]): ReorderPlan {
  const byId = new Map(products.map((product) => [product.id, product]))
  const entries: ReorderEntry[] = []
  const images: string[] = []
  const lines: ReorderLine[] = []
  let wanted = 0
  let available = 0
  let totalCents = 0

  for (const [index, item] of order.items.entries()) {
    const qty = Math.max(1, Math.floor(item.qty))
    wanted += qty
    const product = byId.get(item.productId)
    const key = `${item.productId}-${index}`
    if (!product) {
      lines.push({ key, name: item.name, image: item.image, qty, status: 'ausente', unitCents: null, note: item.note, extras: [], goneExtras: [] })
      continue
    }
    if (!product.available) {
      lines.push({ key, name: product.name, image: product.image, qty, status: 'esgotado', unitCents: null, note: item.note, extras: [], goneExtras: [] })
      continue
    }
    const extraNames = item.name.startsWith(`${product.name} + `)
      ? item.name.slice(product.name.length + 3).split(', ')
      : []
    const extraIds = (product.extras ?? []).filter((extra) => extraNames.includes(extra.name)).map((extra) => extra.id)
    const line = cartLineFor(product, item.note, extraIds)
    entries.push({ line, qty })
    const keptNames = (product.extras ?? []).filter((extra) => extraIds.includes(extra.id)).map((extra) => extra.name)
    lines.push({
      key,
      name: product.name,
      image: product.image,
      qty,
      status: 'ok',
      unitCents: line.priceCents,
      note: line.note,
      extras: keptNames,
      goneExtras: extraNames.filter((name) => !keptNames.includes(name)),
    })
    available += qty
    totalCents += line.priceCents * qty
    if (!images.includes(product.image)) images.push(product.image)
  }

  return { orderId: order.id, createdAtMs: order.createdAtMs, entries, wanted, available, totalCents, images, lines }
}

export function formatOrderWhen(ms: number, now: number = Date.now()): string {
  if (!ms) return ''
  const date = new Date(ms)
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (now - ms < 6 * 24 * 60 * 60 * 1000 && now >= ms) {
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${time}`
  }
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `${day} ${time}`
}
