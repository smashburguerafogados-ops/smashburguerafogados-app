type ShopStatusProps = {
  online: boolean
  hours: string
}

export function ShopStatus({ online, hours }: ShopStatusProps) {
  return (
    <div className={online ? 'shop-status is-open' : 'shop-status is-closed'}>
      <p className="shop-status__state">
        <span className="shop-status__dot" aria-hidden="true" />
        {online ? 'Aberto agora' : 'Fechado'}
      </p>
      {hours && (
        <p className="shop-status__hours">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 7.6V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {hours}
        </p>
      )}
    </div>
  )
}
