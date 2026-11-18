import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type ShellProps = {
  children: ReactNode
  onLogout: () => void
  menu?: ReactNode
}

export function Shell({ children, onLogout, menu }: ShellProps) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar__lead">
          {menu}
          <Link to="/" className="topbar__brand">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Smash Burguer" />
          </Link>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onLogout}>
          Sair
        </button>
      </header>
      <main className="shell__main">{children}</main>
    </div>
  )
}
