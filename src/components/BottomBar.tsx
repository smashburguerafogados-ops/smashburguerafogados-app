import { businessWhatsappUrl } from '../lib/whatsapp'
import { formatPrice } from '../lib/money'

type Sheet = 'cart' | 'profile' | null

type BottomBarProps = {
  sheet: Sheet
  count: number
  totalCents: number
  onProfile: () => void
  onCart: () => void
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19.2c1.4-3 3.8-4.4 7-4.4s5.6 1.4 7 4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CartIcon() {
  return (
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
  )
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 16.5 4.2 19.2c-.3.5.3 1.1.8.8L8.2 18.4A8 8 0 1 0 6 16.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BottomBar({ sheet, count, totalCents, onProfile, onCart }: BottomBarProps) {
  const itemWord = count === 1 ? 'item' : 'itens'

  return (
    <nav className="dock" aria-label="Atalhos">
      <button
        type="button"
        className={sheet === 'profile' ? 'dock__item is-active' : 'dock__item'}
        aria-pressed={sheet === 'profile'}
        aria-label="Conta"
        onClick={onProfile}
      >
        <UserIcon />
        {sheet === 'profile' && <span className="dock__label">Conta</span>}
      </button>
      <button
        type="button"
        className={sheet === 'cart' ? 'dock__item is-active' : 'dock__item'}
        aria-pressed={sheet === 'cart'}
        aria-label={`Carrinho, ${count} ${itemWord}, ${formatPrice(totalCents)}`}
        onClick={onCart}
      >
        <CartIcon />
        <span className="dock__count">{count}</span>
        <span className="dock__sum">{formatPrice(totalCents)}</span>
        {sheet === 'cart' && <span className="dock__label">Carrinho</span>}
      </button>
      <a className="dock__item" href={businessWhatsappUrl()} target="_blank" rel="noreferrer" aria-label="WhatsApp">
        <ChatIcon />
      </a>
    </nav>
  )
}
