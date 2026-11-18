import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { resetFirebaseMocks } from './mocks'

afterEach(() => {
  cleanup()
})

vi.mock('../lib/firebase', () => ({
  auth: {},
  db: {},
  authReady: Promise.resolve(),
}))

vi.mock('firebase/auth', async () => {
  const { firebaseMocks: mocks, authState } = await import('./mocks')
  return {
    getAuth: vi.fn(),
    setPersistence: vi.fn(async () => undefined),
    browserLocalPersistence: {},
    onAuthStateChanged: (_auth: unknown, callback: (user: { uid: string } | null) => void) => {
      callback(authState.user)
      return () => {}
    },
    signInWithEmailAndPassword: (...args: unknown[]) => mocks.signInWithEmailAndPassword(...args),
    createUserWithEmailAndPassword: (...args: unknown[]) => mocks.createUserWithEmailAndPassword(...args),
    signOut: (...args: unknown[]) => mocks.signOut(...args),
    deleteUser: vi.fn(),
  }
})

vi.mock('firebase/firestore', async () => {
  const { firebaseMocks: mocks } = await import('./mocks')
  return {
    collection: vi.fn((_db: unknown, name: string) => ({ path: name })),
    query: vi.fn((ref: { path: string }, ...constraints: unknown[]) => ({ path: ref.path, constraints })),
    where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    getDoc: (...args: unknown[]) => mocks.getDoc(...args),
    getDocs: (...args: unknown[]) => mocks.getDocs(...args),
    setDoc: (...args: unknown[]) => mocks.setDoc(...args),
    addDoc: (...args: unknown[]) => mocks.addDoc(...args),
    updateDoc: (...args: unknown[]) => mocks.updateDoc(...args),
    deleteDoc: (...args: unknown[]) => mocks.deleteDoc(...args),
    onSnapshot: (...args: unknown[]) => mocks.onSnapshot(...args),
    serverTimestamp: vi.fn(() => 'SERVER_TIME'),
  }
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
})

Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
})

Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: vi.fn(),
})

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  resetFirebaseMocks()
  window.open = vi.fn(() => ({ opener: {} }) as unknown as Window)
})
