import { useState } from 'react'
import { formatWhatsapp, normalizeWhatsapp } from '../lib/identity'
import { BUSINESS_WHATSAPP, broadcastMessage, openWhatsapp, openWhatsappTab } from '../lib/whatsapp'
import type { UserProfile } from '../types'
import { CloseButton } from './Overlay'

type BroadcastScreenProps = {
  people: UserProfile[]
  status: 'loading' | 'ready' | 'error'
  onClose: () => void
}

function OptionLines({ number, name }: { number: string; name: string }) {
  return (
    <span className="wa-option">
      <span className="wa-option__number">{number}</span>
      <span className="wa-option__name">{name}</span>
    </span>
  )
}

export function BroadcastScreen({ people, status, onClose }: BroadcastScreenProps) {
  const reachable = people.filter((person) => normalizeWhatsapp(person.whatsapp))
  const [target, setTarget] = useState('all')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [left, setLeft] = useState<UserProfile[]>([])
  const [openedName, setOpenedName] = useState('')
  const [sentMany, setSentMany] = useState(false)

  const selected = target === 'all' ? null : (reachable.find((person) => person.uid === target) ?? null)
  const recipients = selected ? [selected] : reachable

  function labelOf(person: UserProfile): string {
    const number = normalizeWhatsapp(person.whatsapp)
    return person.nome || (number ? formatWhatsapp(number) : 'cliente')
  }

  function sendTo(list: UserProfile[]) {
    const text = broadcastMessage(message)
    if (list.length === 1) {
      const number = normalizeWhatsapp(list[0].whatsapp)
      if (!number) return
      openWhatsapp(number, text)
      setLeft([])
      setOpenedName(labelOf(list[0]))
      setSentMany(false)
      return
    }
    const pending: UserProfile[] = []
    let name = ''
    for (const person of list) {
      const number = normalizeWhatsapp(person.whatsapp)
      if (!number) continue
      if (openWhatsappTab(number, text)) {
        if (!name) name = labelOf(person)
      } else {
        pending.push(person)
      }
    }
    setLeft(pending)
    setOpenedName(name)
    setSentMany(true)
  }

  function send() {
    if (!message.trim() || recipients.length === 0) return
    sendTo(recipients)
  }

  function openNext() {
    const person = left[0]
    if (!person) return
    const number = normalizeWhatsapp(person.whatsapp)
    if (!number) {
      setLeft((current) => current.slice(1))
      return
    }
    openWhatsapp(number, broadcastMessage(message))
    setOpenedName(labelOf(person))
    setLeft((current) => current.slice(1))
  }

  return (
    <div className="product-screen" role="dialog" aria-modal="true" aria-label="Enviar WhatsApp">
      <div className="product-screen__inner">
        <div className="product-screen__bar">
          <h2>Enviar WhatsApp</h2>
          <CloseButton onClick={onClose} />
        </div>
        <p className="muted wa-from">Pelo WhatsApp {formatWhatsapp(BUSINESS_WHATSAPP)}</p>
        {status === 'loading' && <p className="muted">Carregando clientes.</p>}
        {status === 'error' && (
          <p className="alert" role="alert">
            Não foi possível carregar os clientes.
          </p>
        )}
        {status === 'ready' && reachable.length === 0 && <p className="muted">Nenhum cliente com WhatsApp.</p>}
        {status === 'ready' && reachable.length > 0 && (
          <div className="wa-select">
            <span id="wa-who">Para</span>
            <button
              type="button"
              className="wa-select__button"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls="wa-who-list"
              onClick={() => setOpen((current) => !current)}
            >
              {selected ? (
                <OptionLines number={formatWhatsapp(normalizeWhatsapp(selected.whatsapp) ?? '')} name={selected.nome || 'Sem nome'} />
              ) : (
                <OptionLines number="Todos" name="Todos os cadastrados" />
              )}
            </button>
            {open && (
              <ul id="wa-who-list" className="wa-select__list" role="listbox" aria-labelledby="wa-who">
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={target === 'all'}
                    onClick={() => {
                      setTarget('all')
                      setOpen(false)
                    }}
                  >
                    <OptionLines number="Todos" name="Todos os cadastrados" />
                  </button>
                </li>
                {reachable.map((person) => {
                  const number = formatWhatsapp(normalizeWhatsapp(person.whatsapp) ?? person.whatsapp)
                  return (
                    <li key={person.uid}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={target === person.uid}
                        onClick={() => {
                          setTarget(person.uid)
                          setOpen(false)
                        }}
                      >
                        <OptionLines number={number} name={person.nome || 'Sem nome'} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
        <label className="field">
          <span>Mensagem</span>
          <textarea
            value={message}
            maxLength={500}
            placeholder="Texto da mensagem"
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <p className="muted">A mensagem sai com o ícone do Smash e este texto. Todos usa o mesmo texto.</p>
        <button type="button" className="btn" disabled={!message.trim() || recipients.length === 0} onClick={send}>
          Enviar
        </button>
        {openedName && left.length === 0 && (
          <p className="notice" role="status">
            {sentMany ? 'Conversas abertas no WhatsApp.' : `Conversa aberta com ${openedName}.`}
          </p>
        )}
        {left.length > 0 && (
          <div className="wa-limit" role="status">
            <p>
              O navegador só abre uma conversa do WhatsApp por toque.
              {openedName ? ` A de ${openedName} foi aberta.` : ' Nenhuma conversa abriu neste toque.'} Falta{' '}
              {left.length === 1 ? '1 pessoa' : `${left.length} pessoas`}.
            </p>
            <button type="button" className="btn" onClick={openNext}>
              Abrir a próxima
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
