import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AdminPanel } from './AdminPanel'
import { ProductForm } from './ProductForm'
import { Shell } from './Shell'
import { SideMenu } from './SideMenu'
import { StatusScreen } from './StatusScreen'

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function useTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}

export function AdminRoute() {
  const { session, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [creating, setCreating] = useState(false)
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
    <Shell
      onLogout={() => void logout()}
      menu={
        <button
          type="button"
          className="menu__burger"
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuIcon />
        </button>
      }
    >
      <section className="card card--board">
        <p className="eyebrow">Administração</p>
        <h1>Painel</h1>
        <AdminPanel />
      </section>
      {menuOpen && (
        <SideMenu
          onClose={() => setMenuOpen(false)}
          onPanel={() => setMenuOpen(false)}
          onCreateProduct={() => {
            setMenuOpen(false)
            setCreating(true)
          }}
        />
      )}
      {creating && <ProductForm onClose={() => setCreating(false)} onSaved={() => undefined} />}
    </Shell>
  )
}
