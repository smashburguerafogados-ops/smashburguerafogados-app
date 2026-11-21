import { useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { contactReady, phoneFieldValue, phoneFromField } from '../lib/delivery'
import { maskWhatsappInput } from '../lib/identity'
import type { UserProfile } from '../types'
import { FindMark, PhoneIcon, SaveIcon } from './Marks'
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
  const [phone, setPhone] = useState(phoneFieldValue(profile.whatsapp))
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
    const next = maskWhatsappInput(value)
    setPhone(next)
    const whatsapp = phoneFromField(next)
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
    const whatsapp = phoneFromField(phone)
    if (!whatsapp) {
      setError('Informe o telefone com DDD.')
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
  const showPhone = !ordering || identify || !phoneFromField(profile.whatsapp)
  const showSave = !ordering || (phase === 'finish' && (showName || showPhone))

  return (
    <Overlay label="Dados para retirada" onClose={onClose} variant="popup" back>
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
            <PhoneIcon />
            <input
              aria-labelledby="pickup-phone"
              inputMode="numeric"
              autoComplete="tel"
              required
              placeholder="(87) 98888-7777"
              value={phone}
              onChange={(event) => onPhone(event.target.value)}
            />
            <FindMark />
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
            {!busy && <SaveIcon />}
            {busy ? 'Salvando...' : 'Salvar e pedir'}
          </button>
        )}
      </form>
    </Overlay>
  )
}
