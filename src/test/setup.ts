import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { resetFirebaseMocks } from './mocks'

afterEach(() => {
  cleanup()
})

vi.mock('../lib/firebase', async () => {
  const { authState } = await import('./mocks')
  return {
    auth: {
      get currentUser() {
        return authState.user
      },
    },
    db: {},
    authReady: Promise.resolve(),
  }
})

vi.mock('firebase/auth', async () => {
  const { firebaseMocks: mocks, authListeners, authState, emitAuth } = await import('./mocks')
  return {
    getAuth: vi.fn(),
    setPersistence: vi.fn(async () => undefined),
    browserLocalPersistence: {},
    onAuthStateChanged: (_auth: unknown, callback: (user: { uid: string } | null) => void) => {
      authListeners.add(callback)
      callback(authState.user)
      return () => authListeners.delete(callback)
    },
    signInWithEmailAndPassword: async (...args: unknown[]) => {
      const result = (await mocks.signInWithEmailAndPassword(...args)) as { user?: { uid: string } | null } | undefined
      if (result?.user) emitAuth(result.user)
      return result
    },
    createUserWithEmailAndPassword: async (...args: unknown[]) => {
      const result = (await mocks.createUserWithEmailAndPassword(...args)) as { user?: { uid: string } | null } | undefined
      if (result?.user) emitAuth(result.user)
      return result
    },
    signOut: async (...args: unknown[]) => {
      const result = await mocks.signOut(...args)
      emitAuth(null)
      return result
    },
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
    getDoc: async (ref: { path: string }, ...rest: unknown[]) => {
      if (ref.path.startsWith('blocked/')) return mocks.blockedLookup(ref.path.slice('blocked/'.length))
      return mocks.getDoc(ref, ...rest)
    },
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
