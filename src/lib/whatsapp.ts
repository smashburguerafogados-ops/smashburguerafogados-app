import { PAYMENT_LABELS } from './checkout'
import { normalizeWhatsapp } from './identity'
import { formatPrice } from './money'
import { photoLink, shortId, type Order } from './orders'

/** Shop WhatsApp. Customers write here, and the admin sends from this account. Not a secret. */
export const BUSINESS_WHATSAPP = '558796619629'

export const BUSINESS_NAME = 'Smash Burger'

/**
 * Single code point emoji with default emoji presentation. They need no
 * variation selector or joiner, so iPhone and Android draw them the same way.
 */
export const SYMBOLS = {
  wave: '\u{1F44B}',
  check: '\u2705',
  cross: '\u274C',
  fire: '\u{1F525}',
  burger: '\u{1F354}',
  scooter: '\u{1F6F5}',
  pin: '\u{1F4CD}',
  money: '\u{1F4B0}',
  cash: '\u{1F4B5}',
  camera: '\u{1F4F8}',
  memo: '\u{1F4DD}',
  chat: '\u{1F4AC}',
  pray: '\u{1F64F}',
  box: '\u{1F4E6}',
} as const

export const SAFE_SYMBOLS: string[] = Object.values(SYMBOLS)

export function sanitizeMessage(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\uFFFD/g, '')
    .replace(/[\uFE0E\uFE0F\u200D]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function whatsappUrl(number: string, text?: string): string {
  const digits = number.replace(/\D/g, '')
  const base = `https://wa.me/${digits}`
  if (!text) return base
  return `${base}?text=${encodeURIComponent(sanitizeMessage(text))}`
}

export function isAndroidDevice(): boolean {
  return /Android/i.test(navigator.userAgent)
}

/**
 * Opens the installed WhatsApp app. https://wa.me stops on a web page in
 * Android Chrome before the app. iOS already hands wa.me straight to the app.
 */
export function whatsappAppUrl(number: string, text?: string): string {
  const digits = number.replace(/\D/g, '')
  const base = `whatsapp://send?phone=${digits}`
  if (!text) return base
  return `${base}&text=${encodeURIComponent(sanitizeMessage(text))}`
}

export function businessWhatsappUrl(text?: string): string {
  return whatsappUrl(BUSINESS_WHATSAPP, text)
}

export function customerNumber(order: Pick<Order, 'customerWhatsapp'>): string {
  return normalizeWhatsapp(order.customerWhatsapp) ?? order.customerWhatsapp.replace(/\D/g, '')
}

export function broadcastMessage(text: string): string {
  return sanitizeMessage(`${SYMBOLS.burger} ${text}`)
}

/** Same-tab navigation. Android needs this so the whatsapp:// link reaches the app. */
export const page = {
  assign(url: string) {
    window.location.assign(url)
  },
}

/** Opens one chat. Returns false when the browser blocks the window, without leaving the page. */
export function openWhatsappTab(number: string, text: string): boolean {
  const opened = window.open(whatsappUrl(number, text), '_blank')
  if (!opened) return false
  try {
    opened.opener = null
  } catch {
    // Some browsers lock opener on cross-origin windows.
  }
  return true
}

/** Call from the click handler itself so mobile browsers treat it as a user action. */
export function openWhatsapp(number: string, text: string): string {
  if (isAndroidDevice()) {
    const app = whatsappAppUrl(number, text)
    page.assign(app)
    return app
  }
  const url = whatsappUrl(number, text)
  if (!openWhatsappTab(number, text)) page.assign(url)
  return url
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

function greeting(name: string): string {
  const first = firstName(name)
  return first ? `Olá, ${first}!` : 'Olá!'
}

export function formatAddress(order: Pick<Order, 'address'>): string {
  const address = order.address
  if (!address) return 'Endereço não informado'
  const line = [address.street, address.number].filter(Boolean).join(', ')
  const area = [address.neighborhood, address.city, address.state].filter(Boolean).join(' - ')
  const parts = [line, area].filter(Boolean)
  if (address.reference) parts.push(`Ref.: ${address.reference}`)
  return parts.join(' | ')
}

export function paymentLine(order: Pick<Order, 'payment'>): string {
  const { payment } = order
  const label = PAYMENT_LABELS[payment.method]
  if (payment.method !== 'dinheiro') return `${label} (pague ao entregador)`
  if (!payment.needsChange || payment.cashCents === null) return `${label}, sem troco`
  const change = payment.changeCents ?? 0
  return `${label}, troco para ${formatPrice(payment.cashCents)} (troco ${formatPrice(change)})`
}

export function acceptedMessage(order: Order): string {
  return [
    `${SYMBOLS.check} ${greeting(order.customerName)} Seu pedido #${shortId(order.id)} na ${BUSINESS_NAME} foi aceito.`,
    `${SYMBOLS.fire} Já estamos preparando.`,
    `${SYMBOLS.money} Total: ${formatPrice(order.totalCents)}`,
    `${SYMBOLS.pray} Obrigado pela preferência!`,
  ].join('\n')
}

export function refusedMessage(order: Order, reason: string): string {
  return [
    `${SYMBOLS.cross} ${greeting(order.customerName)} Não conseguimos aceitar seu pedido #${shortId(order.id)} na ${BUSINESS_NAME}.`,
    `${SYMBOLS.memo} Motivo: ${reason.trim()}`,
    `${SYMBOLS.chat} Qualquer dúvida, responda esta mensagem.`,
  ].join('\n')
}

export function sentMessage(order: Order): string {
  const lines = [
    `${SYMBOLS.scooter} ${greeting(order.customerName)} Seu pedido #${shortId(order.id)} saiu para entrega.`,
    `${SYMBOLS.burger} ${BUSINESS_NAME}`,
    `${SYMBOLS.box} Itens:`,
  ]
  for (const item of order.items) {
    lines.push(`${SYMBOLS.burger} ${item.qty}x ${item.name} - ${formatPrice(item.priceCents * item.qty)}`)
    lines.push(`${SYMBOLS.camera} Foto: ${photoLink(item)}`)
  }
  lines.push(
    `${SYMBOLS.money} Total: ${formatPrice(order.totalCents)}`,
    `${SYMBOLS.cash} Pagamento: ${paymentLine(order)}`,
    `${SYMBOLS.pin} Endereço: ${formatAddress(order)}`,
    `${SYMBOLS.scooter} A entrega está a caminho!`,
  )
  return lines.join('\n')
}

export function cancelledMessage(order: Order, reason: string): string {
  return [
    `${SYMBOLS.cross} ${greeting(order.customerName)} Seu pedido #${shortId(order.id)} na ${BUSINESS_NAME} foi cancelado.`,
    `${SYMBOLS.memo} Motivo: ${reason.trim()}`,
    `${SYMBOLS.chat} Qualquer dúvida, responda esta mensagem.`,
  ].join('\n')
}

export function attendanceMessage(customerName: string): string {
  const name = customerName.trim().replace(/\s+/g, ' ')
  const hello = name
    ? `${SYMBOLS.wave} Olá, Atendimento da ${BUSINESS_NAME}! Aqui é ${name}.`
    : `${SYMBOLS.wave} Olá, Atendimento da ${BUSINESS_NAME}!`
  return [hello, `${SYMBOLS.burger} Vim pelo cardápio.`, `${SYMBOLS.chat} Gostaria de falar com vocês.`].join('\n')
}
