import type { Category, Product } from '../data/catalog'

const CATEGORY_KEY = 'smash.category'

export type CartLine = {
  key: string
  productId: string
  name: string
  image: string
  priceCents: number
  note: string
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

export function addCartLine(lines: CartLine[], next: Omit<CartLine, 'qty'>): CartLine[] {
  const found = lines.find((line) => line.key === next.key)
  if (!found) return [...lines, { ...next, qty: 1 }]
  return lines.map((line) => (line.key === next.key ? { ...line, qty: line.qty + 1 } : line))
}

export function removeCartLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((line) => line.key !== key)
}
