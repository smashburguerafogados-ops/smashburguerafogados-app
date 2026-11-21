import { collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore'
import type { Catalog, Category, Extra, Product } from '../data/catalog'
import { db } from './firebase'
import { isCategoryIconKey } from './categoryIcons'
import { sortCategories } from './menu'

const FALLBACK_IMAGE = `${import.meta.env.BASE_URL}menu/smash.svg`

function asExtra(value: unknown): Extra | null {
  if (!value || typeof value !== 'object') return null
  const extra = value as Record<string, unknown>
  if (typeof extra.id !== 'string' || typeof extra.name !== 'string' || typeof extra.price !== 'number') {
    return null
  }
  return { id: extra.id, name: extra.name, price: extra.price }
}

function readCategory(id: string, data: Record<string, unknown>): Category | null {
  if (typeof data.name !== 'string') return null
  return {
    id,
    name: data.name,
    order: typeof data.order === 'number' ? data.order : 0,
    destaque: data.destaque === true,
    ...(isCategoryIconKey(data.icon) ? { icon: data.icon } : {}),
  }
}

function readProduct(id: string, data: Record<string, unknown>): Product | null {
  if (typeof data.name !== 'string' || typeof data.price !== 'number') return null
  const categoryId = typeof data.categoryId === 'string' ? data.categoryId : ''
  const extras = Array.isArray(data.extras)
    ? data.extras.map(asExtra).filter((item): item is Extra => item !== null)
    : []
  return {
    id,
    categoryId,
    name: data.name,
    description: typeof data.description === 'string' ? data.description : '',
    price: data.price,
    image: typeof data.image === 'string' && data.image.length > 0 ? data.image : FALLBACK_IMAGE,
    available: data.available !== false,
    extras: extras.length > 0 ? extras : undefined,
  }
}

type Snapshot = { empty?: boolean; docs: unknown[]; metadata?: { fromCache?: boolean } }

/** Offline, Firestore answers from an empty local cache: that is "no answer yet", not "no menu". */
function isEmptyCache(snapshot: Snapshot): boolean {
  return snapshot.metadata?.fromCache === true && snapshot.docs.length === 0
}

export const CATALOG_TIMEOUT_MS = 15000

/**
 * Keeps the customer menu on the Firestore cardápio. The first callback waits
 * until both listeners have answered from the server, so neither the built-in
 * sample nor an empty offline cache flashes "Nenhum item encontrado".
 * Later snapshots (create, edit, delete) replace what is on screen.
 * If nothing arrives in CATALOG_TIMEOUT_MS, onError fires once; the listeners
 * keep running and a late answer still publishes.
 */
export function watchRemoteCatalog(onNext: (catalog: Catalog) => void, onError: () => void): Unsubscribe {
  let categories: Category[] | null = null
  let products: Product[] | null = null
  let stopped = false
  let published = false

  const timer = setTimeout(() => {
    if (!stopped && !published) onError()
  }, CATALOG_TIMEOUT_MS)

  function publish() {
    if (stopped || !categories || !products) return
    published = true
    clearTimeout(timer)
    onNext({ categories: sortCategories(categories), products })
  }

  const stopCategories = onSnapshot(
    collection(db, 'categories'),
    (snapshot) => {
      if (isEmptyCache(snapshot)) return
      categories = snapshot.docs
        .map((entry) => readCategory(entry.id, entry.data() as Record<string, unknown>))
        .filter((item): item is Category => item !== null)
      publish()
    },
    () => onError(),
  )

  const stopProducts = onSnapshot(
    query(collection(db, 'products'), where('available', '==', true)),
    (snapshot) => {
      if (isEmptyCache(snapshot)) return
      products = snapshot.docs
        .map((entry) => readProduct(entry.id, entry.data() as Record<string, unknown>))
        .filter((item): item is Product => item !== null)
      publish()
    },
    () => onError(),
  )

  return () => {
    stopped = true
    clearTimeout(timer)
    stopCategories()
    stopProducts()
  }
}
