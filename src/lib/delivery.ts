import { digitsOnly, normalizeWhatsapp } from './identity'
import type { UserProfile } from '../types'

/** DDD 87 and the mobile 9, shown beside the field on an order. The rest is what they type. */
export const PHONE_PREFIX = '87 9'
export const DEFAULT_DDD = '87'

const PREFIX_DIGITS = digitsOnly(PHONE_PREFIX)
export const PHONE_REST_LENGTH = 8

/** Digits after 87 9 when the stored number already uses that prefix. */
export function phoneRest(stored: string): string {
  const digits = digitsOnly(stored)
  const national = digits.startsWith('55') ? digits.slice(2) : digits
  if (!national.startsWith(PREFIX_DIGITS)) return ''
  return national.slice(PREFIX_DIGITS.length).slice(0, PHONE_REST_LENGTH)
}

/** DDD and the digits after the mobile 9. A missing number starts at DDD 87. */
export function splitPhone(stored: string): { ddd: string; rest: string } {
  const digits = digitsOnly(stored)
  const national = digits.startsWith('55') ? digits.slice(2) : digits
  if (national.length >= 3 && national[2] === '9') {
    return {
      ddd: national.slice(0, 2),
      rest: national.slice(3, 3 + PHONE_REST_LENGTH),
    }
  }
  return { ddd: DEFAULT_DDD, rest: phoneRest(stored) }
}

/**
 * One full number: DDD, the mobile 9, and what they typed, with country code 55.
 * DDD defaults to 87. Nothing is stored on its own.
 */
export function joinPhone(rest: string, ddd: string = DEFAULT_DDD): string | null {
  const area = digitsOnly(ddd).slice(0, 2)
  if (area.length !== 2) return null
  const typed = digitsOnly(rest).slice(0, PHONE_REST_LENGTH)
  if (typed.length !== PHONE_REST_LENGTH) return null
  return normalizeWhatsapp(`${area}9${typed}`)
}

/** Nome and WhatsApp are enough for pickup. Delivery still needs the address. */
export function contactReady(profile: UserProfile): boolean {
  if (profile.role !== 'customer') return false
  if (!profile.nome.trim()) return false
  return Boolean(normalizeWhatsapp(profile.whatsapp))
}

export function deliveryReady(profile: UserProfile): boolean {
  if (!contactReady(profile)) return false
  const address = profile.address
  if (!address) return false
  return Boolean(
    address.street.trim() && address.number.trim() && address.neighborhood.trim() && address.city.trim(),
  )
}
