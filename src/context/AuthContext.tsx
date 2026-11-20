import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, authReady, db } from '../lib/firebase'
import { clearSavedCustomerId, saveCustomerId } from '../lib/customerId'
import { mapAuthError, mapCustomerError } from '../lib/errors'
import {
  customerAccessKey,
  digitsOnly,
  normalizeWhatsapp,
  whatsappToEmail,
  whatsappToRecoveryEmail,
} from '../lib/identity'
import { parseProfile, type Address, type UserProfile } from '../types'

type Session =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'ready'; profile: UserProfile }
  | { status: 'error'; message: string }

export type RegisterInput = {
  nome: string
  whatsapp: string
  password: string
  address: Address
}

export type DeliveryInput = {
  nome: string
  whatsapp: string
  address: Address
}

export type ContactInput = {
  nome: string
  whatsapp: string
}

const EMPTY_ADDRESS: Address = {
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
  reference: '',
}

type AuthContextValue = {
  session: Session
  login: (whatsapp: string, password: string) => Promise<void>
  loginWithEmail: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  saveDelivery: (input: DeliveryInput) => Promise<UserProfile>
  saveContact: (input: ContactInput) => Promise<UserProfile>
  /** Reopens the saved customer for this WhatsApp, if one exists, without creating anything. */
  findCustomer: (whatsapp: string) => Promise<UserProfile | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const NOT_THIS_LOGIN = new Set([
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/wrong-password',
  'auth/user-not-found',
])

function authCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) return ''
  const code = (error as { code: unknown }).code
  return typeof code === 'string' ? code : ''
}

/** The recovery login wins: it only exists because the first one could not be opened. */
async function signInCustomer(whatsapp: string): Promise<User | null> {
  const key = customerAccessKey(whatsapp)
  if (!key) return null
  for (const email of [whatsappToRecoveryEmail(whatsapp), whatsappToEmail(whatsapp)]) {
    if (!email) continue
    try {
      const credential = await signInWithEmailAndPassword(auth, email, key)
      if (credential?.user) return credential.user
    } catch (error) {
      if (!NOT_THIS_LOGIN.has(authCode(error))) throw error
    }
  }
  return null
}

/**
 * Accounts made before this change have a random password nobody kept, and
 * this app has no server that could reset it. Such a number gets the one
 * recovery login, and every later visit reopens that same login.
 */
async function createCustomerLogin(whatsapp: string): Promise<User> {
  const key = customerAccessKey(whatsapp)
  const email = whatsappToEmail(whatsapp)
  const recovery = whatsappToRecoveryEmail(whatsapp)
  if (!key || !email || !recovery) throw new Error('Informe o telefone.')
  try {
    return (await createUserWithEmailAndPassword(auth, email, key)).user
  } catch (error) {
    if (authCode(error) !== 'auth/email-already-in-use') throw error
  }
  return (await createUserWithEmailAndPassword(auth, recovery, key)).user
}

async function readCustomer(uid: string): Promise<UserProfile | null | 'other'> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const profile = parseProfile(uid, snap.data())
  if (!profile) return null
  return profile.role === 'customer' ? profile : 'other'
}

async function hydrate(user: User): Promise<Session> {
  const snap = await getDoc(doc(db, 'users', user.uid))
  if (!snap.exists()) {
    return {
      status: 'error',
      message: 'Não encontramos o cadastro desta conta.',
    }
  }
  const profile = parseProfile(user.uid, snap.data())
  if (!profile) {
    return {
      status: 'error',
      message: 'O cadastro desta conta está incompleto.',
    }
  }
  if (profile.role === 'customer') saveCustomerId(profile.uid)
  return { status: 'ready', profile }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'loading' })
  const suspendListener = useRef(false)
  const generation = useRef(0)

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}

    authReady
      .then(() => {
        if (!active) return
        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (suspendListener.current) return
          if (!user) {
            generation.current += 1
            clearSavedCustomerId()
            setSession({ status: 'signedOut' })
            return
          }

          const ticket = ++generation.current
          setSession((current) => {
            if (current.status === 'ready' && current.profile.uid === user.uid) return current
            return { status: 'loading' }
          })

          hydrate(user)
            .then((next) => {
              if (!active || ticket !== generation.current || suspendListener.current) return
              setSession(next)
            })
            .catch(() => {
              if (!active || ticket !== generation.current || suspendListener.current) return
              setSession({
                status: 'error',
                message: 'Não foi possível carregar sua conta.',
              })
            })
        })
      })
      .catch(() => {
        if (!active) return
        setSession({
          status: 'error',
          message: 'Não foi possível iniciar a sessão.',
        })
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  /** Same WhatsApp, same customer: reopen the saved login, or create it once. */
  async function openCustomer(whatsapp: string, nome: string, address: Address | null): Promise<UserProfile> {
    suspendListener.current = true
    try {
      let user = await signInCustomer(whatsapp)
      let existing: UserProfile | null = null
      let created = false
      if (user) {
        const found = await readCustomer(user.uid)
        if (found === 'other') {
          await signOut(auth).catch(() => undefined)
          throw new Error('Este número não pode fazer pedidos por aqui.')
        }
        existing = found
      } else {
        user = await createCustomerLogin(whatsapp)
        created = true
      }

      if (existing) {
        const profile: UserProfile = { ...existing, nome, whatsapp, address: address ?? existing.address }
        await updateDoc(doc(db, 'users', profile.uid), {
          nome,
          whatsapp,
          ...(address ? { address } : {}),
        })
        saveCustomerId(profile.uid)
        setSession({ status: 'ready', profile })
        return profile
      }

      const profile: UserProfile = { uid: user.uid, nome, whatsapp, address, role: 'customer' }
      try {
        await setDoc(doc(db, 'users', profile.uid), {
          ...profile,
          address: address ?? EMPTY_ADDRESS,
          createdAt: serverTimestamp(),
        })
      } catch (error) {
        if (created) await deleteUser(user).catch(() => undefined)
        throw error
      }
      saveCustomerId(profile.uid)
      setSession({ status: 'ready', profile })
      return profile
    } catch (error) {
      if (error instanceof Error && !authCode(error)) {
        if (error.message.startsWith('Informe') || error.message.startsWith('Este número')) throw error
      }
      throw new Error(mapCustomerError(error))
    } finally {
      suspendListener.current = false
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      async login(whatsapp, password) {
        const email = whatsappToEmail(whatsapp)
        if (!email) {
          throw new Error('Informe um WhatsApp válido com DDD.')
        }
        try {
          await signInWithEmailAndPassword(auth, email, password)
        } catch (error) {
          throw new Error(mapAuthError(error))
        }
      },
      async loginWithEmail(email, password) {
        const clean = email.trim()
        if (!clean || !password) {
          throw new Error('Informe e-mail e senha.')
        }
        suspendListener.current = true
        try {
          const credential = await signInWithEmailAndPassword(auth, clean, password)
          const next = await hydrate(credential.user)
          if (next.status !== 'ready' || next.profile.role !== 'admin') {
            await signOut(auth)
            setSession({ status: 'signedOut' })
            throw new Error('Acesso restrito.')
          }
          setSession(next)
        } catch (error) {
          if (
            error instanceof Error &&
            (error.message === 'Acesso restrito.' || error.message.startsWith('Informe'))
          ) {
            throw error
          }
          throw new Error(mapAuthError(error))
        } finally {
          suspendListener.current = false
        }
      },
      async register(input) {
        const email = whatsappToEmail(input.whatsapp)
        const whatsapp = normalizeWhatsapp(input.whatsapp)
        if (!email || !whatsapp) {
          throw new Error('Informe um WhatsApp válido com DDD.')
        }

        suspendListener.current = true
        try {
          const credential = await createUserWithEmailAndPassword(auth, email, input.password)
          const profile: UserProfile = {
            uid: credential.user.uid,
            nome: input.nome.trim().replace(/\s+/g, ' '),
            whatsapp,
            address: input.address,
            role: 'customer',
          }
          try {
            await setDoc(doc(db, 'users', credential.user.uid), {
              ...profile,
              createdAt: serverTimestamp(),
            })
          } catch (error) {
            await deleteUser(credential.user).catch(() => undefined)
            setSession({ status: 'signedOut' })
            throw error
          }
          saveCustomerId(profile.uid)
          setSession({ status: 'ready', profile })
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Informe')) throw error
          throw new Error(mapAuthError(error))
        } finally {
          suspendListener.current = false
        }
      },
      async saveDelivery(input) {
        const nome = input.nome.trim().replace(/\s+/g, ' ')
        const whatsapp = normalizeWhatsapp(input.whatsapp)
        if (!nome) throw new Error('Informe seu nome.')
        if (!whatsapp) throw new Error('Informe o telefone.')
        const street = input.address.street.trim()
        const number = input.address.number.trim()
        const neighborhood = input.address.neighborhood.trim()
        const city = input.address.city.trim()
        if (!street || !number || !neighborhood || !city) {
          throw new Error('Preencha endereço, número, bairro e cidade.')
        }
        const address: Address = {
          cep: digitsOnly(input.address.cep),
          street,
          number,
          neighborhood,
          city,
          state: input.address.state.trim(),
          reference: input.address.reference.trim(),
        }

        if (session.status === 'ready' && session.profile.role === 'customer') {
          const profile: UserProfile = { ...session.profile, nome, whatsapp, address }
          await updateDoc(doc(db, 'users', profile.uid), {
            nome: profile.nome,
            whatsapp: profile.whatsapp,
            address: profile.address,
          })
          setSession({ status: 'ready', profile })
          return profile
        }

        return openCustomer(whatsapp, nome, address)
      },
      async saveContact(input) {
        const nome = input.nome.trim().replace(/\s+/g, ' ')
        const whatsapp = normalizeWhatsapp(input.whatsapp)
        if (!nome) throw new Error('Informe seu nome.')
        if (!whatsapp) throw new Error('Informe o telefone.')

        if (session.status === 'ready' && session.profile.role === 'customer') {
          const profile: UserProfile = { ...session.profile, nome, whatsapp }
          await updateDoc(doc(db, 'users', profile.uid), {
            nome: profile.nome,
            whatsapp: profile.whatsapp,
          })
          setSession({ status: 'ready', profile })
          return profile
        }

        return openCustomer(whatsapp, nome, null)
      },
      async findCustomer(input) {
        const whatsapp = normalizeWhatsapp(input)
        if (!whatsapp) return null
        if (session.status === 'ready') {
          return session.profile.role === 'customer' && session.profile.whatsapp === whatsapp ? session.profile : null
        }
        suspendListener.current = true
        try {
          const user = await signInCustomer(whatsapp)
          if (!user) return null
          const found = await readCustomer(user.uid)
          if (found === 'other') {
            await signOut(auth).catch(() => undefined)
            return null
          }
          if (!found) return null
          saveCustomerId(found.uid)
          setSession({ status: 'ready', profile: found })
          return found
        } catch {
          return null
        } finally {
          suspendListener.current = false
        }
      },
      async logout() {
        await signOut(auth)
      },
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth fora do AuthProvider')
  }
  return value
}
