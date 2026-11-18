import { useState } from 'react'
import { formatWhatsapp } from '../lib/identity'
import { matchesContact } from '../lib/contacts'
import { openWhatsapp } from '../lib/whatsapp'
import type { UserProfile } from '../types'
import { CloseButton } from './Overlay'

function SendMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.2 11.2L20.5 3.2l-7.4 17.2-2.2-6.7-7.7-2.5z" fill="currentColor" />
    </svg>
  )
}

type ContactScreenProps = {
  people: UserProfile[]
  status: 'loading' | 'ready' | 'error'
  onClose: () => void
}

export function ContactScreen({ people, status, onClose }: ContactScreenProps) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const visible = people.filter((person) => matchesContact(person, query))
  const selected = people.find((person) => person.uid === selectedId) ?? null

  function choose(person: UserProfile) {
    setSelectedId(person.uid)
    setMessage('')
  }

  function send() {
    if (!selected) return
    const text = message.trim()
    if (!text) return
    openWhatsapp(selected.whatsapp, text)
  }

  return (
    <div className="product-screen" role="dialog" aria-modal="true" aria-label="Contato">
      <div className="product-screen__inner">
        <div className="product-screen__bar">
          <h2>Contato</h2>
          <CloseButton onClick={onClose} />
        </div>
        <label className="field">
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            placeholder="Nome ou telefone"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {status === 'loading' && <p className="muted">Carregando clientes.</p>}
        {status === 'error' && (
          <p className="alert" role="alert">
            Não foi possível carregar os clientes.
          </p>
        )}
        {status === 'ready' && visible.length === 0 && <p className="muted">Nenhum cliente encontrado.</p>}
        {status === 'ready' && visible.length > 0 && (
          <ul className="contact-list">
            {visible.map((person) => (
              <li key={person.uid}>
                <button
                  type="button"
                  className={selected?.uid === person.uid ? 'is-selected' : ''}
                  aria-pressed={selected?.uid === person.uid}
                  onClick={() => choose(person)}
                >
                  <strong>{person.nome || 'Sem nome'}</strong>
                  <span>{person.whatsapp ? formatWhatsapp(person.whatsapp) : 'Sem telefone'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selected && (
          <div className="contact-compose">
            <label className="field">
              <span>Mensagem para {selected.nome || 'cliente'}</span>
              <textarea value={message} maxLength={500} onChange={(event) => setMessage(event.target.value)} />
            </label>
            <button type="button" className="send-btn" aria-label="Enviar" disabled={!message.trim()} onClick={send}>
              <SendMark />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
