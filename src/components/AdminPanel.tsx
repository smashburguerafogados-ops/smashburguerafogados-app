import { useEffect, useRef, useState } from 'react'
import {
  COLUMN_LABEL,
  FULFILLMENT_LABEL,
  columnOf,
  orderMatches,
  ordersSince,
  watchAllOrders,
  type Order,
  type OrderColumn,
} from '../lib/orders'
import { keepListening } from '../lib/listen'
import { OrderDialog } from './OrderDialog'

const COLUMNS: OrderColumn[] = ['novos', 'andamento', 'finalizados']
const PAGE_SIZE = 20

function orderItems(order: Order): string[] {
  if (order.items.length === 0) return ['Sem itens']
  return order.items.map((item) => `${item.qty}× ${item.name}`)
}

export function AdminPanel() {
  const [orders, setOrders] = useState<Order[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [column, setColumn] = useState<OrderColumn>('novos')
  const [blink, setBlink] = useState(false)
  const [openId, setOpenId] = useState('')
  const [query, setQuery] = useState('')
  const [allTime, setAllTime] = useState(false)
  const [shown, setShown] = useState(PAGE_SIZE)
  const known = useRef<Set<string> | null>(null)

  useEffect(
    () =>
      keepListening(
        (fail) =>
          watchAllOrders((next) => {
            const seen = known.current
            if (seen && next.some((order) => order.status === 'novo' && !seen.has(order.id))) {
              setBlink(true)
            }
            known.current = new Set(next.map((order) => order.id))
            setOrders(next)
            setStatus('ready')
          }, fail, allTime ? null : ordersSince(Date.now())),
        () => setStatus('error'),
      ),
    [allTime],
  )

  function choose(next: OrderColumn) {
    setColumn(next)
    setShown(PAGE_SIZE)
    if (next === 'novos') setBlink(false)
  }

  const searching = query.trim() !== ''
  const visible = searching
    ? orders.filter((order) => orderMatches(order, query))
    : orders.filter((order) => columnOf(order.status) === column)
  const open = orders.find((order) => order.id === openId) ?? null
  const paged = !searching && column === 'finalizados'
  const rows = paged ? visible.slice(0, shown) : visible

  return (
    <section className="board" aria-label="Pedidos" aria-busy={status === 'loading'}>
      <label className="field board__search">
        <span className="sr-only">Buscar pedido</span>
        <input
          type="search"
          placeholder="Nome, WhatsApp ou nº do pedido"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setShown(PAGE_SIZE)
          }}
        />
      </label>
      <div className="board__columns" role="tablist" aria-label="Colunas">
        {COLUMNS.map((key) => {
          const count = orders.filter((order) => columnOf(order.status) === key).length
          const blinking = key === 'novos' && blink
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={column === key}
              className={column === key ? 'board__column is-active' : 'board__column'}
              onClick={() => choose(key)}
            >
              <span className={blinking ? 'board__title is-blinking' : 'board__title'}>{COLUMN_LABEL[key]}</span>
              <span className="board__count">{count}</span>
            </button>
          )
        })}
      </div>

      {status === 'loading' && (
        <p className="board-loading" role="status">
          <span className="board-loading__spin" aria-hidden="true" />
          Carregando pedidos.
        </p>
      )}
      {status === 'error' && (
        <p className="alert" role="alert">
          Não foi possível carregar os pedidos.
        </p>
      )}
      {status === 'ready' && visible.length === 0 && (
        <p className="muted">{searching ? 'Nenhum pedido encontrado.' : 'Nenhum pedido aqui.'}</p>
      )}

      {status === 'ready' && visible.length > 0 && (
      <ul className="board__list" aria-label={searching ? 'Resultado da busca' : COLUMN_LABEL[column]}>
        {rows.map((order) => (
          <li key={order.id}>
            <button
              type="button"
              className={`order-card order-card--${order.status}`}
              onClick={() => setOpenId(order.id)}
            >
              <span className="order-card__name">{order.customerName || 'Sem nome'}</span>
              <span className="order-card__mode">{FULFILLMENT_LABEL[order.fulfillment]}</span>
              <span className="order-card__order">
                {orderItems(order).map((line, index) => (
                  <span key={`${line}-${index}`}>{line}</span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
      )}

      {status === 'ready' && rows.length < visible.length && (
        <button type="button" className="btn btn--ghost board__more" onClick={() => setShown((count) => count + PAGE_SIZE)}>
          Mostrar mais ({visible.length - rows.length})
        </button>
      )}
      {status === 'ready' && !allTime && (searching || column === 'finalizados') && (
        <button type="button" className="text-btn board__older" onClick={() => setAllTime(true)}>
          Ver pedidos com mais de 30 dias
        </button>
      )}

      {open && <OrderDialog key={open.id} order={open} onClose={() => setOpenId('')} />}
    </section>
  )
}
