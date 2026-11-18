import { useState } from 'react'
import { formatPrice } from '../lib/money'
import {
  REVENUE_FILTERS,
  REVENUE_LABEL,
  revenueTotal,
  type RevenueEntry,
  type RevenueFilter,
} from '../lib/revenue'
import { CloseButton } from './Overlay'

const DETAIL: RevenueFilter[] = ['dia', 'semana', 'quinzena', 'mensal', 'total']

type RevenueScreenProps = {
  entries: RevenueEntry[]
  status: 'loading' | 'ready' | 'error'
  onClose: () => void
}

export function RevenueScreen({ entries, status, onClose }: RevenueScreenProps) {
  const [filter, setFilter] = useState<RevenueFilter>('geral')
  const now = new Date()

  return (
    <div className="product-screen" role="dialog" aria-modal="true" aria-label="Faturamento">
      <div className="product-screen__inner">
        <div className="product-screen__bar">
          <h2>Faturamento</h2>
          <CloseButton onClick={onClose} />
        </div>
        <div className="revenue__filters" role="tablist" aria-label="Período">
          {REVENUE_FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={filter === key ? 'is-active' : ''}
              onClick={() => setFilter(key)}
            >
              {REVENUE_LABEL[key]}
            </button>
          ))}
        </div>
        {status === 'loading' && <p className="muted">Carregando faturamento.</p>}
        {status === 'error' && (
          <p className="alert" role="alert">
            Não foi possível carregar o faturamento.
          </p>
        )}
        {status === 'ready' && filter === 'geral' && (
          <ul className="revenue__list">
            {DETAIL.map((key) => (
              <li key={key}>
                <span>{REVENUE_LABEL[key]}</span>
                <strong>{formatPrice(revenueTotal(entries, key, now))}</strong>
              </li>
            ))}
          </ul>
        )}
        {status === 'ready' && filter !== 'geral' && (
          <p className="revenue__total">
            {REVENUE_LABEL[filter]} <strong>{formatPrice(revenueTotal(entries, filter, now))}</strong>
          </p>
        )}
      </div>
    </div>
  )
}
