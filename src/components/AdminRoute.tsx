import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { watchCustomers } from '../lib/contacts'
import { watchRevenue, type RevenueEntry } from '../lib/revenue'
import { useTheme } from '../lib/theme'
import type { UserProfile } from '../types'
import { AdminPanel } from './AdminPanel'
import { ContactScreen } from './ContactScreen'
import { ProductDesk } from './ProductDesk'
import { ProductForm } from './ProductForm'
import { RevenueScreen } from './RevenueScreen'
import { ThemeScreen } from './ThemeScreen'
import { RaffleScreen } from './RaffleScreen'
import { ShopScreen } from './ShopControls'
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

function useRevenue(enabled: boolean) {
  const [entries, setEntries] = useState<RevenueEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!enabled) return
    setStatus('loading')
    return watchRevenue(
      (next) => {
        setEntries(next)
        setStatus('ready')
      },
      () => setStatus('error'),
    )
  }, [enabled])

  return { entries, status }
}

function useCustomers(enabled: boolean) {
  const [people, setPeople] = useState<UserProfile[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!enabled) return
    setStatus('loading')
    return watchCustomers(
      (next) => {
        setPeople(next)
        setStatus('ready')
      },
      () => setStatus('error'),
    )
  }, [enabled])

  return { people, status }
}

export function AdminRoute() {
  const { session, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [desk, setDesk] = useState(false)
  const [shop, setShop] = useState(false)
  const [revenueOpen, setRevenueOpen] = useState(false)
  const [themesOpen, setThemesOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [raffleOpen, setRaffleOpen] = useState(false)
  const adminReady = session.status === 'ready' && session.profile.role === 'admin'
  const revenue = useRevenue(adminReady)
  const contacts = useCustomers(adminReady)
  const theme = useTheme()
  useTitle('Painel | Smash Burger')

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
          onShop={() => {
            setMenuOpen(false)
            setCreating(false)
            setDesk(false)
            setRevenueOpen(false)
            setThemesOpen(false)
            setContactOpen(false)
            setRaffleOpen(false)
            setShop(true)
          }}
          onProducts={() => {
            setMenuOpen(false)
            setCreating(false)
            setShop(false)
            setRevenueOpen(false)
            setThemesOpen(false)
            setContactOpen(false)
            setRaffleOpen(false)
            setDesk(true)
          }}
          onRevenue={() => {
            setMenuOpen(false)
            setCreating(false)
            setDesk(false)
            setShop(false)
            setThemesOpen(false)
            setContactOpen(false)
            setRaffleOpen(false)
            setRevenueOpen(true)
          }}
          onThemes={() => {
            setMenuOpen(false)
            setCreating(false)
            setDesk(false)
            setShop(false)
            setRevenueOpen(false)
            setContactOpen(false)
            setRaffleOpen(false)
            setThemesOpen(true)
          }}
          onContact={() => {
            setMenuOpen(false)
            setCreating(false)
            setDesk(false)
            setShop(false)
            setRevenueOpen(false)
            setThemesOpen(false)
            setRaffleOpen(false)
            setContactOpen(true)
          }}
          onRaffle={() => {
            setMenuOpen(false)
            setCreating(false)
            setDesk(false)
            setShop(false)
            setRevenueOpen(false)
            setThemesOpen(false)
            setContactOpen(false)
            setRaffleOpen(true)
          }}
          onCreateProduct={() => {
            setMenuOpen(false)
            setDesk(false)
            setShop(false)
            setRevenueOpen(false)
            setThemesOpen(false)
            setContactOpen(false)
            setRaffleOpen(false)
            setCreating(true)
          }}
        />
      )}
      {creating && <ProductForm onClose={() => setCreating(false)} onSaved={() => undefined} />}
      {desk && <ProductDesk onClose={() => setDesk(false)} />}
      {shop && <ShopScreen onClose={() => setShop(false)} />}
      {revenueOpen && (
        <RevenueScreen entries={revenue.entries} status={revenue.status} onClose={() => setRevenueOpen(false)} />
      )}
      {themesOpen && <ThemeScreen applied={theme} onClose={() => setThemesOpen(false)} />}
      {contactOpen && (
        <ContactScreen people={contacts.people} status={contacts.status} onClose={() => setContactOpen(false)} />
      )}
      {raffleOpen && <RaffleScreen onClose={() => setRaffleOpen(false)} />}
    </AdminFrame>
  )
}
