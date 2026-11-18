import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AdminRoute } from '../components/AdminRoute'
import { MenuScreen } from '../components/MenuScreen'
import { AuthProvider } from '../context/AuthContext'
import { OrdersProvider } from '../context/OrdersContext'
import type { Order } from '../lib/orders'
import { authState, firebaseMocks, type FakeDoc } from './mocks'

export const customerProfile = {
  uid: 'cliente-1',
  role: 'customer',
  nome: 'Ana Souza',
  whatsapp: '5587988887777',
  address: {
    cep: '56300000',
    street: 'Rua das Flores',
    number: '120',
    neighborhood: 'Centro',
    city: 'Petrolina',
    state: 'PE',
    reference: 'Perto da praça',
  },
}

export const adminProfile = { uid: 'admin-1', role: 'admin', nome: 'Gerente', whatsapp: '', address: null }

export function signInAs(profile: { uid: string } & Record<string, unknown>) {
  authState.user = { uid: profile.uid }
  firebaseMocks.getDoc.mockResolvedValue({ exists: () => true, data: () => profile })
}

export function Providers({ children, path = '/' }: { children: ReactNode; path?: string }) {
  return (
    <AuthProvider>
      <OrdersProvider>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </OrdersProvider>
    </AuthProvider>
  )
}

export function renderApp(path = '/') {
  return render(
    <Providers path={path}>
      <Routes>
        <Route path="/" element={<MenuScreen />} />
        <Route path="/admin" element={<AdminRoute />} />
      </Routes>
    </Providers>,
  )
}

export function makeOrder(overrides: Partial<Order> = {}): FakeDoc {
  const order: Order = {
    id: 'pedido-00001',
    customerId: customerProfile.uid,
    customerName: customerProfile.nome,
    customerWhatsapp: customerProfile.whatsapp,
    address: customerProfile.address,
    items: [
      {
        productId: 'smash-casa',
        name: 'Smash da casa',
        image: 'https://smashburguerafogados-ops.github.io/smashburguerafogados-app/menu/smash.svg',
        priceCents: 2800,
        qty: 2,
        note: 'sem cebola',
      },
    ],
    totalCents: 5600,
    payment: { method: 'dinheiro', needsChange: true, cashCents: 10000, changeCents: 4400 },
    status: 'novo',
    reason: '',
    createdAtMs: 1_795_000_000_000,
    ...overrides,
  }
  return order as unknown as FakeDoc
}
