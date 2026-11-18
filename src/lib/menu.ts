import type { Product } from '../data/catalog'

const CATEGORY_KEY = 'smash.category'

export type CartLine = {
  key: string
  productId: string
  name: string
  priceCents: number
  note: string
  qty: number
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

export function filterProducts(products: Product[], categoryId: string, search: string): Product[] {
  const query = search.trim().toLocaleLowerCase('pt-BR')
  return products.filter((product) => {
    if (categoryId && product.categoryId !== categoryId) return false
    if (!query) return true
    const haystack = `${product.name} ${product.description}`.toLocaleLowerCase('pt-BR')
    return haystack.includes(query)
  })
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty, 0)
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0)
}

export function addCartLine(lines: CartLine[], next: Omit<CartLine, 'qty'>): CartLine[] {
  const found = lines.find((line) => line.key === next.key)
  if (!found) return [...lines, { ...next, qty: 1 }]
  return lines.map((line) => (line.key === next.key ? { ...line, qty: line.qty + 1 } : line))
}

export function removeCartLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((line) => line.key !== key)
}
