import { useEffect, useState } from 'react'
import { blockPhone, NOTE_MAX, unblockPhone, useBlockedList } from '../lib/blocked'
import { phoneFromField } from '../lib/delivery'
import { digitsOnly, formatWhatsapp, maskWhatsappInput } from '../lib/identity'
import { PhoneIcon } from './Marks'
import { CloseButton } from './Overlay'

function failure(error: unknown, fallback: string): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : ''
  if (code === 'permission-denied') return 'Sem permissão. Publique as regras novas no Firebase.'
  return error instanceof Error && !code ? error.message : fallback
}

export function BlockScreen({ onClose }: { onClose: () => void }) {
  const { list, status } = useBlockedList()
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function add() {
    setError('')
    if (!phoneFromField(phone)) {
      setError('Informe o telefone com DDD.')
      return
    }
    setBusy(true)
    try {
      await blockPhone(phone, note)
      setPhone('')
      setNote('')
    } catch (err) {
      setError(failure(err, 'Não foi possível bloquear.'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(value: string) {
    setError('')
    try {
      await unblockPhone(value)
    } catch (err) {
      setError(failure(err, 'Não foi possível desbloquear.'))
    }
  }

  const text = query.trim().toLocaleLowerCase('pt')
  const digits = digitsOnly(query)
  const visible = list.filter(
    (entry) =>
      !text || (digits.length > 0 && entry.phone.includes(digits)) || entry.note.toLocaleLowerCase('pt').includes(text),
  )

  return (
    <div className="product-screen" role="dialog" aria-modal="true" aria-label="Bloquear">
      <div className="product-screen__inner">
        <div className="product-screen__bar">
          <h2>Bloquear</h2>
          <CloseButton onClick={onClose} />
        </div>
        <p className="muted">Número bloqueado não consegue pedir e fica preso no carregamento.</p>
        <div className="category-tools category-tools--new">
          <div className="field">
            <span id="block-phone">Telefone</span>
            <div className="phone-join">
              <PhoneIcon />
              <input
                aria-labelledby="block-phone"
                inputMode="numeric"
                autoComplete="off"
                placeholder="(87) 98888-7777"
                value={phone}
                onChange={(event) => setPhone(maskWhatsappInput(event.target.value))}
              />
            </div>
          </div>
          <label className="field">
            <span>Observação (opcional)</span>
            <input value={note} maxLength={NOTE_MAX} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void add()}>
            Bloquear número
          </button>
        </div>
        {status === 'error' && (
          <p className="alert" role="alert">
            Não foi possível carregar a lista. Publique as regras novas no Firebase.
          </p>
        )}
        {status === 'ready' && list.length > 0 && (
          <label className="field">
            <span className="sr-only">Buscar</span>
            <input
              type="search"
              placeholder="Telefone ou observação"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}
        {status === 'loading' && <p className="muted">Carregando.</p>}
        {status === 'ready' && list.length === 0 && <p className="muted">Nenhum número bloqueado.</p>}
        {status === 'ready' && list.length > 0 && visible.length === 0 && (
          <p className="muted">Nenhum número encontrado.</p>
        )}
        {visible.length > 0 && (
          <ul className="catalog catalog--cards">
            {visible.map((entry) => (
              <li key={entry.phone}>
                <article className="catalog__card catalog__card--row" aria-label={formatWhatsapp(entry.phone)}>
                  <div className="blocked__info">
                    <strong>{formatWhatsapp(entry.phone)}</strong>
                    {entry.note && <span className="muted">{entry.note}</span>}
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost blocked__undo"
                    aria-label={`Desbloquear ${formatWhatsapp(entry.phone)}`}
                    onClick={() => void remove(entry.phone)}
                  >
                    Desbloquear
                  </button>
                </article>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
