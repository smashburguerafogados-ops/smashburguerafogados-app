import { vi } from 'vitest'

type AnyFn = (...args: unknown[]) => unknown

export type RefLike = { path: string; constraints?: unknown[] }

type Listener = {
  ref: RefLike
  next: (snapshot: unknown) => void
  error?: (error: unknown) => void
  active: boolean
}

export const listeners: Listener[] = []

export const authState: { user: { uid: string } | null } = { user: null }

export const firebaseMocks = {
  signInWithEmailAndPassword: vi.fn<AnyFn>(),
  signOut: vi.fn<AnyFn>(async () => undefined),
  getDoc: vi.fn<AnyFn>(async () => ({ exists: () => false, data: () => undefined })),
  getDocs: vi.fn<AnyFn>(async () => ({ empty: true, docs: [] })),
  setDoc: vi.fn<AnyFn>(),
  addDoc: vi.fn<AnyFn>(async () => ({ id: 'pedido-abc12' })),
  updateDoc: vi.fn<AnyFn>(async () => undefined),
  deleteDoc: vi.fn<AnyFn>(async () => undefined),
  onSnapshot: vi.fn<AnyFn>((ref: unknown, next: unknown, error: unknown) => {
    const listener: Listener = {
      ref: ref as RefLike,
      next: next as Listener['next'],
      error: error as Listener['error'],
      active: true,
    }
    listeners.push(listener)
    return () => {
      listener.active = false
    }
  }),
}

export type FakeDoc = { id: string } & Record<string, unknown>

export function snapshotOf(docs: FakeDoc[]) {
  return {
    docs: docs.map(({ id, ...data }) => ({ id, data: () => data })),
  }
}

/** Pushes a realtime snapshot to every open listener on that collection path. */
export function emit(path: string, docs: FakeDoc[]): number {
  const targets = listeners.filter((listener) => listener.active && listener.ref.path === path)
  targets.forEach((listener) => listener.next(snapshotOf(docs)))
  return targets.length
}

export function activeListeners(path: string): Listener[] {
  return listeners.filter((listener) => listener.active && listener.ref.path === path)
}

/** Pushes a document snapshot to the listener on that document path. */
export function emitDoc(path: string, data: Record<string, unknown> | null): number {
  const targets = listeners.filter((listener) => listener.active && listener.ref.path === path)
  const id = path.split('/').pop() ?? path
  targets.forEach((listener) =>
    listener.next({
      id,
      exists: () => data !== null,
      data: () => data ?? undefined,
    }),
  )
  return targets.length
}

export function resetFirebaseMocks(): void {
  listeners.length = 0
  authState.user = null
  firebaseMocks.getDocs.mockReset()
  firebaseMocks.getDocs.mockResolvedValue({ empty: true, docs: [] })
  firebaseMocks.getDoc.mockReset()
  firebaseMocks.getDoc.mockResolvedValue({ exists: () => false, data: () => undefined })
  firebaseMocks.signInWithEmailAndPassword.mockReset()
  firebaseMocks.signOut.mockClear()
  firebaseMocks.setDoc.mockClear()
  firebaseMocks.addDoc.mockReset()
  firebaseMocks.addDoc.mockResolvedValue({ id: 'pedido-abc12' })
  firebaseMocks.updateDoc.mockReset()
  firebaseMocks.updateDoc.mockResolvedValue(undefined)
  firebaseMocks.deleteDoc.mockReset()
  firebaseMocks.deleteDoc.mockResolvedValue(undefined)
  firebaseMocks.onSnapshot.mockClear()
}
