export type PaymentMethod = 'pix' | 'cartao' | 'dinheiro'
export type ChangeChoice = 'sim' | 'nao' | null

export const PAYMENT_METHODS: PaymentMethod[] = ['pix', 'cartao', 'dinheiro']

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
}

export type CheckoutState = {
  method: PaymentMethod | null
  needsChange: ChangeChoice
  cash: string
}

export const emptyCheckout: CheckoutState = { method: null, needsChange: null, cash: '' }

const MAX_CASH_DIGITS = 6

/** Keeps only digits, so the cash field never holds letters, signs or separators. */
export function cashDigits(input: string): string {
  return input.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_CASH_DIGITS)
}

/** Cash in hand is typed in whole reais. */
export function cashToCents(digits: string): number | null {
  const clean = cashDigits(digits)
  if (!clean) return null
  return Number(clean) * 100
}

export function changeCents(cashCents: number | null, totalCents: number): number | null {
  if (cashCents === null) return null
  return cashCents - totalCents
}

export function checkoutProblem(state: CheckoutState, totalCents: number, itemCount: number): string | null {
  if (itemCount <= 0 || totalCents <= 0) return 'Adicione um item ao carrinho.'
  if (!state.method) return 'Escolha a forma de pagamento.'
  if (state.method !== 'dinheiro') return null
  if (!state.needsChange) return 'Diga se precisa de troco.'
  if (state.needsChange === 'nao') return null
  const cash = cashToCents(state.cash)
  if (cash === null) return 'Informe quanto vai pagar em dinheiro.'
  if (cash <= totalCents) return 'O valor em dinheiro precisa ser maior que o total.'
  return null
}

export function canPlaceOrder(state: CheckoutState, totalCents: number, itemCount: number): boolean {
  return checkoutProblem(state, totalCents, itemCount) === null
}
