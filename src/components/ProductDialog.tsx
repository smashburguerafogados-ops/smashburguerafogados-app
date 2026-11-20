import { useEffect, useState } from 'react'
import type { Product } from '../data/catalog'
import { formatPrice, toCents } from '../lib/money'
import { CloseButton, Overlay } from './Overlay'

type ProductDialogProps = {
  product: Product
  onClose: () => void
  onAdd: (note: string, extraIds: string[], qty: number) => void
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
    <Overlay label={product.name} onClose={onClose} variant="popup">
      <div className="product">
        <button type="button" className="product__zoom" aria-label={`Ampliar foto de ${product.name}`} onClick={() => setZoom(true)}>
          <img src={product.image} alt="" />
        </button>
        <div>
          <h2>{product.name}</h2>
          <p>{product.description}</p>
          <p className="product__price">{formatPrice(total)}</p>
          {!product.available && <p className="item__tag">Esgotado</p>}
        </div>
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
              <span>
                {extra.name} · {formatPrice(toCents(extra.price))}
              </span>
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
      <div className="stepper" role="group" aria-label="Quantidade">
        <button type="button" aria-label="Diminuir" disabled={!product.available || qty <= 1} onClick={() => setQty((current) => Math.max(1, current - 1))}>
          −
        </button>
        <span>{qty}</span>
        <button type="button" aria-label="Aumentar" disabled={!product.available} onClick={() => setQty((current) => current + 1)}>
          +
        </button>
      </div>
      <button
        type="button"
        className="btn"
        disabled={!product.available}
        onClick={() => onAdd(note, extras, qty)}
      >
        Adicionar
      </button>
      {zoom && (
        <div className="photo-zoom" role="dialog" aria-modal="true" aria-label={`Foto de ${product.name}`}>
          <CloseButton className="photo-zoom__close" label="Fechar foto" onClick={() => setZoom(false)} />
          <button type="button" className="photo-zoom__photo" aria-label="Foto ampliada" onClick={() => setZoom(false)}>
            <img src={product.image} alt="" />
          </button>
        </div>
      )}
    </Overlay>
  )
}
