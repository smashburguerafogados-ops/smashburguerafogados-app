import { useEffect, useState } from 'react'
import {
  deleteProduct,
  parsePrice,
  setProductAvailable,
  setProductPrice,
  watchProducts,
  type ListedProduct,
} from '../lib/adminCatalog'
import { formatPrice, maskPrice, toCents } from '../lib/money'
import { CloseButton } from './Overlay'
import { PhotoMigration } from './PhotoMigration'
import { ProductForm } from './ProductForm'

type ProductDeskProps = {
  onClose: () => void
}

type Pending = { id: string; name: string; image: string }

export function ProductDesk({ onClose }: ProductDeskProps) {
  const [products, setProducts] = useState<ListedProduct[]>([])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedName, setSavedName] = useState('')
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

  async function confirmDelete() {
    if (!pending) return
    setBusy(true)
    setActionError('')
    try {
      await deleteProduct(pending.id, pending.image)
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
        <PhotoMigration products={products} />
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
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => setPending({ id: product.id, name: product.name, image: product.image })}
                      >
                        Excluir
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
