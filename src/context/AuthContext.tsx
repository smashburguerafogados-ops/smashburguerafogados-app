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
import { mapAuthError } from '../lib/errors'
import { digitsOnly, normalizeWhatsapp, whatsappToEmail } from '../lib/identity'
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
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function freshCustomerPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
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

        const email = whatsappToEmail(whatsapp)
        if (!email) throw new Error('Informe o telefone.')
        suspendListener.current = true
        try {
          const credential = await createUserWithEmailAndPassword(auth, email, freshCustomerPassword())
          const profile: UserProfile = {
            uid: credential.user.uid,
            nome,
            whatsapp,
            address,
            role: 'customer',
          }
          try {
            await setDoc(doc(db, 'users', profile.uid), {
              ...profile,
              createdAt: serverTimestamp(),
            })
          } catch (error) {
            await deleteUser(credential.user).catch(() => undefined)
            throw error
          }
          saveCustomerId(profile.uid)
          setSession({ status: 'ready', profile })
          return profile
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Informe')) throw error
          throw new Error(mapAuthError(error))
        } finally {
          suspendListener.current = false
        }
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

        const email = whatsappToEmail(whatsapp)
        if (!email) throw new Error('Informe o telefone.')
        suspendListener.current = true
        try {
          const credential = await createUserWithEmailAndPassword(auth, email, freshCustomerPassword())
          const profile: UserProfile = {
            uid: credential.user.uid,
            nome,
            whatsapp,
            address: null,
            role: 'customer',
          }
          try {
            await setDoc(doc(db, 'users', profile.uid), {
              ...profile,
              address: EMPTY_ADDRESS,
              createdAt: serverTimestamp(),
            })
          } catch (error) {
            await deleteUser(credential.user).catch(() => undefined)
            throw error
          }
          saveCustomerId(profile.uid)
          setSession({ status: 'ready', profile })
          return profile
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Informe')) throw error
          throw new Error(mapAuthError(error))
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
