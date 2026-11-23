import type { Product } from '../data/catalog'
import { addCartLine, cartLineFor, type CartLine } from './menu'

const CART_KEY = 'smash.cart'
const CART_VERSION = 1
const CART_TTL_MS = 24 * 60 * 60 * 1000
const MAX_LINES = 60
const MAX_QTY = 99

/** What survives a reload: which product, the note, the chosen extras and how many. Names and prices come from the catalog. */
export type SavedLine = {
  productId: string
  name: string
  note: string
  extraIds: string[]
  qty: number
}

export type RestoredCart = {
  lines: CartLine[]
  /** Names of the items that are no longer sold. */
  dropped: string[]
  /** Names of the items that lost an add-on the shop no longer offers. */
  trimmed: string[]
}

function asText(value: unknown, max: number): string | null {
  return typeof value === 'string' ? value.slice(0, max) : null
}

function readLine(value: unknown): SavedLine | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const productId = asText(raw.productId, 120)
  const name = asText(raw.name, 120)
  const note = asText(raw.note, 400)
  if (!productId || name === null || note === null) return null
  if (!Array.isArray(raw.extraIds) || !raw.extraIds.every((id) => typeof id === 'string')) return null
  const qty = typeof raw.qty === 'number' && Number.isFinite(raw.qty) ? Math.floor(raw.qty) : 0
  if (qty < 1) return null
  return {
    productId,
    name,
    note,
    extraIds: (raw.extraIds as string[]).slice(0, 20),
    qty: Math.min(qty, MAX_QTY),
  }
}

/** Anything unreadable, from another version or older than a day counts as an empty cart. */
export function readSavedCart(now = Date.now()): SavedLine[] {
  try {
    const text = localStorage.getItem(CART_KEY)
    if (!text) return []
    const data = JSON.parse(text) as Record<string, unknown> | null
    if (!data || typeof data !== 'object' || data.v !== CART_VERSION) return []
    if (typeof data.savedAt !== 'number' || now - data.savedAt > CART_TTL_MS || data.savedAt > now + 60_000) return []
    if (!Array.isArray(data.lines)) return []
    return data.lines
      .slice(0, MAX_LINES)
      .map(readLine)
      .filter((line): line is SavedLine => line !== null)
  } catch {
    return []
  }
}

export function saveCart(lines: CartLine[], now = Date.now()): void {
  try {
    if (lines.length === 0) {
      localStorage.removeItem(CART_KEY)
      return
    }
    const saved: SavedLine[] = lines.map((line) => ({
      productId: line.productId,
      name: line.name,
      note: line.note,
      extraIds: line.extraIds ?? [],
      qty: line.qty,
    }))
    localStorage.setItem(CART_KEY, JSON.stringify({ v: CART_VERSION, savedAt: now, lines: saved }))
  } catch {
    // Storage can be blocked or full. The cart still works for this view.
  }
}

export function clearSavedCart(): void {
  try {
    localStorage.removeItem(CART_KEY)
  } catch {
    // Nothing to clear when storage is blocked.
  }
}

/**
 * Rebuilds the cart from the current catalog. Prices and names are always the
 * catalog's, never what was saved. A product that is gone or sold out is dropped.
 */
export function restoreCart(saved: SavedLine[], products: Product[]): RestoredCart {
  const byId = new Map(products.map((product) => [product.id, product]))
  const dropped: string[] = []
  const trimmed: string[] = []
  let lines: CartLine[] = []
  for (const entry of saved) {
    const product = byId.get(entry.productId)
    if (!product || !product.available) {
      dropped.push(entry.name || 'Item')
      continue
    }
    const offered = new Set((product.extras ?? []).map((extra) => extra.id))
    const extraIds = entry.extraIds.filter((id) => offered.has(id))
    if (extraIds.length < entry.extraIds.length) trimmed.push(product.name)
    lines = addCartLine(lines, cartLineFor(product, entry.note, extraIds), entry.qty)
  }
  return { lines, dropped, trimmed }
}

export function restoreNotice(restored: Pick<RestoredCart, 'dropped' | 'trimmed'>): string {
  const parts: string[] = []
  if (restored.dropped.length > 0) {
    parts.push(`Não estão mais disponíveis e saíram do carrinho: ${restored.dropped.join(', ')}.`)
  }
  if (restored.trimmed.length > 0) {
    parts.push(`Adicional indisponível removido de: ${restored.trimmed.join(', ')}.`)
  }
  return parts.join(' ')
}
