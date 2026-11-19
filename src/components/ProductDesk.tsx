import { useEffect, useState } from 'react'
import type { Category } from '../data/catalog'
import {
  deleteCategory,
  parsePrice,
  renameCategory,
  setCategoryDestaque,
  setProductAvailable,
  setProductPrice,
  watchCategories,
  watchProducts,
  type ListedProduct,
} from '../lib/adminCatalog'
import { formatPrice, maskPrice, toCents } from '../lib/money'
import { CloseButton } from './Overlay'
import { ProductForm } from './ProductForm'

type ProductDeskProps = {
  onClose: () => void
}

type Pending = { id: string; name: string }

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

export function ProductDesk({ onClose }: ProductDeskProps) {
  const [products, setProducts] = useState<ListedProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedName, setSavedName] = useState('')
  const [editingId, setEditingId] = useState('')
  const [draftName, setDraftName] = useState('')
  const [editingProduct, setEditingProduct] = useState<ListedProduct | null>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (editingProduct) return
      if (pending) setPending(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pending, editingProduct])

  useEffect(
    () =>
      watchProducts(
        (next) => {
          setProducts(next)
          setPrices((current) => {
            const draft = { ...current }
            for (const product of next) {
              if (draft[product.id] === undefined) draft[product.id] = formatPrice(toCents(product.price)).replace('R$ ', '')
            }
            return draft
          })
          setLoadError('')
        },
        () => setLoadError('Não foi possível carregar os produtos.'),
      ),
    [],
  )

  useEffect(
    () =>
      watchCategories(
        (next) => setCategories(next),
        () => setLoadError('Não foi possível carregar as categorias.'),
      ),
    [],
  )

  async function savePrice(product: ListedProduct) {
    setActionError('')
    setSavedName('')
    const value = parsePrice(prices[product.id] ?? '')
    if (value === null) {
      setActionError('Informe um valor válido.')
      return
    }
    try {
      await setProductPrice(product.id, value)
    } catch {
      setActionError('Não foi possível salvar o valor.')
      return
    }
    setSavedName(product.name)
  }

  async function toggleSoldOut(product: ListedProduct) {
    setActionError('')
    try {
      await setProductAvailable(product.id, !product.available)
    } catch {
      setActionError('Não foi possível atualizar o produto.')
    }
  }

  function startEdit(category: Category) {
    setActionError('')
    setEditingId(category.id)
    setDraftName(category.name)
  }

  async function saveName(category: Category) {
    setActionError('')
    try {
      await renameCategory(category.id, draftName)
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
    <div className="product-screen" role="dialog" aria-modal="true" aria-label="Produtos">
      <div className="product-screen__inner">
        <div className="product-screen__bar">
          <h2>Produtos</h2>
          <CloseButton onClick={onClose} />
        </div>
        {loadError && (
          <p className="alert" role="alert">
            {loadError}
          </p>
        )}
        <h3 className="catalog__heading">Itens do cardápio</h3>
        {products.length === 0 ? (
          <p className="muted">Nenhum produto no cardápio.</p>
        ) : (
          <ul className="catalog catalog--cards">
            {products.map((product) => {
              const priceId = `price-${product.id}`
              return (
                <li key={product.id}>
                  <article className="catalog__card" aria-labelledby={`name-${product.id}`}>
                    <header className="catalog__card-head">
                      <strong id={`name-${product.id}`}>{product.name}</strong>
                      <span className={product.available ? 'catalog__state' : 'catalog__state is-off'}>
                        {product.available ? 'Disponível' : 'Esgotado'}
                      </span>
                    </header>
                    <div className="field">
                      <span id={priceId}>Valor (R$)</span>
                      <div className="money-join">
                        <span className="money-join__prefix" aria-hidden="true">
                          R$
                        </span>
                        <input
                          aria-labelledby={priceId}
                          inputMode="numeric"
                          value={prices[product.id] ?? ''}
                          onChange={(event) =>
                            setPrices((current) => ({ ...current, [product.id]: maskPrice(event.target.value) }))
                          }
                        />
                      </div>
                    </div>
                    <div className="catalog__actions">
                      <button type="button" className="btn btn--ghost catalog__edit" onClick={() => setEditingProduct(product)}>
                        Editar
                      </button>
                      <button type="button" className="btn" onClick={() => void savePrice(product)}>
                        Salvar valor
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        aria-pressed={!product.available}
                        onClick={() => void toggleSoldOut(product)}
                      >
                        {product.available ? 'Marcar esgotado' : 'Marcar disponível'}
                      </button>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}

        <h3 className="catalog__heading">Categorias</h3>
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
                      <strong>{category.name}</strong>
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
                        onClick={() => setPending({ id: category.id, name: category.name })}
                      >
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
        {savedName && !actionError && (
          <p className="notice" role="status">
            Valor de {savedName} salvo.
          </p>
        )}
      </div>
      {editingProduct && (
        <ProductForm product={editingProduct} onClose={() => setEditingProduct(null)} onSaved={() => undefined} />
      )}
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
