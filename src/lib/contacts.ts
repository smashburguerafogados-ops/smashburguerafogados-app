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

function createdMillis(data: Record<string, unknown>): number {
  const value = data.createdAt as { toMillis?: () => number } | undefined
  return typeof value?.toMillis === 'function' ? value.toMillis() : 0
}

export function watchCustomers(onNext: (people: UserProfile[]) => void, onError: () => void): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      // A number recovered from a lost login has two user docs; list the newest once.
      const byNumber = new Map<string, { person: UserProfile; at: number }>()
      for (const entry of snapshot.docs) {
        const data = entry.data()
        const person = parseProfile(entry.id, data)
        if (!person || person.role !== 'customer') continue
        const at = createdMillis(data)
        const key = digitsOnly(person.whatsapp) || person.uid
        const seen = byNumber.get(key)
        if (!seen || at > seen.at) byNumber.set(key, { person, at })
      }
      const people = [...byNumber.values()]
        .map((item) => item.person)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      onNext(people)
    },
    () => onError(),
  )
}
