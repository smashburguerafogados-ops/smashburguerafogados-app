import { collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore'
import type { Catalog, Category, Extra, Product } from '../data/catalog'
import { db } from './firebase'
import { isCategoryIconKey } from './categoryIcons'
import { sortCategories } from './menu'
import { FALLBACK_IMAGE, photoRef } from './productPhotos'

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

/** A photo inside the product (legacy) wins; otherwise a productPhotos reference; otherwise the default image. */
export function productImage(id: string, data: Record<string, unknown>, fallback: string): string {
  if (typeof data.image === 'string' && data.image.length > 0) return data.image
  if (typeof data.photoVersion === 'number' && Number.isFinite(data.photoVersion)) return photoRef(id, data.photoVersion)
  return fallback
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
    image: productImage(id, data, FALLBACK_IMAGE),
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

type Watcher = { onNext: (catalog: Catalog) => void; onError: () => void }

type Shared = {
  watchers: Set<Watcher>
  warm: Set<Watcher>
  latest: Catalog | null
  failed: boolean
  stop: Unsubscribe
}

let shared: Shared | null = null
let settled = false
const settledListeners = new Set<() => void>()

function markSettled() {
  if (settled) return
  settled = true
  for (const listener of [...settledListeners]) listener()
}

/** True once the menu has answered or given up, so heavy decoration can start without competing with it. */
export function catalogSettled(): boolean {
  return settled
}

export function onCatalogSettled(listener: () => void): () => void {
  settledListeners.add(listener)
  return () => settledListeners.delete(listener)
}

/** Test hook: closes the shared listeners and forgets that the menu answered. */
export function forgetCatalogState(): void {
  shared?.stop()
  shared = null
  settled = false
  settledListeners.clear()
}

function openShared(): Shared {
  const state: Shared = { watchers: new Set(), warm: new Set(), latest: null, failed: false, stop: () => undefined }
  let categories: Category[] | null = null
  let products: Product[] | null = null
  let stopped = false

  function fail() {
    if (stopped) return
    state.failed = true
    markSettled()
    for (const watcher of [...state.watchers, ...state.warm]) watcher.onError()
  }

  const timer = setTimeout(() => {
    if (!state.latest) fail()
  }, CATALOG_TIMEOUT_MS)

  function publish() {
    if (stopped || !categories || !products) return
    clearTimeout(timer)
    state.latest = { categories: sortCategories(categories), products }
    state.failed = false
    markSettled()
    for (const watcher of [...state.watchers, ...state.warm]) watcher.onNext(state.latest)
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
    () => fail(),
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
    () => fail(),
  )

  state.stop = () => {
    stopped = true
    clearTimeout(timer)
    stopCategories()
    stopProducts()
  }
  return state
}

function release(state: Shared) {
  if (state.watchers.size > 0 || state.warm.size > 0) return
  state.stop()
  if (shared === state) shared = null
}

/**
 * Starts reading the menu before the menu screen exists (during the opening
 * screen). The hold ends when a screen starts watching, or when the returned
 * function runs.
 */
export function prefetchRemoteCatalog(): Unsubscribe {
  const state = shared ?? (shared = openShared())
  const hold: Watcher = { onNext: () => undefined, onError: () => undefined }
  state.warm.add(hold)
  return () => {
    state.warm.delete(hold)
    release(state)
  }
}

/**
 * Keeps the customer menu on the Firestore cardápio. The first callback waits
 * until both listeners have answered from the server, so neither the built-in
 * sample nor an empty offline cache flashes "Nenhum item encontrado".
 * Later snapshots (create, edit, delete) replace what is on screen.
 * If nothing arrives in CATALOG_TIMEOUT_MS, onError fires once; the listeners
 * keep running and a late answer still publishes.
 */
export function watchRemoteCatalog(onNext: (catalog: Catalog) => void, onError: () => void): Unsubscribe {
  const state = shared ?? (shared = openShared())
  const watcher: Watcher = { onNext, onError }
  state.watchers.add(watcher)
  state.warm.clear()
  if (state.latest) onNext(state.latest)
  else if (state.failed) onError()
  return () => {
    state.watchers.delete(watcher)
    release(state)
  }
}
