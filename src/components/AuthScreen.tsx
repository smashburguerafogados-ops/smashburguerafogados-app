import { useEffect, useState, type FormEvent } from 'react'
import { lookupCep } from '../lib/cep'
import { digitsOnly, maskCep, maskWhatsappInput, normalizeWhatsapp } from '../lib/identity'
import { useAuth } from '../context/AuthContext'
import type { Address } from '../types'
import { FireBackdrop } from './FireBackdrop'

type Mode = 'login' | 'register'
type CepStatus = 'idle' | 'loading' | 'found' | 'manual'

type Locks = {
  street: boolean
  neighborhood: boolean
  city: boolean
}

const UNLOCKED: Locks = { street: false, neighborhood: false, city: false }

function useTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}

export function AuthScreen({ embedded = false }: { embedded?: boolean }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  useTitle(mode === 'login' ? 'Entrar | Smash Burguer' : 'Criar conta | Smash Burguer')

  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [cep, setCep] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [stateUf, setStateUf] = useState('')
  const [reference, setReference] = useState('')
  const [cepStatus, setCepStatus] = useState<CepStatus>('idle')
  const [cepHint, setCepHint] = useState('')
  const [locks, setLocks] = useState<Locks>(UNLOCKED)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const digits = digitsOnly(cep)
    if (digits.length !== 8) {
      setCepStatus('idle')
      setCepHint('')
      setLocks(UNLOCKED)
      setStreet('')
      setNeighborhood('')
      setCity('')
      setStateUf('')
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
            setLocks(UNLOCKED)
            return
          }
          setCepStatus('found')
          setCepHint('Endereço encontrado. Informe o número.')
          setStreet(result.street)
          setNeighborhood(result.neighborhood)
          setCity(result.city)
          setStateUf(result.state)
          setLocks({
            street: result.street.length > 0,
            neighborhood: result.neighborhood.length > 0,
            city: result.city.length > 0,
          })
        } catch (error) {
          if (controller.signal.aborted) return
          if (error instanceof DOMException && error.name === 'AbortError') return
          setCepStatus('manual')
          setCepHint('Não foi possível consultar o CEP. Preencha o endereço.')
          setLocks(UNLOCKED)
        }
      })()
    }, 280)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [cep])

  function switchMode(next: Mode) {
    setMode(next)
    setFormError('')
  }

  function unlockAddress() {
    setLocks(UNLOCKED)
    setCepStatus('manual')
    setCepHint('Edite o endereço e informe o número.')
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    if (!normalizeWhatsapp(whatsapp)) {
      setFormError('Informe um WhatsApp válido com DDD.')
      return
    }
    if (password.length < 6) {
      setFormError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(whatsapp, password)
        return
      }

      const cleanName = nome.trim().replace(/\s+/g, ' ')
      if (cleanName.length < 3 || !/\p{L}/u.test(cleanName)) {
        setFormError('Informe seu nome.')
        return
      }
      if (password !== confirm) {
        setFormError('As senhas não conferem.')
        return
      }
      if (cepStatus === 'idle' || cepStatus === 'loading') {
        setFormError('Busque um CEP de 8 dígitos antes de continuar.')
        return
      }
      if (!street.trim() || !neighborhood.trim() || !city.trim() || !number.trim()) {
        setFormError('Preencha endereço, número, bairro e cidade.')
        return
      }

      const address: Address = {
        cep: digitsOnly(cep),
        street: street.trim(),
        number: number.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: stateUf.trim(),
        reference: reference.trim(),
      }
      await register({ nome: cleanName, whatsapp, password, address })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível concluir.')
    } finally {
      setSubmitting(false)
    }
  }

  const showAddress = mode === 'register' && (cepStatus === 'found' || cepStatus === 'manual')

  return (
    <div className={embedded ? 'auth auth--sheet' : 'stage stage--fire'}>
      {!embedded && <FireBackdrop />}
      {!embedded && <div className="stage__glow" aria-hidden="true" />}
      <div className={embedded ? 'auth__sheet' : 'auth'}>
        {!embedded && (
          <img
            className="auth__logo"
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Smash Burguer"
          />
        )}
        <section className="card">
          <div className="tabs" role="tablist" aria-label="Acesso">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'is-active' : ''}
              onClick={() => switchMode('login')}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'is-active' : ''}
              onClick={() => switchMode('register')}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={onSubmit} noValidate>
            {mode === 'register' && (
              <label className="field">
                <span>Nome</span>
                <input
                  name="name"
                  autoComplete="name"
                  value={nome}
                  maxLength={80}
                  onChange={(event) => setNome(event.target.value)}
                  required
                />
              </label>
            )}

            <label className="field">
              <span>WhatsApp</span>
              <input
                name="tel"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(87) 99999-9999"
                value={whatsapp}
                onChange={(event) => setWhatsapp(maskWhatsappInput(event.target.value))}
                required
              />
            </label>

            <label className="field">
              <span>Senha</span>
              <div className="password">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  maxLength={64}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password__toggle"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </label>

            {mode === 'register' && (
              <label className="field">
                <span>Confirmar senha</span>
                <input
                  name="confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  maxLength={64}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                />
              </label>
            )}
            {mode === 'register' && <p className="hint">Mínimo de 6 caracteres.</p>}

            {mode === 'register' && (
              <label className="field">
                <span>CEP</span>
                <input
                  name="postal-code"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(event) => setCep(maskCep(event.target.value))}
                  required
                />
              </label>
            )}

            {mode === 'register' && cepHint && (
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
                    readOnly={locks.street}
                    maxLength={120}
                    onChange={(event) => setStreet(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Número</span>
                  <input
                    name="address-number"
                    value={number}
                    maxLength={12}
                    onChange={(event) => setNumber(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Bairro</span>
                  <input
                    name="address-level3"
                    value={neighborhood}
                    readOnly={locks.neighborhood}
                    maxLength={80}
                    onChange={(event) => setNeighborhood(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Cidade</span>
                  <input
                    name="address-level2"
                    value={city}
                    readOnly={locks.city}
                    maxLength={80}
                    onChange={(event) => setCity(event.target.value)}
                    required
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
                {cepStatus === 'found' && (locks.street || locks.neighborhood || locks.city) && (
                  <button type="button" className="text-btn" onClick={unlockAddress}>
                    O endereço não está certo
                  </button>
                )}
              </div>
            )}

            {formError && (
              <p className="alert" role="alert">
                {formError}
              </p>
            )}

            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
            {mode === 'login' && (
              <p className="hint">Use o WhatsApp e a senha do cadastro.</p>
            )}
          </form>
        </section>
      </div>
    </div>
  )
}
