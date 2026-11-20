import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { lookupCep } from '../lib/cep'
import { PHONE_PREFIX, PHONE_REST_LENGTH, joinPhone, phoneRest } from '../lib/delivery'
import { digitsOnly, maskCep } from '../lib/identity'
import type { UserProfile } from '../types'
import { Overlay } from './Overlay'

type DeliveryFormProps = {
  profile: UserProfile
  onClose: () => void
  onSaved: (profile: UserProfile) => void
}

type CepStatus = 'idle' | 'loading' | 'found' | 'manual'

export function DeliveryForm({ profile, onClose, onSaved }: DeliveryFormProps) {
  const { saveDelivery, findCustomer } = useAuth()
  const [nome, setNome] = useState(profile.nome)
  const [rest, setRest] = useState(phoneRest(profile.whatsapp))
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
  const lookedUp = useRef('')
  const keepCep = useRef('')

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
    const whatsapp = joinPhone(rest)
    if (!whatsapp) {
      setError('Informe o restante do telefone.')
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
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar os dados.')
      setBusy(false)
    }
  }

  const showAddress = cepStatus === 'found' || cepStatus === 'manual'

  return (
    <Overlay label="Dados para entrega" onClose={onClose} variant="popup">
      <h2>Dados para entrega</h2>
      <p className="muted">Falta nome, telefone ou endereço para concluir o pedido.</p>
      <form className="delivery" onSubmit={(event) => void onSubmit(event)} noValidate>
        <label className="field">
          <span>Nome</span>
          <input value={nome} maxLength={80} required onChange={(event) => setNome(event.target.value)} />
        </label>

        <div className="field">
          <span id="delivery-phone">Telefone</span>
          <div className="phone-join">
            <span className="phone-join__prefix" aria-hidden="true">
              {PHONE_PREFIX}
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
          </div>
        </div>
        {found && (
          <p className="hint hint--ok" role="status">
            Encontramos seu cadastro. Confira os dados e peça.
          </p>
        )}

        <label className="field">
          <span>CEP</span>
          <input
            name="postal-code"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={cep}
            required
            onChange={(event) => setCep(maskCep(event.target.value))}
          />
        </label>
        {cepHint && (
          <p className={cepStatus === 'found' ? 'hint hint--ok' : 'hint'} role="status">
            {cepHint}
          </p>
        )}

        {showAddress && (
          <div className="address">
            <label className="field">
              <span>Endereço</span>
              <input
                name="street-address"
                autoComplete="street-address"
                value={street}
                maxLength={120}
                required
                onChange={(event) => setStreet(event.target.value)}
              />
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
              <input
                name="address-level3"
                value={neighborhood}
                maxLength={80}
                required
                onChange={(event) => setNeighborhood(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Cidade</span>
              <input
                name="address-level2"
                value={city}
                maxLength={80}
                required
                onChange={(event) => setCity(event.target.value)}
              />
            </label>
            {stateUf && (
              <label className="field">
                <span>UF</span>
                <input name="address-level1" value={stateUf} readOnly />
              </label>
            )}
            <label className="field">
              <span>Ponto de referência (opcional)</span>
              <input
                name="reference"
                value={reference}
                maxLength={140}
                onChange={(event) => setReference(event.target.value)}
              />
            </label>
          </div>
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
