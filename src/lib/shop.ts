import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase'

export const DEFAULT_CLOSED_MESSAGE =
  'Hoje não estamos funcionando. Nossos dias de funcionamento são de quarta a domingo.'

export type ShopSettings = {
  online: boolean
  message: string
}

function readShop(data: Record<string, unknown> | undefined): ShopSettings {
  const message = typeof data?.message === 'string' ? data.message.trim() : ''
  return {
    online: data?.online !== false,
    message: message || DEFAULT_CLOSED_MESSAGE,
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
  await setDoc(doc(db, 'settings', 'shop'), { online: shop.online, message }, { merge: true })
}

export function useShop(): { ready: boolean; online: boolean; message: string } {
  const [state, setState] = useState({ ready: false, online: true, message: DEFAULT_CLOSED_MESSAGE })

  useEffect(
    () =>
      watchShop(
        (shop) => setState({ ready: true, online: shop.online, message: shop.message }),
        () => setState((current) => ({ ...current, ready: true, online: true })),
      ),
    [],
  )

  return state
}
