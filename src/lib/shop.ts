import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase'

export const DEFAULT_CLOSED_MESSAGE =
  'Hoje não estamos funcionando. Nossos dias de funcionamento são de quarta a domingo.'

export type ShopSettings = {
  online: boolean
  message: string
  hours: string
  /** Cents. 0 when the shop has never set a fee, so old orders are not charged one. */
  deliveryFeeCents: number
}

function readFee(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return Math.round(value)
}

function readShop(data: Record<string, unknown> | undefined): ShopSettings {
  const message = typeof data?.message === 'string' ? data.message.trim() : ''
  const hours = typeof data?.hours === 'string' ? data.hours.trim() : ''
  return {
    online: data?.online !== false,
    message: message || DEFAULT_CLOSED_MESSAGE,
    hours,
    deliveryFeeCents: readFee(data?.deliveryFeeCents),
  }
}

export function watchShop(onNext: (shop: ShopSettings) => void, onError: () => void): () => void {
  return onSnapshot(
    doc(db, 'settings', 'shop'),
    (snapshot) => {
      onNext(readShop(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : undefined))
    },
    () => onError(),
  )
}

export async function saveShop(shop: ShopSettings): Promise<void> {
  const message = shop.message.trim() || DEFAULT_CLOSED_MESSAGE
  // The fee has its own write. Saving hours or the closed message must not reset it.
  await setDoc(
    doc(db, 'settings', 'shop'),
    { online: shop.online, message, hours: shop.hours.trim() },
    { merge: true },
  )
}

export async function saveDeliveryFee(cents: number): Promise<void> {
  const deliveryFeeCents = readFee(cents)
  await setDoc(doc(db, 'settings', 'shop'), { deliveryFeeCents }, { merge: true })
}

export function useShop(): { ready: boolean; online: boolean; message: string; hours: string; deliveryFeeCents: number } {
  const [state, setState] = useState({
    ready: false,
    online: true,
    message: DEFAULT_CLOSED_MESSAGE,
    hours: '',
    deliveryFeeCents: 0,
  })

  useEffect(
    () =>
      watchShop(
        (shop) =>
          setState({
            ready: true,
            online: shop.online,
            message: shop.message,
            hours: shop.hours,
            deliveryFeeCents: shop.deliveryFeeCents,
          }),
        () => setState((current) => ({ ...current, ready: true, online: true })),
      ),
    [],
  )

  return state
}
