import { useEffect, useState, type FormEvent } from 'react'
import type { Category, Extra } from '../data/catalog'
import {
  addonChoices,
  addonKey,
  createProduct,
  parsePrice,
  updateProduct,
  useAddonCatalog,
  watchCategories,
  type ListedProduct,
} from '../lib/adminCatalog'
import { formatPrice, maskPrice, toCents } from '../lib/money'
import { readPhoto } from '../lib/photo'
import { ChoiceList } from './ChoiceList'
import { CloseButton } from './Overlay'

type ProductFormProps = {
  onClose: () => void
  onSaved: () => void
  product?: ListedProduct
}

function reaisField(reais: number): string {
  return formatPrice(toCents(reais)).replace('R$ ', '')
}

export function ProductForm({ onClose, onSaved, product }: ProductFormProps) {
  const editing = Boolean(product)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesError, setCategoriesError] = useState('')
  const { addons, error: addonsError } = useAddonCatalog()
  const [name, setName] = useState(product?.name ?? '')
  const [photo, setPhoto] = useState(product?.image ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '')
  const [price, setPrice] = useState(product ? reaisField(product.price) : '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [available, setAvailable] = useState(product?.available !== false)
  const [picked, setPicked] = useState<string[]>(() =>
    (product?.extras ?? []).map((extra) => addonKey(extra.name)).filter(Boolean),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(
    () =>
      watchCategories(
        (next) => {
          setCategories(next)
          setCategoriesError('')
        },
        () => setCategoriesError('Não foi possível carregar as categorias.'),
      ),
    [],
  )

  const selected = categories.find((category) => category.id === categoryId) ?? null
  const choices = addonChoices(addons, product?.extras ?? [])

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      setPhoto(await readPhoto(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível usar a foto.')
    }
  }

  function toggleAddon(name: string) {
    const key = addonKey(name)
    if (!key) return
    setPicked((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSaved('')
    const value = parsePrice(price)
    if (!name.trim()) return setError('Informe o nome do produto.')
    if (!photo) return setError('Escolha uma foto.')
    if (!selected) return setError('Escolha uma categoria.')
    if (value === null) return setError('Informe um valor válido, por exemplo 28,90.')

    const cleanExtras: Extra[] = choices
      .filter((addon) => picked.includes(addonKey(addon.name)))
      .map((addon) => ({ id: addon.id, name: addon.name, price: addon.price }))

    const draft = {
      name,
      categoryId: selected.id,
      price: value,
      description,
      image: photo,
      extras: cleanExtras,
    }

    setBusy(true)
    try {
      if (product) {
        await updateProduct(product.id, { ...draft, available })
        setSaved(`${name.trim()} atualizado no cardápio.`)
      } else {
        await createProduct(draft)
        setSaved(`${name.trim()} salvo no cardápio.`)
        setName('')
        setPhoto('')
        setPrice('')
        setDescription('')
        setPicked([])
      }
      onSaved()
    } catch {
      setError('Não foi possível salvar o produto.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="product-screen" role="dialog" aria-modal="true" aria-label={editing ? 'Editar produto' : 'Criar Produto'}>
      <div className="product-screen__inner">
      <div className="product-screen__bar">
        <h2>{editing ? 'Editar produto' : 'Criar Produto'}</h2>
        <CloseButton onClick={onClose} />
      </div>
      <form className="product-form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Nome</span>
          <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </label>

        <div className="photo-pick">
          <span className="photo-pick__label">Foto</span>
          {photo ? <img className="photo-pick__preview" src={photo} alt="Prévia da foto" /> : null}
          <div className="actions">
            <label className="btn btn--ghost photo-pick__btn">
              Câmera
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="Tirar foto com a câmera"
                onChange={(event) => void onPhoto(event.target.files?.[0])}
              />
            </label>
            <label className="btn btn--ghost photo-pick__btn">
              Galeria
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                aria-label="Escolher foto da galeria"
                onChange={(event) => void onPhoto(event.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        <div className="field">
          <span>Categoria</span>
          <ChoiceList
            label="Categoria"
            value={categoryId}
            onChange={setCategoryId}
            choices={[
              { value: '', label: 'Escolha uma categoria' },
              ...categories.map((category) => ({
                value: category.id,
                label: category.destaque ? `${category.name} (destaque)` : category.name,
              })),
            ]}
          />
        </div>
        {categoriesError && <p className="alert">{categoriesError}</p>}

        <div className="field">
          <span id="product-price">Valor (R$)</span>
          <div className="money-join">
            <span className="money-join__prefix" aria-hidden="true">
              R$
            </span>
            <input
              aria-labelledby="product-price"
              inputMode="numeric"
              placeholder="0,00"
              value={price}
              onChange={(event) => setPrice(maskPrice(event.target.value))}
            />
          </div>
        </div>

        {editing && (
          <label className="check">
            <input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} />
            <span>Disponível</span>
          </label>
        )}

        <label className="field">
          <span>Descrição</span>
          <textarea
            rows={3}
            maxLength={240}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <fieldset className="extras">
          <legend>Adicionais</legend>
          {choices.length === 0 ? (
            <p className="muted">Cadastre os adicionais na área Adicionais.</p>
          ) : (
            choices.map((addon) => (
              <label key={addon.id}>
                <input
                  type="checkbox"
                  checked={picked.includes(addonKey(addon.name))}
                  onChange={() => toggleAddon(addon.name)}
                />
                <span>
                  {addon.name} · {formatPrice(toCents(addon.price))}
                </span>
              </label>
            ))
          )}
        </fieldset>
        {addonsError && <p className="alert">{addonsError}</p>}

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="notice" role="status">
            {saved}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Salvando...' : 'Salvar produto'}
        </button>
      </form>
      </div>
    </div>
  )
}
