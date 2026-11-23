import { useEffect, useState } from 'react'
import type { Product } from '../data/catalog'
import { formatPrice, toCents } from '../lib/money'
import { BackIcon, HandIcon } from './Marks'
import { CloseButton, Overlay } from './Overlay'

type ProductDialogProps = {
  product: Product
  onClose: () => void
  onAdd: (note: string, extraIds: string[], qty: number) => void
}

/** One stored line is one description item. A single line stays a single item. */
export function descriptionItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function ProductDialog({ product, onClose, onAdd }: ProductDialogProps) {
  const [note, setNote] = useState('')
  const [extras, setExtras] = useState<string[]>([])
  const [qty, setQty] = useState(1)
  const [zoom, setZoom] = useState(false)
  const extraTotal = (product.extras ?? [])
    .filter((extra) => extras.includes(extra.id))
    .reduce((sum, extra) => sum + toCents(extra.price), 0)
  const total = (toCents(product.price) + extraTotal) * qty
  const items = descriptionItems(product.description)

  function toggle(id: string) {
    setExtras((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  useEffect(() => {
    if (!zoom) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      event.stopImmediatePropagation()
      setZoom(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [zoom])

  return (
    <Overlay label={product.name} onClose={onClose} variant="popup" back panelClass="product">
      <div className="product">
        <button type="button" className="product__zoom" aria-label={`Ampliar foto de ${product.name}`} onClick={() => setZoom(true)}>
          <img src={product.image} alt="" />
        </button>
        <h2>{product.name}</h2>
        <p className="product__price">{formatPrice(toCents(product.price))}</p>
        {items.length > 0 && (
          <ul className="product__items">
            {items.map((line, index) => (
              <li key={`${index}-${line}`} className="product__item">
                {line}
              </li>
            ))}
          </ul>
        )}
        {!product.available && <p className="item__tag">Esgotado</p>}
      </div>
      {product.extras && product.extras.length > 0 && (
        <fieldset className="extras">
          <legend>Adicionais</legend>
          {product.extras.map((extra) => (
            <label key={extra.id}>
              <input
                type="checkbox"
                checked={extras.includes(extra.id)}
                onChange={() => toggle(extra.id)}
                disabled={!product.available}
              />
              <span className="extras__name">{extra.name}</span>
              <span className="extras__price">+ {formatPrice(toCents(extra.price))}</span>
            </label>
          ))}
        </fieldset>
      )}
      <label className="field">
        <span>Observação</span>
        <input
          value={note}
          maxLength={140}
          placeholder="Ex.: tirar cebola, ponto da carne"
          onChange={(event) => setNote(event.target.value)}
          disabled={!product.available}
        />
      </label>
      <p className="muted product__note-hint">Exemplo: tirar cebola, sem molho, bem passado.</p>
      <div className="product__buy">
        <div className="stepper" role="group" aria-label="Quantidade">
          <button type="button" aria-label="Diminuir" disabled={!product.available || qty <= 1} onClick={() => setQty((current) => Math.max(1, current - 1))}>
            −
          </button>
          <span>{qty}</span>
          <button type="button" aria-label="Aumentar" disabled={!product.available} onClick={() => setQty((current) => current + 1)}>
            +
          </button>
        </div>
        <p className="product__total">{formatPrice(total)}</p>
      </div>
      <button
        type="button"
        className="btn product__add"
        disabled={!product.available}
        onClick={() => onAdd(note, extras, qty)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 7h15l-1.4 8.2a2 2 0 0 1-2 1.6H9.2a2 2 0 0 1-2-1.6L5.6 4.8H3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="19.2" r="1.3" fill="currentColor" />
          <circle cx="16.5" cy="19.2" r="1.3" fill="currentColor" />
        </svg>
        Adicionar
      </button>
      {zoom && (
        <div className="photo-zoom" role="dialog" aria-modal="true" aria-label={`Foto de ${product.name}`}>
          <button type="button" className="mark-btn photo-zoom__back" aria-label="Voltar" onClick={() => setZoom(false)}>
            <BackIcon />
          </button>
          <CloseButton className="photo-zoom__close" label="Fechar foto" onClick={() => setZoom(false)} />
          <button type="button" className="photo-zoom__photo" aria-label="Foto ampliada" onClick={() => setZoom(false)}>
            <img src={product.image} alt="" />
          </button>
          <p className="photo-zoom__hint" aria-hidden="true">
            <HandIcon />
            Toque para fechar
          </p>
        </div>
      )}
    </Overlay>
  )
}
