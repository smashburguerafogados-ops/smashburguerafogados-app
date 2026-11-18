import { digitsOnly, normalizeWhatsapp } from './identity'
import type { UserProfile } from '../types'

/** DDD 87 and the mobile 9, shown beside the field. The rest is what they type. */
export const PHONE_PREFIX = '87 9'

const PREFIX_DIGITS = digitsOnly(PHONE_PREFIX)
export const PHONE_REST_LENGTH = 8

/** Digits after 87 9 when the stored number already uses that prefix. */
export function phoneRest(stored: string): string {
  const digits = digitsOnly(stored)
  const national = digits.startsWith('55') ? digits.slice(2) : digits
  if (!national.startsWith(PREFIX_DIGITS)) return ''
  return national.slice(PREFIX_DIGITS.length).slice(0, PHONE_REST_LENGTH)
}

/**
 * One full number: the 87 9 prefix plus what they typed, with country code 55.
 * The prefix is not stored on its own.
 */
export function joinPhone(rest: string): string | null {
  const typed = digitsOnly(rest).slice(0, PHONE_REST_LENGTH)
  if (typed.length !== PHONE_REST_LENGTH) return null
  return normalizeWhatsapp(`${PREFIX_DIGITS}${typed}`)
}

export function deliveryReady(profile: UserProfile): boolean {
  if (profile.role !== 'customer') return false
  if (!profile.nome.trim()) return false
  if (!normalizeWhatsapp(profile.whatsapp)) return false
  const address = profile.address
  if (!address) return false
  return Boolean(
    address.street.trim() && address.number.trim() && address.neighborhood.trim() && address.city.trim(),
  )
}
