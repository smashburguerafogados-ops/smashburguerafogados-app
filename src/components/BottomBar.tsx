import { Fragment } from 'react'
import { formatPrice } from '../lib/money'

type BottomBarProps = {
  sheet: string | null
  count: number
  totalCents: number
  away?: boolean
  orderLive?: boolean
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

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-icon="whatsapp">
      <path
        fill="currentColor"
        d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.15 6.43 2.15 11.89c0 1.74.46 3.44 1.32 4.94L2 22l5.3-1.39a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7.01Zm-7.01 15.23h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.15.82.84-3.07-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.26-8.22 8.26Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.2 3.7.59.25 1.05.4 1.4.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.28Z"
      />
    </svg>
  )
}

function Rule() {
  return <span className="dock__rule" aria-hidden="true" />
}

export function BottomBar({
  sheet,
  count,
  totalCents,
  away = false,
  orderLive = false,
  onOrders,
  onProfile,
  onCart,
  onWhatsapp,
}: BottomBarProps) {
  const itemWord = count === 1 ? 'item' : 'itens'
  const items = [
    {
      key: 'orders',
      label: 'Meus pedidos',
      icon: <PageIcon />,
      onClick: onOrders,
      live: orderLive,
      text: <span className="dock__label">Histórico</span>,
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: <WhatsAppIcon />,
      onClick: onWhatsapp,
      text: <span className="dock__label">WhatsApp</span>,
    },
    {
      key: 'cart',
      label: `Carrinho, ${count} ${itemWord}, ${formatPrice(totalCents)}`,
      icon: (
        <span className="dock__icon">
          <CartIcon />
          <span className={count > 0 ? 'dock__count' : 'dock__count is-zero'}>{count}</span>
        </span>
      ),
      onClick: onCart,
      wide: true,
      text: <span className="dock__label dock__sum">{formatPrice(totalCents)}</span>,
    },
    {
      key: 'profile',
      label: 'Conta',
      icon: <UserIcon />,
      onClick: onProfile,
      text: <span className="dock__label">Conta</span>,
    },
  ]

  return (
    <nav className={away ? 'dock is-away' : 'dock'} aria-label="Atalhos">
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 && <Rule />}
          <button
            type="button"
            className={[
              'dock__item',
              'wide' in item && item.wide ? 'dock__item--cart' : '',
              'live' in item && item.live ? 'dock__item--live' : '',
              sheet === item.key ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={sheet === item.key}
            aria-label={item.label}
            onClick={item.onClick}
          >
            {item.icon}
            {item.text}
          </button>
        </Fragment>
      ))}
    </nav>
  )
}
