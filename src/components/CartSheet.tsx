import { formatPrice } from '../lib/money'
import { cartTotal, type CartLine } from '../lib/menu'
import { Overlay } from './Overlay'

type CartSheetProps = {
  lines: CartLine[]
  onClose: () => void
  onRemove: (key: string) => void
}

export function CartSheet({ lines, onClose, onRemove }: CartSheetProps) {
  return (
    <Overlay label="Carrinho" onClose={onClose}>
      <h2>Carrinho</h2>
      {lines.length === 0 ? (
        <p className="muted">Seu carrinho está vazio.</p>
      ) : (
        <ul className="cart">
          {lines.map((line) => (
            <li key={line.key}>
              <div>
                <strong>{line.name}</strong>
                <span>
                  {line.qty} × {formatPrice(line.priceCents)}
                </span>
                {line.note && <p>{line.note}</p>}
              </div>
              <div className="cart__side">
                <span>{formatPrice(line.priceCents * line.qty)}</span>
                <button type="button" className="text-btn" onClick={() => onRemove(line.key)}>
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="cart__total">
        Total <strong>{formatPrice(cartTotal(lines))}</strong>
      </p>
    </Overlay>
  )
}
