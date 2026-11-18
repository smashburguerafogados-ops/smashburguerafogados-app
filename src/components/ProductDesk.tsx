import { useEffect, useState } from 'react'
import type { Category } from '../data/catalog'
import {
  deleteCategory,
  deleteProduct,
  parsePrice,
  setProductAvailable,
  setProductPrice,
  watchCategories,
  watchProducts,
  type ListedProduct,
} from '../lib/adminCatalog'
import { formatPrice, toCents } from '../lib/money'

type ProductDeskProps = {
  onClose: () => void
}

type Pending = { kind: 'product' | 'category'; id: string; name: string }

export function ProductDesk({ onClose }: ProductDeskProps) {
  const [products, setProducts] = useState<ListedProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)

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
    const value = parsePrice(prices[product.id] ?? '')
    if (value === null) {
      setActionError('Informe um valor válido.')
      return
    }
    try {
      await setProductPrice(product.id, value)
    } catch {
      setActionError('Não foi possível salvar o valor.')
    }
  }

  async function toggleSoldOut(product: ListedProduct) {
    setActionError('')
    try {
      await setProductAvailable(product.id, !product.available)
    } catch {
      setActionError('Não foi possível atualizar o produto.')
    }
  }

  async function confirmDelete() {
    if (!pending) return
    setBusy(true)
    setActionError('')
    try {
      if (pending.kind === 'product') await deleteProduct(pending.id)
      else await deleteCategory(pending.id)
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
          <button type="button" className="text-btn" onClick={onClose}>
            Fechar
          </button>
        </div>
        {loadError && (
          <p className="alert" role="alert">
            {loadError}
          </p>
        )}
        {products.length === 0 ? (
          <p className="muted">Nenhum produto no cardápio.</p>
        ) : (
          <ul className="catalog">
            {products.map((product) => (
              <li key={product.id} className="catalog__row">
                <div className="catalog__main">
                  <strong>{product.name}</strong>
                  {!product.available && <span className="catalog__tag">Esgotado</span>}
                </div>
                <div className="catalog__actions">
                  <label className="catalog__price">
                    <span className="sr-only">Valor de {product.name}</span>
                    <input
                      inputMode="decimal"
                      value={prices[product.id] ?? ''}
                      onChange={(event) =>
                        setPrices((current) => ({
                          ...current,
                          [product.id]: event.target.value.replace(/[^\d.,]/g, ''),
                        }))
                      }
                    />
                  </label>
                  <button type="button" className="text-btn" onClick={() => void savePrice(product)}>
                    Salvar {product.name}
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    aria-pressed={!product.available}
                    onClick={() => void toggleSoldOut(product)}
                  >
                    {product.available ? `Marcar ${product.name} esgotado` : `Marcar ${product.name} disponível`}
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setPending({ kind: 'product', id: product.id, name: product.name })}
                  >
                    Excluir {product.name}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="catalog__heading">Categorias</h3>
        {categories.length === 0 ? (
          <p className="muted">Nenhuma categoria.</p>
        ) : (
          <ul className="catalog">
            {categories.map((category) => (
              <li key={category.id} className="catalog__row">
                <strong>{category.name}</strong>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => setPending({ kind: 'category', id: category.id, name: category.name })}
                >
                  Excluir categoria {category.name}
                </button>
              </li>
            ))}
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
