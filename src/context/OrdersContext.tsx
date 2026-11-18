import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { watchCustomerOrders, type Order } from '../lib/orders'

export type OrderHistory = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  customerId: string
  orders: Order[]
}

const idle: OrderHistory = { status: 'idle', customerId: '', orders: [] }

const OrdersContext = createContext<OrderHistory>(idle)

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const customerId = session.status === 'ready' && session.profile.role === 'customer' ? session.profile.uid : ''
  const [history, setHistory] = useState<OrderHistory>(idle)

  useEffect(() => {
    if (!customerId) {
      setHistory(idle)
      return
    }
    setHistory({ status: 'loading', customerId, orders: [] })
    return watchCustomerOrders(
      customerId,
      (orders) => setHistory({ status: 'ready', customerId, orders }),
      () => setHistory((current) => ({ ...current, status: 'error' })),
    )
  }, [customerId])

  return <OrdersContext.Provider value={history}>{children}</OrdersContext.Provider>
}

export function useOrders(): OrderHistory {
  return useContext(OrdersContext)
}

/**
 * True once the saved customer is known and, for a customer, their order
 * history has arrived. Keeps the splash up until then.
 */
export function useBootReady(): boolean {
  const { session } = useAuth()
  const history = useOrders()
  if (session.status === 'loading') return false
  if (session.status !== 'ready' || session.profile.role !== 'customer') return true
  if (history.customerId !== session.profile.uid) return false
  return history.status === 'ready' || history.status === 'error'
}
