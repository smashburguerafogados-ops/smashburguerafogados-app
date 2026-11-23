import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { Address, UserProfile } from '../types'
import { cashToCents, changeCents, type CheckoutState, type PaymentMethod } from './checkout'
import { db } from './firebase'
import type { CartLine } from './menu'
import { recordRevenue } from './revenue'

export type OrderStatus = 'novo' | 'andamento' | 'enviado' | 'recusado' | 'cancelado' | 'finalizado'
export type OrderColumn = 'novos' | 'andamento' | 'finalizados'
export type Fulfillment = 'entrega' | 'retirada'

export const FULFILLMENT_LABEL: Record<Fulfillment, string> = {
  entrega: 'Entrega',
  retirada: 'Retirada',
}

export type OrderItem = {
  productId: string
  name: string
  image: string
  priceCents: number
  qty: number
  note: string
}

export type OrderPayment = {
  method: PaymentMethod
  needsChange: boolean
  cashCents: number | null
  changeCents: number | null
}

export type Order = {
  id: string
  customerId: string
  customerName: string
  customerWhatsapp: string
  address: Address | null
  fulfillment: Fulfillment
  items: OrderItem[]
  /** Fee charged on this order. Pickup is always 0. Later shop changes do not rewrite it. */
  deliveryFeeCents: number
  totalCents: number
  payment: OrderPayment
  status: OrderStatus
  reason: string
  createdAtMs: number
}

export type NewOrder = Omit<Order, 'id'>

export const STATUS_LABEL: Record<OrderStatus, string> = {
  novo: 'Recebido',
  andamento: 'Aceito, em preparo',
  enviado: 'Saiu para entrega',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  finalizado: 'Finalizado',
}

const PICKUP_STATUS: Partial<Record<OrderStatus, string>> = {
  andamento: 'Aceito, em preparo',
  enviado: 'Pronto para retirada',
}

/** Customer-facing status. Pickup ready is not "out for delivery". */
export function customerStatus(order: Pick<Order, 'status' | 'fulfillment'>): string {
  if (order.fulfillment === 'retirada') return PICKUP_STATUS[order.status] ?? STATUS_LABEL[order.status]
  return STATUS_LABEL[order.status]
}

export const COLUMN_LABEL: Record<OrderColumn, string> = {
  novos: 'Novos',
  andamento: 'Em Andamento',
  finalizados: 'Finalizados',
}

const STATUSES: OrderStatus[] = ['novo', 'andamento', 'enviado', 'recusado', 'cancelado', 'finalizado']
const METHODS: PaymentMethod[] = ['pix', 'cartao', 'dinheiro']
const FULFILLMENTS: Fulfillment[] = ['entrega', 'retirada']

export function columnOf(status: OrderStatus): OrderColumn {
  if (status === 'novo') return 'novos'
  if (status === 'andamento' || status === 'enviado') return 'andamento'
  return 'finalizados'
}

export function isAccepted(status: OrderStatus): boolean {
  return status === 'andamento' || status === 'enviado'
}

export function shortId(id: string): string {
  return id.slice(-5).toUpperCase()
}

function plain(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Admin search: customer name, WhatsApp digits, or the order number shown as #XXXXX. */
export function orderMatches(order: Pick<Order, 'id' | 'customerName' | 'customerWhatsapp'>, query: string): boolean {
  const text = plain(query.trim())
  if (!text) return true
  if (plain(order.customerName).includes(text)) return true
  const code = text.replace(/^#/, '').replace(/\s/g, '')
  if (code && (shortId(order.id).toLowerCase().includes(code) || order.id.toLowerCase().includes(code))) return true
  const digits = text.replace(/\D/g, '')
  return digits.length >= 3 && order.customerWhatsapp.replace(/\D/g, '').includes(digits)
}

/** Only public http(s) images are kept on an order; inline photos stay on the product. */
export function publicImage(src: string): string {
  if (/^https?:\/\//i.test(src)) return src
  if (src.startsWith('/') && typeof window !== 'undefined') return `${window.location.origin}${src}`
  return ''
}

/** Pickup never pays the fee. An unset or invalid fee is 0. */
export function deliveryCharge(fulfillment: Fulfillment, feeCents: number): number {
  if (fulfillment !== 'entrega') return 0
  if (typeof feeCents !== 'number' || !Number.isFinite(feeCents) || feeCents <= 0) return 0
  return Math.round(feeCents)
}

export function buildOrder(
  profile: UserProfile,
  lines: CartLine[],
  checkout: CheckoutState,
  itemsCents: number,
  fulfillment: Fulfillment = 'entrega',
  deliveryFeeCents = 0,
  now = Date.now(),
): NewOrder {
  if (!checkout.method) throw new Error('Escolha a forma de pagamento.')
  const fee = deliveryCharge(fulfillment, deliveryFeeCents)
  const totalCents = itemsCents + fee
  const needsChange = checkout.method === 'dinheiro' && checkout.needsChange === 'sim'
  const cash = needsChange ? cashToCents(checkout.cash) : null
  return {
    customerId: profile.uid,
    customerName: profile.nome,
    customerWhatsapp: profile.whatsapp,
    address: fulfillment === 'retirada' ? null : profile.address,
    fulfillment,
    items: lines.map((line) => ({
      productId: line.productId,
      name: line.name,
      image: publicImage(line.image),
      priceCents: line.priceCents,
      qty: line.qty,
      note: line.note,
    })),
    deliveryFeeCents: fee,
    totalCents,
    payment: {
      method: checkout.method,
      needsChange,
      cashCents: cash,
      changeCents: needsChange ? changeCents(cash, totalCents) : null,
    },
    status: 'novo',
    reason: '',
    createdAtMs: now,
  }
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseAddress(value: unknown): Address | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  return {
    cep: asString(raw.cep),
    street: asString(raw.street),
    number: asString(raw.number),
    neighborhood: asString(raw.neighborhood),
    city: asString(raw.city),
    state: asString(raw.state),
    reference: asString(raw.reference),
  }
}

export function parseOrder(id: string, data: unknown): Order | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  const status = STATUSES.find((value) => value === raw.status)
  const paymentRaw = (raw.payment ?? {}) as Record<string, unknown>
  const method = METHODS.find((value) => value === paymentRaw.method)
  if (!status || !method || typeof raw.customerId !== 'string') return null
  const items = Array.isArray(raw.items)
    ? raw.items
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) => ({
          productId: asString(item.productId),
          name: asString(item.name),
          image: asString(item.image),
          priceCents: asNumber(item.priceCents),
          qty: Math.max(1, asNumber(item.qty)),
          note: asString(item.note),
        }))
    : []
  const fulfillment = FULFILLMENTS.find((value) => value === raw.fulfillment) ?? 'entrega'
  return {
    id,
    customerId: raw.customerId,
    customerName: asString(raw.customerName),
    customerWhatsapp: asString(raw.customerWhatsapp),
    address: fulfillment === 'retirada' ? null : parseAddress(raw.address),
    fulfillment,
    items,
    deliveryFeeCents: Math.max(0, Math.round(asNumber(raw.deliveryFeeCents))),
    totalCents: asNumber(raw.totalCents),
    payment: {
      method,
      needsChange: paymentRaw.needsChange === true,
      cashCents: typeof paymentRaw.cashCents === 'number' ? paymentRaw.cashCents : null,
      changeCents: typeof paymentRaw.changeCents === 'number' ? paymentRaw.changeCents : null,
    },
    status,
    reason: asString(raw.reason),
    createdAtMs: asNumber(raw.createdAtMs),
  }
}

type SnapshotLike = { docs: { id: string; data: () => unknown }[] }

function toOrders(snapshot: SnapshotLike): Order[] {
  return snapshot.docs
    .map((entry) => parseOrder(entry.id, entry.data()))
    .filter((order): order is Order => order !== null)
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
}

export async function placeOrder(order: NewOrder): Promise<string> {
  const ref = await addDoc(collection(db, 'orders'), {
    ...order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export function watchCustomerOrders(
  customerId: string,
  onNext: (orders: Order[]) => void,
  onError: () => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'orders'), where('customerId', '==', customerId)),
    (snapshot) => onNext(toOrders(snapshot)),
    () => onError(),
  )
}

/** The admin lists the last 30 days. Older orders load only when asked for. */
export const ORDERS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export function ordersSince(now: number, windowMs = ORDERS_WINDOW_MS): number {
  return Math.max(0, now - windowMs)
}

export function watchAllOrders(
  onNext: (orders: Order[]) => void,
  onError: () => void,
  sinceMs: number | null = ordersSince(Date.now()),
): () => void {
  const orders = collection(db, 'orders')
  return onSnapshot(
    sinceMs === null ? orders : query(orders, where('createdAtMs', '>=', sinceMs)),
    (snapshot) => onNext(toOrders(snapshot)),
    () => onError(),
  )
}

export async function setOrderStatus(id: string, status: OrderStatus, reason?: string): Promise<void> {
  const patch: Record<string, unknown> = { status, updatedAt: serverTimestamp() }
  if (reason !== undefined) patch.reason = reason.trim()
  await updateDoc(doc(db, 'orders', id), patch)
}

/** Records the amount only when the order leaves em andamento for finalizado. */
export async function finalizeOrder(order: Order): Promise<void> {
  const earn = order.status === 'andamento' || order.status === 'enviado'
  await setOrderStatus(order.id, 'finalizado')
  if (earn) await recordRevenue(order)
}
