import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * A product photo can live in two places:
 * - legacy: a data URL in products/{id}.image, downloaded with the whole menu;
 * - current: productPhotos/{id}.image, read one photo at a time, only when
 *   its card is about to show. products/{id}.photoVersion marks this case.
 * The menu turns photoVersion into a "photo:{id}@{version}" reference, so cart
 * lines, reorder plans and orders keep carrying a plain image string.
 */
export const PHOTOS = 'productPhotos'
export const PHOTO_BACKUPS = 'productPhotoBackups'
const PREFIX = 'photo:'

export const FALLBACK_IMAGE = `${import.meta.env.BASE_URL}menu/smash.svg`
export const PHOTO_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect width='1' height='1' fill='%23141416'/%3E%3C/svg%3E"

export function photoRef(id: string, version: number): string {
  return `${PREFIX}${id}@${version}`
}

export function parsePhotoRef(src: string): { id: string; version: number } | null {
  if (!src.startsWith(PREFIX)) return null
  const at = src.lastIndexOf('@')
  if (at <= PREFIX.length) return null
  const version = Number(src.slice(at + 1))
  if (!Number.isFinite(version)) return null
  return { id: src.slice(PREFIX.length, at), version }
}

export function isPhotoRef(src: string): boolean {
  return parsePhotoRef(src) !== null
}

export function isPermissionDenied(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'permission-denied'
}

const DB_NAME = 'smash-fotos'
const STORE = 'fotos'
type Stored = { version: number; image: string }
let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

async function readStored(id: string): Promise<Stored | undefined> {
  const database = await openDb()
  if (!database) return undefined
  return new Promise((resolve) => {
    try {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(id)
      request.onsuccess = () => resolve(request.result as Stored | undefined)
      request.onerror = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
}

async function writeStored(id: string, value: Stored): Promise<void> {
  const database = await openDb()
  if (!database) return
  try {
    database.transaction(STORE, 'readwrite').objectStore(STORE).put(value, id)
  } catch {
    // A full or blocked IndexedDB only costs a download next visit.
  }
}

// Visible cards ask first; a long menu does not open dozens of reads at once.
const MAX_PARALLEL = 4
let running = 0
const waiting: Array<() => void> = []

async function inSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve))
  running += 1
  try {
    return await task()
  } finally {
    running -= 1
    waiting.shift()?.()
  }
}

const pending = new Map<string, Promise<string>>()
const loaded = new Map<string, string>()

/** The photo for a reference when it is already in memory. Plain URLs come back as they are. */
export function peekPhoto(src: string): string | undefined {
  if (!isPhotoRef(src)) return src
  return loaded.get(src)
}

/** Memory, then this device (IndexedDB), then productPhotos/{id}. Rejects when there is no photo to show. */
export function loadPhoto(src: string): Promise<string> {
  const ref = parsePhotoRef(src)
  if (!ref) return Promise.resolve(src)
  const known = pending.get(src)
  if (known) return known
  const task = (async () => {
    const stored = await readStored(ref.id)
    if (stored && stored.version === ref.version && stored.image) return stored.image
    const snapshot = await inSlot(() => getDoc(doc(db, PHOTOS, ref.id)))
    const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : undefined
    const image = data?.image
    if (typeof image !== 'string' || !image) throw new Error('Foto não encontrada.')
    void writeStored(ref.id, { version: ref.version, image })
    return image
  })()
  pending.set(src, task)
  task.then(
    (image) => loaded.set(src, image),
    () => pending.delete(src),
  )
  return task
}

/** Test hook: forget every photo read in this page. */
export function forgetPhotos(): void {
  pending.clear()
  loaded.clear()
}

/**
 * Saves the photo in productPhotos/{id} and returns its version. Returns null
 * when Firestore refuses the write (the new rules are not published yet), so
 * the caller keeps the photo inside the product, as before.
 */
export async function savePhotoDoc(productId: string, image: string, now = Date.now()): Promise<number | null> {
  try {
    await setDoc(doc(db, PHOTOS, productId), { image, updatedAtMs: now })
    return now
  } catch (error) {
    if (isPermissionDenied(error)) return null
    throw error
  }
}

export async function readPhotoDoc(productId: string): Promise<string> {
  const snapshot = await getDoc(doc(db, PHOTOS, productId))
  const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : undefined
  return typeof data?.image === 'string' ? data.image : ''
}

export async function deletePhotoDoc(productId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, PHOTOS, productId))
  } catch {
    // Without the new rules there is no photo document to delete.
  }
}
