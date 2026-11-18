import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './components/AdminRoute'
import { MenuScreen } from './components/MenuScreen'
import { AuthProvider } from './context/AuthContext'
import { firebaseMocks } from './test/mocks'

function renderGate() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<MenuScreen />} />
          <Route path="/admin" element={<AdminRoute />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

async function openAdmin(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Smash Burger' }))
  await new Promise((resolve) => {
    window.setTimeout(resolve, 750)
  })
  const dialog = screen.getByRole('dialog', { name: 'Administração' })
  const close = within(dialog).getByRole('button', { name: 'Fechar' })
  expect(close).toHaveClass('mark-btn')
  expect(close).not.toHaveTextContent('Fechar')
  expect(dialog.querySelectorAll('input')).toHaveLength(2)
  expect(dialog.querySelector('h2')).toBeNull()
  await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'pessoa@example.com')
  await user.type(screen.getByLabelText('Senha'), 'segredo-teste')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

it('does not open the panel for a customer', async () => {
  firebaseMocks.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'user-1' } })
  firebaseMocks.getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ uid: 'user-1', role: 'customer', nome: 'Ana', whatsapp: '5587988887777' }),
  })

  const user = userEvent.setup()
  renderGate()
  await openAdmin(user)

  expect(await screen.findByRole('alert')).toHaveTextContent('Acesso restrito.')
  expect(screen.queryByRole('heading', { name: 'Painel' })).not.toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  expect(firebaseMocks.signInWithEmailAndPassword).toHaveBeenCalledWith(
    expect.anything(),
    'pessoa@example.com',
    'segredo-teste',
  )
})

it('opens the orders panel only when the account role is admin', async () => {
  firebaseMocks.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'admin-1' } })
  firebaseMocks.getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ uid: 'admin-1', role: 'admin', nome: 'Admin', whatsapp: '' }),
  })

  const user = userEvent.setup()
  renderGate()
  await openAdmin(user)

  expect(await screen.findByRole('heading', { name: 'Painel' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Novos/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Em Andamento/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Finalizados/ })).toBeInTheDocument()
})
