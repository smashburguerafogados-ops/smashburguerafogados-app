export const AUTH_EMAIL_DOMAIN = 'customers.smashburguerafogados.app'

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Brazilian WhatsApp normalized to digits with country code 55.
 * Accepts a national number (10 or 11 digits) or one that already includes 55
 * (12 or 13 digits). Returns null when the length is not a Brazilian number.
 */
export function normalizeWhatsapp(input: string): string | null {
  const digits = digitsOnly(input)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }
  return null
}

export function whatsappToEmail(input: string): string | null {
  const digits = normalizeWhatsapp(input)
  if (!digits) return null
  return `${digits}@${AUTH_EMAIL_DOMAIN}`
}

export function maskWhatsappInput(value: string): string {
  let digits = digitsOnly(value)
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2)
  }
  digits = digits.slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length < 3) return `(${digits}`
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  if (digits.length <= 6) return `(${ddd}) ${rest}`
  if (digits.length <= 10) {
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  }
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
}

export function formatWhatsapp(digits: string): string {
  if (digits.startsWith('55') && digits.length === 13) {
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
  }
  if (digits.startsWith('55') && digits.length === 12) {
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  }
  return digits
}

export function maskCep(value: string): string {
  const digits = digitsOnly(value).slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function formatCep(digits: string): string {
  const clean = digitsOnly(digits)
  if (clean.length !== 8) return clean
  return `${clean.slice(0, 5)}-${clean.slice(5)}`
}
