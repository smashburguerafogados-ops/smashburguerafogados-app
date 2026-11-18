import { useEffect, useState, type FormEvent } from 'react'
import type { Category, Extra } from '../data/catalog'
import {
  createCategory,
  createProduct,
  deleteCategory,
  parsePrice,
  setCategoryDestaque,
  watchCategories,
} from '../lib/adminCatalog'
import { readPhoto } from '../lib/photo'
import { Overlay } from './Overlay'

type ProductFormProps = {
  onClose: () => void
  onSaved: () => void
}

type ExtraDraft = { key: number; name: string; price: string }

const NEW_CATEGORY = '__nova__'

export function ProductForm({ onClose, onSaved }: ProductFormProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesError, setCategoriesError] = useState('')
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newDestaque, setNewDestaque] = useState(false)
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [extras, setExtras] = useState<ExtraDraft[]>([])
  const [nextKey, setNextKey] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

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

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      setPhoto(await readPhoto(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível usar a foto.')
    }
  }

  async function addCategory() {
    setError('')
    try {
      const order = categories.reduce((max, category) => Math.max(max, category.order), 0) + 1
      const id = await createCategory(newCategory, newDestaque, order)
      setCategoryId(id)
      setNewCategory('')
      setNewDestaque(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a categoria.')
    }
  }

  async function removeCategory() {
    if (!selected) return
    setError('')
    try {
      await deleteCategory(selected.id)
      setCategoryId('')
    } catch {
      setError('Não foi possível excluir a categoria.')
    }
  }

  async function toggleDestaque(value: boolean) {
    if (!selected) return
    try {
      await setCategoryDestaque(selected.id, value)
    } catch {
      setError('Não foi possível atualizar o destaque.')
    }
  }

  function addExtra() {
    setExtras((current) => [...current, { key: nextKey, name: '', price: '' }])
    setNextKey((key) => key + 1)
  }

  function updateExtra(key: number, patch: Partial<ExtraDraft>) {
    setExtras((current) => current.map((extra) => (extra.key === key ? { ...extra, ...patch } : extra)))
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

    const cleanExtras: Extra[] = []
    for (const extra of extras) {
      if (!extra.name.trim() && !extra.price.trim()) continue
      const extraPrice = parsePrice(extra.price)
      if (!extra.name.trim() || extraPrice === null) {
        return setError('Cada adicional precisa de nome e valor.')
      }
      cleanExtras.push({ id: `extra-${extra.key}`, name: extra.name.trim(), price: extraPrice })
    }

    setBusy(true)
    try {
      await createProduct({
        name,
        categoryId: selected.id,
        price: value,
        description,
        image: photo,
        extras: cleanExtras,
      })
      setSaved(`${name.trim()} salvo no cardápio.`)
      setName('')
      setPhoto('')
      setPrice('')
      setDescription('')
      setExtras([])
      onSaved()
    } catch {
      setError('Não foi possível salvar o produto.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Overlay label="Criar Produto" onClose={onClose}>
      <h2>Criar Produto</h2>
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

        <label className="field">
          <span>Categoria</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Escolha uma categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.destaque ? `${category.name} (destaque)` : category.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>+ Nova categoria</option>
          </select>
        </label>
        {categoriesError && <p className="alert">{categoriesError}</p>}

        {selected && (
          <div className="category-tools">
            <label className="check">
              <input
                type="checkbox"
                checked={Boolean(selected.destaque)}
                onChange={(event) => void toggleDestaque(event.target.checked)}
              />
              <span>Destaque</span>
            </label>
            <button type="button" className="text-btn" onClick={() => void removeCategory()}>
              Excluir categoria
            </button>
          </div>
        )}

        {categoryId === NEW_CATEGORY && (
          <div className="category-tools category-tools--new">
            <label className="field">
              <span>Nova categoria</span>
              <input value={newCategory} maxLength={40} onChange={(event) => setNewCategory(event.target.value)} />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={newDestaque}
                onChange={(event) => setNewDestaque(event.target.checked)}
              />
              <span>Destaque</span>
            </label>
            <button type="button" className="btn btn--ghost" onClick={() => void addCategory()}>
              Criar categoria
            </button>
          </div>
        )}

        <label className="field">
          <span>Valor (R$)</span>
          <input
            inputMode="decimal"
            placeholder="Ex.: 28,90"
            value={price}
            onChange={(event) => setPrice(event.target.value.replace(/[^\d.,]/g, ''))}
          />
        </label>

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
          {extras.length === 0 && <p className="muted">Ex.: molho, bacon, cheddar.</p>}
          {extras.map((extra, index) => (
            <div key={extra.key} className="extra-row">
              <input
                aria-label={`Adicional ${index + 1}`}
                placeholder="Nome"
                value={extra.name}
                onChange={(event) => updateExtra(extra.key, { name: event.target.value })}
              />
              <input
                aria-label={`Valor do adicional ${index + 1}`}
                inputMode="decimal"
                placeholder="Valor"
                value={extra.price}
                onChange={(event) => updateExtra(extra.key, { price: event.target.value.replace(/[^\d.,]/g, '') })}
              />
              <button
                type="button"
                className="text-btn"
                onClick={() => setExtras((current) => current.filter((item) => item.key !== extra.key))}
              >
                Remover
              </button>
            </div>
          ))}
          <button type="button" className="text-btn" onClick={addExtra}>
            + Adicional
          </button>
        </fieldset>

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
    </Overlay>
  )
}
