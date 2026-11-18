import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { firebaseMocks } from './mocks'

afterEach(() => {
  cleanup()
})

vi.mock('../lib/firebase', () => ({
  auth: {},
  db: {},
  authReady: Promise.resolve(),
}))

vi.mock('firebase/auth', async () => {
  const { firebaseMocks: mocks } = await import('./mocks')
  return {
    getAuth: vi.fn(),
    setPersistence: vi.fn(async () => undefined),
    browserLocalPersistence: {},
    onAuthStateChanged: (_auth: unknown, callback: (user: null) => void) => {
      callback(null)
      return () => {}
    },
    signInWithEmailAndPassword: (...args: unknown[]) => mocks.signInWithEmailAndPassword(...args),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: (...args: unknown[]) => mocks.signOut(...args),
    deleteUser: vi.fn(),
  }
})

vi.mock('firebase/firestore', async () => {
  const { firebaseMocks: mocks } = await import('./mocks')
  return {
    collection: vi.fn((...args: unknown[]) => args),
    query: vi.fn((...args: unknown[]) => args),
    where: vi.fn((...args: unknown[]) => args),
    doc: vi.fn((...args: unknown[]) => args),
    getDoc: (...args: unknown[]) => mocks.getDoc(...args),
    getDocs: (...args: unknown[]) => mocks.getDocs(...args),
    setDoc: (...args: unknown[]) => mocks.setDoc(...args),
    deleteDoc: vi.fn(),
    serverTimestamp: vi.fn(),
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
  firebaseMocks.getDocs.mockResolvedValue({ empty: true, docs: [] })
  firebaseMocks.getDoc.mockResolvedValue({ exists: () => false, data: () => undefined })
  firebaseMocks.signInWithEmailAndPassword.mockReset()
  firebaseMocks.signOut.mockClear()
})
