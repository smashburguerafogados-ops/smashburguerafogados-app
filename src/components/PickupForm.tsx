import { useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { PHONE_PREFIX, PHONE_REST_LENGTH, joinPhone, phoneRest } from '../lib/delivery'
import { digitsOnly } from '../lib/identity'
import type { UserProfile } from '../types'
import { Overlay } from './Overlay'

type PickupFormProps = {
  profile: UserProfile
  onClose: () => void
  onSaved: (profile: UserProfile) => void
}

export function PickupForm({ profile, onClose, onSaved }: PickupFormProps) {
  const { saveContact, findCustomer } = useAuth()
  const [nome, setNome] = useState(profile.nome)
  const [rest, setRest] = useState(phoneRest(profile.whatsapp))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState(false)
  const lookedUp = useRef('')

  function onPhone(value: string) {
    const next = digitsOnly(value).slice(0, PHONE_REST_LENGTH)
    setRest(next)
    const whatsapp = joinPhone(next)
    if (!whatsapp || profile.uid || lookedUp.current === whatsapp) return
    lookedUp.current = whatsapp
    void findCustomer(whatsapp).then((saved) => {
      if (!saved) return
      setFound(true)
      if (!nome.trim()) setNome(saved.nome)
    })
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const cleanName = nome.trim().replace(/\s+/g, ' ')
    if (!cleanName) {
      setError('Informe seu nome.')
      return
    }
    const whatsapp = joinPhone(rest)
    if (!whatsapp) {
      setError('Informe o restante do telefone.')
      return
    }

    setBusy(true)
    try {
      const saved = await saveContact({ nome: cleanName, whatsapp })
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar os dados.')
      setBusy(false)
    }
  }

  return (
    <Overlay label="Dados para retirada" onClose={onClose} variant="popup">
      <h2>Dados para retirada</h2>
      <p className="muted">Informe nome e telefone. Endereço não é necessário na retirada.</p>
      <form className="delivery" onSubmit={(event) => void onSubmit(event)} noValidate>
        <label className="field">
          <span>Nome</span>
          <input value={nome} maxLength={80} required onChange={(event) => setNome(event.target.value)} />
        </label>

        <div className="field">
          <span id="pickup-phone">Telefone</span>
          <div className="phone-join">
            <span className="phone-join__prefix" aria-hidden="true">
              {PHONE_PREFIX}
            </span>
            <input
              aria-labelledby="pickup-phone"
              inputMode="numeric"
              autoComplete="tel-national"
              required
              maxLength={PHONE_REST_LENGTH}
              placeholder="0000-0000"
              value={rest}
              onChange={(event) => onPhone(event.target.value)}
            />
          </div>
        </div>
        {found && (
          <p className="hint hint--ok" role="status">
            Encontramos seu cadastro. Confira os dados e peça.
          </p>
        )}

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Salvando...' : 'Salvar e pedir'}
        </button>
      </form>
    </Overlay>
  )
}
