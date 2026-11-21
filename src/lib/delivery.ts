import { digitsOnly, maskWhatsappInput, normalizeWhatsapp } from './identity'
import type { UserProfile } from '../types'

/** National mobile length: DDD and the rest, in one field. */
export const PHONE_LENGTH = 11

/**
 * One field for the whole number. A saved WhatsApp opens as 87 plus the rest.
 * No digit is locked.
 */
export function phoneFieldValue(stored: string): string {
  return maskWhatsappInput(stored)
}

/** Full WhatsApp from that one field. Incomplete until every national digit is there. */
export function phoneFromField(input: string): string | null {
  const digits = digitsOnly(input)
  const national = digits.startsWith('55') && digits.length > PHONE_LENGTH ? digits.slice(2) : digits
  if (national.length !== PHONE_LENGTH) return null
  return normalizeWhatsapp(national)
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
