import { useEffect, useState } from 'react'
import {
  createAddon,
  deleteAddon,
  parsePrice,
  updateAddon,
  useAddonCatalog,
  type CatalogAddon,
} from '../lib/adminCatalog'
import { formatPrice, maskPrice, toCents } from '../lib/money'
import { CloseButton } from './Overlay'

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 16.6V20h3.4L19.2 8.2 15.8 4.8 4 16.6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 7h14M9 7V5h6v2M8 7l.8 12h6.4L16 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function reaisField(reais: number): string {
  return formatPrice(toCents(reais)).replace('R$ ', '')
}

export function AddonScreen({ onClose }: { onClose: () => void }) {
  const { addons, error: loadError } = useAddonCatalog()
  const [actionError, setActionError] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<CatalogAddon | null>(null)
  const [editingId, setEditingId] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftPrice, setDraftPrice] = useState('')

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (pending) setPending(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pending])

  async function create() {
    setActionError('')
    const value = parsePrice(price)
    if (value === null) {
      setActionError('Informe um valor válido.')
      return
    }
    setBusy(true)
    try {
      await createAddon(name, value)
      setName('')
      setPrice('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível criar o adicional.')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(addon: CatalogAddon) {
    setActionError('')
    setEditingId(addon.id)
    setDraftName(addon.name)
    setDraftPrice(reaisField(addon.price))
  }

  async function saveEdit(addon: CatalogAddon) {
    setActionError('')
    const value = parsePrice(draftPrice)
    if (value === null) {
      setActionError('Informe um valor válido.')
      return
    }
    try {
      await updateAddon(addon.id, draftName, value)
      setEditingId('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível salvar o adicional.')
    }
  }

  async function confirmDelete() {
    if (!pending) return
    setBusy(true)
    setActionError('')
    try {
      await deleteAddon(pending.id)
      setPending(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível excluir.')
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="product-screen" role="dialog" aria-modal="true" aria-label="Adicionais">
      <div className="product-screen__inner">
        <div className="product-screen__bar">
          <h2>Adicionais</h2>
          <CloseButton onClick={onClose} />
        </div>
        <p className="muted">O catálogo de adicionais. No produto, você só marca os que entram.</p>
        {loadError && (
          <p className="alert" role="alert">
            {loadError}
          </p>
        )}
        <div className="category-tools category-tools--new">
          <label className="field">
            <span>Nome</span>
            <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="field">
            <span id="addon-price">Valor (R$)</span>
            <div className="money-join">
              <span className="money-join__prefix" aria-hidden="true">
                R$
              </span>
              <input
                aria-labelledby="addon-price"
                inputMode="numeric"
                placeholder="0,00"
                value={price}
                onChange={(event) => setPrice(maskPrice(event.target.value))}
              />
            </div>
          </div>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void create()}>
            Criar adicional
          </button>
        </div>
        {addons.length === 0 ? (
          <p className="muted">Nenhum adicional.</p>
        ) : (
          <ul className="catalog catalog--cards">
            {addons.map((addon) => {
              const editing = editingId === addon.id
              return (
                <li key={addon.id}>
                  <article className="catalog__card catalog__card--row" aria-label={addon.name}>
                    {editing ? (
                      <div className="catalog__edit-fields">
                        <input
                          className="catalog__rename"
                          aria-label="Novo nome"
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                        />
                        <input
                          className="catalog__rename"
                          aria-label="Novo valor"
                          inputMode="numeric"
                          value={draftPrice}
                          onChange={(event) => setDraftPrice(maskPrice(event.target.value))}
                        />
                      </div>
                    ) : (
                      <>
                        <strong>{addon.name}</strong>
                        <span className="catalog__price">{formatPrice(toCents(addon.price))}</span>
                      </>
                    )}
                    <div className="catalog__tools">
                      <button
                        type="button"
                        className="catalog__tool"
                        aria-label={editing ? 'Salvar adicional' : 'Editar'}
                        onClick={() => (editing ? void saveEdit(addon) : startEdit(addon))}
                      >
                        <PencilIcon />
                      </button>
                      <button type="button" className="catalog__tool" aria-label="Apagar" onClick={() => setPending(addon)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}
        {actionError && (
          <p className="alert" role="alert">
            {actionError}
          </p>
        )}
      </div>
      {pending && (
        <div className="confirm-screen" role="alertdialog" aria-modal="true" aria-label="Confirmar exclusão">
          <div className="confirm-screen__box">
            <h2>Excluir {pending.name}?</h2>
            <p className="muted">Essa ação não volta atrás. O produto que já usa este adicional continua com ele.</p>
            <div className="confirm-screen__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>
                Cancelar
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void confirmDelete()}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
