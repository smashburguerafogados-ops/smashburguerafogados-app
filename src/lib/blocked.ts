import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { AUTH_EMAIL_DOMAIN, normalizeWhatsapp } from './identity'

/**
 * blocked/{55DDDnúmero} says "this phone cannot order". The id is the same
 * normalized digits the customer login is built from, so firestore.rules can
 * compare it with the signed-in email without trusting any field the client
 * sends. blockedNotes/{same id} keeps the admin's private note apart, because a
 * blocked customer is allowed to read their own blocked document.
 */
export type BlockedPhone = {
  phone: string
  note: string
  createdAtMs: number
}

export const NOTE_MAX = 80

export function blockKey(input: string | null | undefined): string | null {
  if (!input) return null
  return normalizeWhatsapp(input)
}

/** The phone a customer login belongs to: {digits}@ or {digits}.r@ on the customer domain. */
export function blockKeyFromEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const [local, domain] = email.toLowerCase().split('@')
  if (domain !== AUTH_EMAIL_DOMAIN || !local) return null
  return blockKey(local.split('.')[0])
}

/**
 * True when any of these phones is on the blocked list. Rules not published yet,
 * no network or any other failure counts as "not blocked": the list is advisory
 * on the client, and firestore.rules is what stops the order.
 */
export async function isPhoneBlocked(phones: Array<string | null | undefined>): Promise<boolean> {
  const keys = [...new Set(phones.map(blockKey).filter((key): key is string => key !== null))]
  for (const key of keys) {
    try {
      const snap = await getDoc(doc(db, 'blocked', key))
      if (snap.exists()) return true
    } catch {
      // permission-denied before the rules are published, or offline.
    }
  }
  return false
}

/** Fires when the admin blocks one of these phones while the customer is already inside. */
export function watchBlocked(phones: Array<string | null | undefined>, onBlocked: () => void): () => void {
  const keys = [...new Set(phones.map(blockKey).filter((key): key is string => key !== null))]
  const stops = keys.map((key) =>
    onSnapshot(
      doc(db, 'blocked', key),
      (snap) => {
        if (snap.exists()) onBlocked()
      },
      () => undefined,
    ),
  )
  return () => stops.forEach((stop) => stop())
}

function parseBlocked(id: string, data: unknown): BlockedPhone {
  const raw = (data ?? {}) as Record<string, unknown>
  return {
    phone: id,
    note: '',
    createdAtMs: typeof raw.createdAtMs === 'number' ? raw.createdAtMs : 0,
  }
}

export function cleanNote(note: string): string {
  return note.trim().replace(/\s+/g, ' ').slice(0, NOTE_MAX)
}

export async function blockPhone(input: string, note: string): Promise<string> {
  const phone = blockKey(input)
  if (!phone) throw new Error('Informe o telefone com DDD.')
  await setDoc(doc(db, 'blocked', phone), { phone, createdAtMs: Date.now(), createdAt: serverTimestamp() })
  const text = cleanNote(note)
  if (text) await setDoc(doc(db, 'blockedNotes', phone), { note: text })
  return phone
}

export async function unblockPhone(phone: string): Promise<void> {
  await deleteDoc(doc(db, 'blocked', phone))
  await deleteDoc(doc(db, 'blockedNotes', phone)).catch(() => undefined)
}

export function sortBlocked(list: BlockedPhone[]): BlockedPhone[] {
  return [...list].sort((a, b) => b.createdAtMs - a.createdAtMs || a.phone.localeCompare(b.phone))
}

/** Admin list: blocked phones newest first, each with its private note. */
export function useBlockedList(): { list: BlockedPhone[]; status: 'loading' | 'ready' | 'error' } {
  const [entries, setEntries] = useState<BlockedPhone[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const stopList = onSnapshot(
      collection(db, 'blocked'),
      (snapshot) => {
        setEntries(snapshot.docs.map((entry) => parseBlocked(entry.id, entry.data())))
        setStatus('ready')
      },
      () => setStatus('error'),
    )
    const stopNotes = onSnapshot(
      collection(db, 'blockedNotes'),
      (snapshot) => {
        const next: Record<string, string> = {}
        snapshot.docs.forEach((entry) => {
          const data = entry.data() as Record<string, unknown>
          if (typeof data.note === 'string') next[entry.id] = data.note
        })
        setNotes(next)
      },
      () => undefined,
    )
    return () => {
      stopList()
      stopNotes()
    }
  }, [])

  const list = sortBlocked(entries.map((entry) => ({ ...entry, note: notes[entry.phone] ?? '' })))
  return { list, status }
}
