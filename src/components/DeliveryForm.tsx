import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { lookupCep } from '../lib/cep'
import { PHONE_PREFIX, PHONE_REST_LENGTH, deliveryReady, joinPhone, phoneRest, splitPhone } from '../lib/delivery'
import { digitsOnly, formatWhatsapp, maskCep } from '../lib/identity'
import type { UserProfile } from '../types'
import { BuildingIcon, CardIcon, FindMark, PencilIcon, PhoneIcon, PinIcon, SaveIcon } from './Marks'
import { Overlay } from './Overlay'

type DeliveryFormProps = {
  profile: UserProfile
  /** Checkout asks for the phone first, then only the fields still missing. */
  ordering?: boolean
  onClose: () => void
  onSaved: (profile: UserProfile) => void | Promise<void>
}

type CepStatus = 'idle' | 'loading' | 'found' | 'manual'

type Phase = 'phone' | 'searching' | 'finish'

export function DeliveryForm({ profile, ordering = false, onClose, onSaved }: DeliveryFormProps) {
  const { saveDelivery, findCustomer } = useAuth()
  const [nome, setNome] = useState(profile.nome)
  const [knownName, setKnownName] = useState(Boolean(profile.nome.trim()))
  const openedPhone = splitPhone(profile.whatsapp)
  const [ddd, setDdd] = useState(openedPhone.ddd)
  const [rest, setRest] = useState(ordering ? phoneRest(profile.whatsapp) : openedPhone.rest)
  const [cep, setCep] = useState(profile.address?.cep ? maskCep(profile.address.cep) : '')
  const [street, setStreet] = useState(profile.address?.street ?? '')
  const [number, setNumber] = useState(profile.address?.number ?? '')
  const [neighborhood, setNeighborhood] = useState(profile.address?.neighborhood ?? '')
  const [city, setCity] = useState(profile.address?.city ?? '')
  const [stateUf, setStateUf] = useState(profile.address?.state ?? '')
  const [reference, setReference] = useState(profile.address?.reference ?? '')
  const [cepStatus, setCepStatus] = useState<CepStatus>(profile.address ? 'manual' : 'idle')
  const [cepHint, setCepHint] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState(false)
  const identify = ordering && !profile.uid
  const [phase, setPhase] = useState<Phase>(identify ? 'phone' : 'finish')
  const [needsCep, setNeedsCep] = useState(ordering && Boolean(profile.uid) && !profile.address?.street.trim())
  const lookedUp = useRef('')
  const keepCep = useRef(
    profile.address?.street.trim() && digitsOnly(profile.address.cep).length === 8
      ? digitsOnly(profile.address.cep)
      : '',
  )
  const ticket = useRef(0)

  function applyPartial(saved: UserProfile) {
    if (saved.nome.trim()) {
      setNome(saved.nome)
      setKnownName(true)
    }
    const address = saved.address
    if (!address?.street.trim()) {
      setNeedsCep(true)
      return
    }
    setNeedsCep(false)
    const savedCep = digitsOnly(address.cep)
    if (savedCep.length === 8) keepCep.current = savedCep
    setCep(savedCep ? maskCep(savedCep) : '')
    setStreet(address.street)
    setNumber(address.number)
    setNeighborhood(address.neighborhood)
    setCity(address.city)
    setStateUf(address.state)
    setReference(address.reference)
    setCepStatus('manual')
    setCepHint('')
  }

  async function lookupOrder(whatsapp: string) {
    const mine = ++ticket.current
    setPhase('searching')
    setError('')
    const saved = await findCustomer(whatsapp)
    if (mine !== ticket.current) return
    if (saved && deliveryReady(saved)) {
      try {
        await onSaved(saved)
      } catch (err) {
        setPhase('phone')
        setError(err instanceof Error ? err.message : 'Não foi possível enviar o pedido.')
      }
      return
    }
    if (saved) {
      applyPartial(saved)
      if (!saved.address?.street.trim()) setNeedsCep(true)
    } else {
      setNeedsCep(true)
      if (profile.whatsapp && profile.whatsapp !== whatsapp) {
        setKnownName(false)
        setNome('')
      }
    }
    setPhase('finish')
  }

  useEffect(() => {
    const digits = digitsOnly(cep)
    if (keepCep.current && digits === keepCep.current) {
      keepCep.current = ''
      setCepStatus('manual')
      setCepHint('')
      return
    }
    keepCep.current = ''
    if (digits.length !== 8) {
      setCepStatus('idle')
      setCepHint('')
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void (async () => {
        setCepStatus('loading')
        setCepHint('Consultando CEP...')
        try {
          const result = await lookupCep(digits, controller.signal)
          if (controller.signal.aborted) return
          if (!result) {
            setCepStatus('manual')
            setCepHint('CEP não encontrado. Informe endereço, número, bairro e cidade.')
            setStreet('')
            setNeighborhood('')
            setCity('')
            setStateUf('')
            return
          }
          setCepStatus('found')
          setCepHint('Endereço encontrado. Informe o número.')
          setStreet(result.street)
          setNeighborhood(result.neighborhood)
          setCity(result.city)
          setStateUf(result.state)
        } catch (err) {
          if (controller.signal.aborted) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          setCepStatus('manual')
          setCepHint('Não foi possível consultar o CEP. Preencha o endereço.')
          setStreet('')
          setNeighborhood('')
          setCity('')
          setStateUf('')
        }
      })()
    }, 280)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [cep])

  function composedPhone(nextRest: string, nextDdd: string) {
    return ordering ? joinPhone(nextRest) : joinPhone(nextRest, nextDdd)
  }

  function onDdd(value: string) {
    const nextDdd = digitsOnly(value).slice(0, 2)
    setDdd(nextDdd)
    syncPhone(rest, nextDdd)
  }

  function onPhone(value: string) {
    const next = digitsOnly(value).slice(0, PHONE_REST_LENGTH)
    setRest(next)
    syncPhone(next, ddd)
  }

  function syncPhone(nextRest: string, nextDdd: string) {
    const whatsapp = composedPhone(nextRest, nextDdd)
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
      const address = saved.address
      if (!address?.street || street.trim()) return
      const savedCep = digitsOnly(address.cep)
      if (savedCep.length === 8) keepCep.current = savedCep
      setCep(savedCep ? maskCep(savedCep) : '')
      setStreet(address.street)
      setNumber(address.number)
      setNeighborhood(address.neighborhood)
      setCity(address.city)
      setStateUf(address.state)
      setReference(address.reference)
      setCepStatus('manual')
      setCepHint('')
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
    const whatsapp = composedPhone(rest, ddd)
    if (!whatsapp) {
      setError(!ordering && digitsOnly(ddd).length !== 2 ? 'Informe o DDD.' : 'Informe o restante do telefone.')
      return
    }
    if (cepStatus === 'idle' || cepStatus === 'loading') {
      setError('Busque um CEP de 8 dígitos antes de continuar.')
      return
    }
    if (!street.trim() || !number.trim() || !neighborhood.trim() || !city.trim()) {
      setError('Preencha endereço, número, bairro e cidade.')
      return
    }

    setBusy(true)
    try {
      const saved = await saveDelivery({
        nome: cleanName,
        whatsapp,
        address: {
          cep: digitsOnly(cep),
          street,
          number,
          neighborhood,
          city,
          state: stateUf,
          reference,
        },
      })
      await onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar os dados.')
      setBusy(false)
    }
  }

  const showAddress = cepStatus === 'found' || cepStatus === 'manual'
  const asking = !ordering || phase === 'finish'
  const showCep = !ordering || (asking && needsCep)
  const showDetails = !ordering || (asking && (!needsCep || showAddress))
  const showName = !ordering || (asking && !knownName && showDetails)
  const showPhone = !ordering || identify || !joinPhone(phoneRest(profile.whatsapp))
  const [editingSaved] = useState(() => !ordering && Boolean(profile.address?.street.trim()))

  return (
    <Overlay label="Dados para entrega" onClose={onClose} variant="popup" back>
      <h2>Dados para entrega</h2>
      {!ordering && profile.nome.trim() && (
        <div className="account">
          <span className="account__avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8.4" r="3.6" fill="currentColor" />
              <path d="M4.8 19.6c1.4-3.3 4-5 7.2-5s5.8 1.7 7.2 5Z" fill="currentColor" />
            </svg>
          </span>
          <p className="account__name">
            {profile.nome}
            <PencilIcon />
          </p>
          {profile.whatsapp && <p className="account__phone">{formatWhatsapp(profile.whatsapp)}</p>}
        </div>
      )}
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
            : editingSaved
              ? 'Altere o endereço. O próximo pedido usa o que você salvar.'
              : 'Falta nome, telefone ou endereço para concluir o pedido.'}
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
          <span id="delivery-phone">Telefone</span>
          <div className="phone-join">
            <PhoneIcon />
            {!ordering && (
              <input
                aria-label="DDD"
                className="phone-join__ddd"
                inputMode="numeric"
                autoComplete="tel-area-code"
                required
                maxLength={2}
                value={ddd}
                onChange={(event) => onDdd(event.target.value)}
              />
            )}
            <span className="phone-join__prefix" aria-hidden="true">
              {ordering ? PHONE_PREFIX : '9'}
            </span>
            <input
              aria-labelledby="delivery-phone"
              inputMode="numeric"
              autoComplete="tel-national"
              required
              maxLength={PHONE_REST_LENGTH}
              placeholder="0000-0000"
              value={rest}
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

        {showCep && (
          <label className="field">
            <span>CEP</span>
            <span className="field__line">
            <CardIcon />
            <input
              name="postal-code"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              value={cep}
              required
              onChange={(event) => setCep(maskCep(event.target.value))}
            />
            <FindMark />
            </span>
          </label>
        )}
        {showCep && cepHint && (
          <p className={cepStatus === 'found' ? 'hint hint--ok' : 'hint'} role="status">
            {cepHint}
          </p>
        )}

        {showDetails && showAddress && (
          <div className="address">
            <label className="field">
              <span>Endereço</span>
              <span className="field__line">
              <PinIcon />
              <input
                name="street-address"
                autoComplete="street-address"
                value={street}
                maxLength={120}
                required
                onChange={(event) => setStreet(event.target.value)}
              />
              </span>
            </label>
            <label className="field">
              <span>Número</span>
              <input
                name="address-number"
                value={number}
                maxLength={12}
                required
                onChange={(event) => setNumber(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Bairro</span>
              <span className="field__line">
              <BuildingIcon />
              <input
                name="address-level3"
                value={neighborhood}
                maxLength={80}
                required
                onChange={(event) => setNeighborhood(event.target.value)}
              />
              </span>
            </label>
            <label className="field">
              <span>Cidade</span>
              <span className="field__line">
              <PinIcon />
              <input
                name="address-level2"
                value={city}
                maxLength={80}
                required
                onChange={(event) => setCity(event.target.value)}
              />
              </span>
            </label>
            {stateUf && (
              <label className="field">
                <span>UF</span>
                <input name="address-level1" value={stateUf} readOnly />
              </label>
            )}
            <label className="field">
              <span>Ponto de referência (opcional)</span>
              <span className="field__line">
              <BuildingIcon />
              <input
                name="reference"
                value={reference}
                maxLength={140}
                onChange={(event) => setReference(event.target.value)}
              />
              </span>
            </label>
          </div>
        )}

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        {showDetails && (
          <button className="btn" type="submit" disabled={busy}>
            {!busy && <SaveIcon />}
            {busy ? 'Salvando...' : editingSaved ? 'Salvar endereço' : 'Salvar e pedir'}
          </button>
        )}
      </form>
    </Overlay>
  )
}
