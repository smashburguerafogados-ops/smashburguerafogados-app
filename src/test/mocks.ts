import { vi } from 'vitest'

type AnyFn = (...args: unknown[]) => unknown

export const firebaseMocks = {
  signInWithEmailAndPassword: vi.fn<AnyFn>(),
  signOut: vi.fn<AnyFn>(async () => undefined),
  getDoc: vi.fn<AnyFn>(async () => ({ exists: () => false, data: () => undefined })),
  getDocs: vi.fn<AnyFn>(async () => ({ empty: true, docs: [] })),
  setDoc: vi.fn<AnyFn>(),
}
