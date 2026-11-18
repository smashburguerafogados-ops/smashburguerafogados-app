export function toCents(reais: number): number {
  return Math.round(reais * 100)
}

export function formatPrice(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const reais = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  const grouped = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}R$ ${grouped},${frac}`
}
