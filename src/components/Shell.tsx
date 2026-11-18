import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type ShellProps = {
  children: ReactNode
  onLogout: () => void
}

export function Shell({ children, onLogout }: ShellProps) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="topbar__brand">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Smash Burguer" />
        </Link>
        <button type="button" className="btn btn--ghost" onClick={onLogout}>
          Sair
        </button>
      </header>
      <main className="shell__main">{children}</main>
    </div>
  )
}
