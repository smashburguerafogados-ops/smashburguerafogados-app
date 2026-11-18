import { Fragment } from 'react'
import { formatPrice } from '../lib/money'

type BottomBarProps = {
  sheet: string | null
  count: number
  totalCents: number
  onOrders: () => void
  onProfile: () => void
  onCart: () => void
  onWhatsapp: () => void
}

function PageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 3.8h6.5L18.2 8.6V19a1.6 1.6 0 0 1-1.6 1.6H7.6A1.6 1.6 0 0 1 6 19V5.4c0-.9.7-1.6 1.6-1.6H7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M13.2 4v4.4h4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12.2h6M9 15.6h4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
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

function Rule() {
  return <span className="dock__rule" aria-hidden="true" />
}

export function BottomBar({ sheet, count, totalCents, onOrders, onProfile, onCart, onWhatsapp }: BottomBarProps) {
  const itemWord = count === 1 ? 'item' : 'itens'
  const items = [
    {
      key: 'orders',
      label: 'Meus pedidos',
      activeLabel: 'Pedidos',
      icon: <PageIcon />,
      onClick: onOrders,
    },
    {
      key: 'profile',
      label: 'Conta',
      activeLabel: 'Conta',
      icon: <UserIcon />,
      onClick: onProfile,
    },
    {
      key: 'cart',
      label: `Carrinho, ${count} ${itemWord}, ${formatPrice(totalCents)}`,
      activeLabel: 'Carrinho',
      icon: <CartIcon />,
      onClick: onCart,
      extra: (
        <>
          <span className="dock__count">{count}</span>
          <span className="dock__sum">{formatPrice(totalCents)}</span>
        </>
      ),
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      activeLabel: 'WhatsApp',
      icon: <ChatIcon />,
      onClick: onWhatsapp,
    },
  ]

  return (
    <nav className="dock" aria-label="Atalhos">
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 && <Rule />}
          <button
            type="button"
            className={sheet === item.key ? 'dock__item is-active' : 'dock__item'}
            aria-pressed={sheet === item.key}
            aria-label={item.label}
            onClick={item.onClick}
          >
            {item.icon}
            {'extra' in item ? item.extra : null}
            {sheet === item.key && <span className="dock__label">{item.activeLabel}</span>}
          </button>
        </Fragment>
      ))}
    </nav>
  )
}
