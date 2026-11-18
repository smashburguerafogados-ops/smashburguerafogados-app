import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AdminPanel } from './AdminPanel'
import { Shell } from './Shell'
import { StatusScreen } from './StatusScreen'

function useTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}

export function AdminRoute() {
  const { session, logout } = useAuth()
  useTitle('Painel | Smash Burguer')

  if (session.status === 'loading') {
    return (
      <StatusScreen title="Carregando">
        <p className="muted">Abrindo o painel.</p>
      </StatusScreen>
    )
  }

  if (session.status === 'signedOut') {
    return <Navigate to="/" replace />
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

  if (session.profile.role !== 'admin') {
    return (
      <Shell onLogout={() => void logout()}>
        <section className="card">
          <p className="eyebrow">Restrito</p>
          <h1>Acesso restrito</h1>
          <p className="muted">Esta área é só da administração.</p>
        </section>
      </Shell>
    )
  }

  return (
    <Shell onLogout={() => void logout()}>
      <section className="card card--board">
        <p className="eyebrow">Administração</p>
        <h1>Painel</h1>
        <AdminPanel />
      </section>
    </Shell>
  )
}
