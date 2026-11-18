import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Overlay } from './Overlay'

type AdminPromptProps = {
  onClose: () => void
}

export function AdminPrompt({ onClose }: AdminPromptProps) {
  const { loginWithEmail } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await loginWithEmail(email, password)
      navigate('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Overlay label="Administração" onClose={onClose} variant="popup">
      <form className="admin-login" onSubmit={onSubmit}>
        <input
          type="email"
          aria-label="E-mail"
          placeholder="E-mail"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          type="password"
          aria-label="Senha"
          placeholder="Senha"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Aguarde...' : 'Entrar'}
        </button>
      </form>
    </Overlay>
  )
}
