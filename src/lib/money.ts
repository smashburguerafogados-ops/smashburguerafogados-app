export function toCents(reais: number): number {
  return Math.round(reais * 100)
}

function groupThousands(reais: number): string {
  return String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function formatPrice(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const reais = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  return `${sign}R$ ${groupThousands(reais)},${frac}`
}

const MAX_PRICE_DIGITS = 7

/** Price mask: every typed digit enters from the cents side, so "2990" reads "29,90". */
export function maskPrice(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_PRICE_DIGITS)
  if (!digits) return ''
  const cents = Number(digits)
  return formatPrice(cents).replace('R$ ', '')
}

/** Whole reais with thousand dots, for the cash-in-hand field. */
export function maskWholeReais(digits: string): string {
  const clean = digits.replace(/\D/g, '')
  return clean ? groupThousands(Number(clean)) : ''
}
