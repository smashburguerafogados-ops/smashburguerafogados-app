import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { digitsOnly } from './identity'
import { parseProfile, type UserProfile } from '../types'

export function matchesContact(person: Pick<UserProfile, 'nome' | 'whatsapp'>, query: string): boolean {
  const text = query.trim().toLowerCase()
  if (!text) return true
  if (person.nome.toLowerCase().includes(text)) return true
  const digits = digitsOnly(text)
  return digits.length > 0 && digitsOnly(person.whatsapp).includes(digits)
}

export function watchCustomers(onNext: (people: UserProfile[]) => void, onError: () => void): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      const people = snapshot.docs
        .map((entry) => parseProfile(entry.id, entry.data()))
        .filter((person): person is UserProfile => person !== null && person.role === 'customer')
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      onNext(people)
    },
    () => onError(),
  )
}
