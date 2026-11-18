import { useCallback, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './components/AdminRoute'
import { AuthScreen } from './components/AuthScreen'
import { CustomerHome } from './components/CustomerHome'
import { Splash } from './components/Splash'
import { StatusScreen } from './components/StatusScreen'
import { AuthProvider, useAuth } from './context/AuthContext'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

function HomeRoute() {
  const { session, logout } = useAuth()

  if (session.status === 'loading') {
    return (
      <StatusScreen title="Carregando">
        <p className="muted">Conferindo a sessão.</p>
      </StatusScreen>
    )
  }

  if (session.status === 'error') {
    return (
      <StatusScreen title="Conta">
        <p>{session.message}</p>
        <button type="button" className="btn" onClick={() => void logout()}>
          Sair
        </button>
      </StatusScreen>
    )
  }

  if (session.status === 'signedOut') return <AuthScreen />
  return <CustomerHome profile={session.profile} />
}

function AppRoutes() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export function App() {
  const [booting, setBooting] = useState(true)
  const finishBoot = useCallback(() => setBooting(false), [])

  return (
    <AuthProvider>
      {booting ? <Splash onDone={finishBoot} /> : <AppRoutes />}
    </AuthProvider>
  )
}
