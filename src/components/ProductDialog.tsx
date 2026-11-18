import { useState } from 'react'
import type { Product } from '../data/catalog'
import { formatPrice, toCents } from '../lib/money'
import { Overlay } from './Overlay'

type ProductDialogProps = {
  product: Product
  onClose: () => void
  onAdd: (note: string, extraIds: string[], qty: number) => void
}

export function ProductDialog({ product, onClose, onAdd }: ProductDialogProps) {
  const [note, setNote] = useState('')
  const [extras, setExtras] = useState<string[]>([])
  const [qty, setQty] = useState(1)
  const extraTotal = (product.extras ?? [])
    .filter((extra) => extras.includes(extra.id))
    .reduce((sum, extra) => sum + toCents(extra.price), 0)
  const total = toCents(product.price) + extraTotal

  function toggle(id: string) {
    setExtras((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <Overlay label={product.name} onClose={onClose} variant="popup">
      <div className="product">
        <img src={product.image} alt="" />
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
          placeholder="Ex.: sem cebola, ponto da carne"
          onChange={(event) => setNote(event.target.value)}
          disabled={!product.available}
        />
      </label>
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
    </Overlay>
  )
}
