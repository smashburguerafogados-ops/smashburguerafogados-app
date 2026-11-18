import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AdminPanel } from './AdminPanel'
import { ProductDesk } from './ProductDesk'
import { ProductForm } from './ProductForm'
import { SideMenu } from './SideMenu'

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

function AdminFrame({
  children,
  onLogout,
  menu,
}: {
  children: ReactNode
  onLogout: () => void
  menu?: ReactNode
}) {
  return (
    <div className="admin">
      <header className="admin__bar">
        <div className="admin__lead">{menu}</div>
        <button type="button" className="btn btn--ghost" onClick={onLogout}>
          Sair
        </button>
      </header>
      <main className="admin__main">{children}</main>
    </div>
  )
}

export function AdminRoute() {
  const { session, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [desk, setDesk] = useState(false)
  useTitle('Painel | Smash Burguer')

  if (session.status === 'loading') {
    return (
      <AdminFrame onLogout={() => void logout()}>
        <h1>Carregando</h1>
        <p className="muted">Abrindo o painel.</p>
      </AdminFrame>
    )
  }

  if (session.status === 'signedOut') {
    return <Navigate to="/" replace />
  }

  if (session.status === 'error') {
    return (
      <AdminFrame onLogout={() => void logout()}>
        <h1>Conta</h1>
        <p>{session.message}</p>
      </AdminFrame>
    )
  }

  if (session.profile.role !== 'admin') {
    return (
      <AdminFrame onLogout={() => void logout()}>
        <p className="eyebrow">Restrito</p>
        <h1>Acesso restrito</h1>
        <p className="muted">Esta área é só da administração.</p>
      </AdminFrame>
    )
  }

  return (
    <AdminFrame
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
      <h1>Painel</h1>
      <AdminPanel />
      {menuOpen && (
        <SideMenu
          onClose={() => setMenuOpen(false)}
          onPanel={() => setMenuOpen(false)}
          onProducts={() => {
            setMenuOpen(false)
            setCreating(false)
            setDesk(true)
          }}
          onCreateProduct={() => {
            setMenuOpen(false)
            setDesk(false)
            setCreating(true)
          }}
        />
      )}
      {creating && <ProductForm onClose={() => setCreating(false)} onSaved={() => undefined} />}
      {desk && <ProductDesk onClose={() => setDesk(false)} />}
    </AdminFrame>
  )
}
