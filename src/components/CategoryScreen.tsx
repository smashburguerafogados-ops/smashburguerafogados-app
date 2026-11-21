import { useEffect, useState } from 'react'
import type { Category } from '../data/catalog'
import {
  createCategory,
  deleteCategory,
  renameCategory,
  setCategoryDestaque,
  setCategoryIcon,
  watchCategories,
} from '../lib/adminCatalog'
import { CategoryIcon, iconForCategory } from '../lib/categoryIcons'
import { IconPicker } from './IconPicker'
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

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.4l2.3 4.8 5.3.6-4 3.6 1.1 5.2L12 15.4 7.3 17.6l1.1-5.2-4-3.6 5.3-.6L12 3.4z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
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

export function CategoryScreen({ onClose }: { onClose: () => void }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [name, setName] = useState('')
  const [destaque, setDestaque] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Category | null>(null)
  const [editingId, setEditingId] = useState('')
  const [draftName, setDraftName] = useState('')
  const [icon, setIcon] = useState('')
  const [draftIcon, setDraftIcon] = useState('')

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (pending) setPending(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pending])

  useEffect(
    () =>
      watchCategories(
        (next) => {
          setCategories(next)
          setLoadError('')
        },
        () => setLoadError('Não foi possível carregar as categorias.'),
      ),
    [],
  )

  async function create() {
    setActionError('')
    setBusy(true)
    try {
      const order = categories.reduce((max, category) => Math.max(max, category.order), 0) + 1
      await createCategory(name, destaque, order, icon)
      setName('')
      setIcon('')
      setDestaque(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível criar a categoria.')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(category: Category) {
    setActionError('')
    setEditingId(category.id)
    setDraftName(category.name)
    setDraftIcon(category.icon ?? '')
  }

  async function saveName(category: Category) {
    setActionError('')
    try {
      await renameCategory(category.id, draftName)
      if (draftIcon !== (category.icon ?? '')) await setCategoryIcon(category.id, draftIcon)
      setEditingId('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível salvar a categoria.')
    }
  }

  async function toggleDestaque(category: Category) {
    setActionError('')
    try {
      await setCategoryDestaque(category.id, !category.destaque)
    } catch {
      setActionError('Não foi possível atualizar a categoria.')
    }
  }

  async function confirmDelete() {
    if (!pending) return
    setBusy(true)
    setActionError('')
    try {
      await deleteCategory(pending.id)
      setPending(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível excluir.')
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="product-screen" role="dialog" aria-modal="true" aria-label="Categorias">
      <div className="product-screen__inner">
        <div className="product-screen__bar">
          <h2>Categorias</h2>
          <CloseButton onClick={onClose} />
        </div>
        <p className="muted">Início continua mostrando todos os produtos. Ele não é uma categoria.</p>
        {loadError && (
          <p className="alert" role="alert">
            {loadError}
          </p>
        )}
        <div className="category-tools category-tools--new">
          <label className="field">
            <span>Nome</span>
            <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={destaque} onChange={(event) => setDestaque(event.target.checked)} />
            <span>Destaque</span>
          </label>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void create()}>
            Criar categoria
          </button>
          <IconPicker name={name} value={icon} onChange={setIcon} />
        </div>
        {categories.length === 0 ? (
          <p className="muted">Nenhuma categoria.</p>
        ) : (
          <ul className="catalog catalog--cards">
            {categories.map((category) => {
              const editing = editingId === category.id
              return (
                <li key={category.id}>
                  <article className="catalog__card catalog__card--row" aria-label={category.name}>
                    {editing ? (
                      <input
                        className="catalog__rename"
                        aria-label="Novo nome"
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void saveName(category)
                        }}
                      />
                    ) : (
                      <strong className="category-name">
                        <CategoryIcon iconKey={iconForCategory(category.name, category.icon)} size={18} />
                        {category.name}
                      </strong>
                    )}
                    <div className="catalog__tools">
                      <button
                        type="button"
                        className="catalog__tool"
                        aria-label={editing ? 'Salvar nome' : 'Editar'}
                        onClick={() => (editing ? void saveName(category) : startEdit(category))}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        className="catalog__tool"
                        aria-label={category.destaque ? 'Tirar destaque' : 'Destacar'}
                        aria-pressed={category.destaque === true}
                        onClick={() => void toggleDestaque(category)}
                      >
                        <StarIcon filled={category.destaque === true} />
                      </button>
                      <button
                        type="button"
                        className="catalog__tool"
                        aria-label="Apagar"
                        onClick={() => setPending(category)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </article>
                  {editing && (
                    <IconPicker name={draftName} value={draftIcon} onChange={setDraftIcon} />
                  )}
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
            <p className="muted">Essa ação não volta atrás.</p>
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
