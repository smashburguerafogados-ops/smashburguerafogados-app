import type { Category, Product } from '../data/catalog'
import { toCents } from './money'

const CATEGORY_KEY = 'smash.category'

/** All-products view. Not a Firestore category. */
export const HOME_CATEGORY = ''
export const HOME_LABEL = 'Início'

export type CartLine = {
  key: string
  productId: string
  name: string
  image: string
  priceCents: number
  note: string
  /** The add-ons chosen, so a saved cart can be rebuilt from the catalog. */
  extraIds?: string[]
  qty: number
}

export function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => {
    if (Boolean(a.destaque) !== Boolean(b.destaque)) return a.destaque ? -1 : 1
    if (a.order !== b.order) return a.order - b.order
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

export function sortProductsByCategory(products: Product[], categories: Category[]): Product[] {
  const rank = new Map(categories.map((category, index) => [category.id, index]))
  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const ra = rank.get(a.product.categoryId) ?? categories.length
      const rb = rank.get(b.product.categoryId) ?? categories.length
      return ra - rb || a.index - b.index
    })
    .map((entry) => entry.product)
}

export function readSavedCategory(): string {
  try {
    return sessionStorage.getItem(CATEGORY_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveCategory(id: string): void {
  try {
    if (id) sessionStorage.setItem(CATEGORY_KEY, id)
    else sessionStorage.removeItem(CATEGORY_KEY)
  } catch {
    // Session storage can be blocked. The menu still works for this view.
  }
}

export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

export function filterProducts(products: Product[], categoryId: string, search: string): Product[] {
  const query = foldText(search.trim())
  return products.filter((product) => {
    if (categoryId && product.categoryId !== categoryId) return false
    if (!query) return true
    return foldText(`${product.name} ${product.description}`).includes(query)
  })
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty, 0)
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0)
}

/** The cart line for a product with a note and the chosen extras. Same key rule everywhere. */
export function cartLineFor(product: Product, note: string, extraIds: string[]): Omit<CartLine, 'qty'> {
  const extras = (product.extras ?? []).filter((extra) => extraIds.includes(extra.id))
  const clean = note.trim()
  return {
    key: [product.id, clean, extras.map((extra) => extra.id).sort().join(',')].join('|'),
    productId: product.id,
    name: extras.length > 0 ? `${product.name} + ${extras.map((extra) => extra.name).join(', ')}` : product.name,
    image: product.image,
    priceCents: toCents(product.price) + extras.reduce((sum, extra) => sum + toCents(extra.price), 0),
    note: clean,
    extraIds: extras.map((extra) => extra.id).sort(),
  }
}

export function addCartLine(lines: CartLine[], next: Omit<CartLine, 'qty'>, qty = 1): CartLine[] {
  const amount = Math.max(1, Math.floor(qty))
  const found = lines.find((line) => line.key === next.key)
  if (!found) return [...lines, { ...next, qty: amount }]
  return lines.map((line) => (line.key === next.key ? { ...line, qty: line.qty + amount } : line))
}

export function removeCartLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((line) => line.key !== key)
}
