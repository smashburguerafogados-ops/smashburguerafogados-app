import { useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { PHONE_PREFIX, PHONE_REST_LENGTH, contactReady, joinPhone, phoneRest } from '../lib/delivery'
import { digitsOnly } from '../lib/identity'
import type { UserProfile } from '../types'
import { Overlay } from './Overlay'

type PickupFormProps = {
  profile: UserProfile
  /** Checkout asks for the phone first, then only a missing name. */
  ordering?: boolean
  onClose: () => void
  onSaved: (profile: UserProfile) => void | Promise<void>
}

type Phase = 'phone' | 'searching' | 'finish'

export function PickupForm({ profile, ordering = false, onClose, onSaved }: PickupFormProps) {
  const { saveContact, findCustomer } = useAuth()
  const [nome, setNome] = useState(profile.nome)
  const [knownName, setKnownName] = useState(Boolean(profile.nome.trim()))
  const [rest, setRest] = useState(phoneRest(profile.whatsapp))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState(false)
  const identify = ordering && !profile.uid
  const [phase, setPhase] = useState<Phase>(identify ? 'phone' : 'finish')
  const lookedUp = useRef('')
  const ticket = useRef(0)

  async function lookupOrder(whatsapp: string) {
    const mine = ++ticket.current
    setPhase('searching')
    setError('')
    const saved = await findCustomer(whatsapp)
    if (mine !== ticket.current) return
    if (saved && contactReady(saved)) {
      try {
        await onSaved(saved)
      } catch (err) {
        setPhase('phone')
        setError(err instanceof Error ? err.message : 'Não foi possível enviar o pedido.')
      }
      return
    }
    if (saved?.nome.trim()) {
      setNome(saved.nome)
      setKnownName(true)
    } else if (profile.whatsapp && profile.whatsapp !== whatsapp) {
      setKnownName(false)
      setNome('')
    }
    setPhase('finish')
  }

  function onPhone(value: string) {
    const next = digitsOnly(value).slice(0, PHONE_REST_LENGTH)
    setRest(next)
    const whatsapp = joinPhone(next)
    if (identify) {
      if (!whatsapp) {
        ticket.current += 1
        setPhase('phone')
        setError('')
        return
      }
      void lookupOrder(whatsapp)
      return
    }
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
      await onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar os dados.')
      setBusy(false)
    }
  }

  const showName = !ordering || (phase === 'finish' && !knownName)
  const showPhone = !ordering || identify || !joinPhone(phoneRest(profile.whatsapp))
  const showSave = !ordering || (phase === 'finish' && (showName || showPhone))

  return (
    <Overlay label="Dados para retirada" onClose={onClose} variant="popup">
      <h2>Dados para retirada</h2>
      {ordering && phase === 'searching' ? (
        <p className="muted" role="status">
          Buscando cadastro...
        </p>
      ) : ordering && phase === 'finish' ? (
        <p className="muted">Finalize seu cadastro.</p>
      ) : (
        <p className="muted">
          {ordering
            ? 'Informe o telefone para continuar o pedido.'
            : 'Informe nome e telefone. Endereço não é necessário na retirada.'}
        </p>
      )}
      <form className="delivery" onSubmit={(event) => void onSubmit(event)} noValidate>
        {showName && (
          <label className="field">
            <span>Nome</span>
            <input value={nome} maxLength={80} required onChange={(event) => setNome(event.target.value)} />
          </label>
        )}

        {showPhone && (
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
        )}
        {found && !ordering && (
          <p className="hint hint--ok" role="status">
            Encontramos seu cadastro. Confira os dados e peça.
          </p>
        )}

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        {showSave && (
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Salvando...' : 'Salvar e pedir'}
          </button>
        )}
      </form>
    </Overlay>
  )
}
