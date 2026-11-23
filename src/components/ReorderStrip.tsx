import { useEffect, useRef, useState, type RefObject } from 'react'
import { formatPrice } from '../lib/money'
import type { Order } from '../lib/orders'
import { formatOrderWhen, planReorder, recentOrders, type ReorderEntry, type ReorderLine, type ReorderPlan } from '../lib/reorder'
import type { Product } from '../data/catalog'
import { Overlay } from './Overlay'
import { ProductPhoto } from './ProductPhoto'

export const REORDER_AUTOPLAY_MS = 3000
const REORDER_SETTLE_MS = 800

type ReorderStripProps = {
  orders: Order[]
  products: Product[]
  onReorder: (entries: ReorderEntry[], label: string) => void
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M19 8.5A7.5 7.5 0 0 0 5.8 7M5 3.8V7.2h3.4M5 15.5A7.5 7.5 0 0 0 18.2 17M19 20.2V16.8h-3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5.5 15.5 12 9 18.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function unitsLabel(units: number): string {
  return `${units} ${units === 1 ? 'item' : 'itens'}`
}

function LineRow({ line }: { line: ReorderLine }) {
  const off = line.status !== 'ok'
  return (
    <li className={off ? 'reorder-line is-off' : 'reorder-line'}>
      {line.image ? <ProductPhoto className="reorder-line__img" src={line.image} eager /> : <span className="reorder-line__img" aria-hidden="true" />}
      <div className="reorder-line__info">
        <strong className="reorder-line__name">{line.name}</strong>
        <span className="reorder-line__qty">
          {line.unitCents === null ? `${line.qty}×` : `${line.qty} × ${formatPrice(line.unitCents)}`}
        </span>
        {line.extras.length > 0 && <p className="reorder-line__extras">+ {line.extras.join(', ')}</p>}
        {line.goneExtras.length > 0 && (
          <p className="reorder-line__warn">Adicional indisponível: {line.goneExtras.join(', ')}</p>
        )}
        {line.note && <p className="reorder-line__note">{line.note}</p>}
        {off && (
          <p className="reorder-line__warn">{line.status === 'esgotado' ? 'Esgotado hoje' : 'Não está mais no cardápio'}</p>
        )}
      </div>
      {line.unitCents !== null && <span className="reorder-line__total">{formatPrice(line.unitCents * line.qty)}</span>}
    </li>
  )
}

function ReorderSheet({ plan, onClose, onAdd }: { plan: ReorderPlan; onClose: () => void; onAdd: () => void }) {
  const none = plan.available === 0
  const when = formatOrderWhen(plan.createdAtMs)
  const title = when ? `Compra de ${when}` : 'Sua compra'
  return (
    <Overlay label={title} onClose={onClose} modal panelClass="reorder">
      <div className="reorder-sheet">
        <h2>{title}</h2>
        <p className="reorder-sheet__count">
          {plan.available < plan.wanted
            ? `${plan.available} de ${plan.wanted} itens disponíveis`
            : unitsLabel(plan.wanted)}
        </p>
        <ul className="reorder-sheet__list">
          {plan.lines.map((line) => (
            <LineRow key={line.key} line={line} />
          ))}
        </ul>
        <div className="reorder-sheet__foot">
          <p className="reorder-sheet__total">
            Total <strong>{none ? '—' : formatPrice(plan.totalCents)}</strong>
          </p>
          <button type="button" className="btn" disabled={none} onClick={onAdd}>
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </Overlay>
  )
}

function cardsOf(scroller: HTMLElement): HTMLElement[] {
  return Array.from(scroller.children) as HTMLElement[]
}

/** Scroll position each card snaps to, limited to what the container can really reach. */
function snapTargets(scroller: HTMLElement): number[] {
  const cards = cardsOf(scroller)
  if (cards.length === 0) return []
  const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
  const base = cards[0].offsetLeft
  return cards.map((card) => Math.min(max, Math.max(0, card.offsetLeft - base)))
}

function nearestIndex(scroller: HTMLElement): number {
  const targets = snapTargets(scroller)
  let best = 0
  let bestDistance = Infinity
  targets.forEach((target, index) => {
    const distance = Math.abs(scroller.scrollLeft - target)
    if (distance <= bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

function focusIsVisibleInside(scroller: HTMLElement): boolean {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !scroller.contains(active)) return false
  try {
    return active.matches(':focus-visible')
  } catch {
    return false
  }
}

/**
 * Moves the carousel to the next card every few seconds (back to the first after the last).
 * It only scrolls the carousel itself, never the page, and never moves focus.
 * Every pause (touch, hover, hidden tab, off screen, open panel, reduced motion) restarts the full wait on resume.
 */
function useReorderAutoplay(scrollRef: RefObject<HTMLUListElement | null>, listKey: string, count: number, panelOpen: boolean) {
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || count < 2 || panelOpen) return

    const motion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    let hover = false
    let touching = false
    let hidden = document.hidden
    let onScreen = true
    let focused = focusIsVisibleInside(scroller)
    let moving = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let settle: ReturnType<typeof setTimeout> | undefined

    const running = () => !motion?.matches && !hover && !touching && !hidden && onScreen && !focused

    function schedule() {
      clearTimeout(timer)
      timer = undefined
      if (running()) timer = setTimeout(advance, REORDER_AUTOPLAY_MS)
    }

    function advance() {
      timer = undefined
      const targets = snapTargets(scroller!)
      if (targets.length >= 2 && scroller!.scrollWidth > scroller!.clientWidth) {
        const next = (nearestIndex(scroller!) + 1) % targets.length
        moving = true
        clearTimeout(settle)
        settle = setTimeout(() => {
          moving = false
        }, REORDER_SETTLE_MS)
        if (typeof scroller!.scrollTo === 'function') scroller!.scrollTo({ left: targets[next], behavior: 'smooth' })
        else scroller!.scrollLeft = targets[next]
      }
      schedule()
    }

    const onScroll = () => {
      if (!moving) schedule()
    }
    const onTouchStart = () => {
      touching = true
      schedule()
    }
    const onTouchEnd = () => {
      touching = false
      schedule()
    }
    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') return
      hover = true
      schedule()
    }
    const onPointerLeave = () => {
      hover = false
      schedule()
    }
    const onFocusIn = () => {
      focused = focusIsVisibleInside(scroller)
      schedule()
    }
    const onFocusOut = () => {
      focused = false
      schedule()
    }
    const onVisibility = () => {
      hidden = document.hidden
      schedule()
    }
    const onMotion = () => schedule()

    scroller.addEventListener('scroll', onScroll, { passive: true })
    scroller.addEventListener('touchstart', onTouchStart, { passive: true })
    scroller.addEventListener('touchend', onTouchEnd, { passive: true })
    scroller.addEventListener('touchcancel', onTouchEnd, { passive: true })
    scroller.addEventListener('pointerenter', onPointerEnter)
    scroller.addEventListener('pointerleave', onPointerLeave)
    scroller.addEventListener('focusin', onFocusIn)
    scroller.addEventListener('focusout', onFocusOut)
    document.addEventListener('visibilitychange', onVisibility)
    motion?.addEventListener?.('change', onMotion)

    let observer: IntersectionObserver | undefined
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(
        (entries) => {
          const last = entries[entries.length - 1]
          if (!last) return
          onScreen = last.isIntersecting && last.intersectionRatio >= 0.5
          schedule()
        },
        { threshold: [0, 0.5, 1] },
      )
      observer.observe(scroller)
    }

    schedule()

    return () => {
      clearTimeout(timer)
      clearTimeout(settle)
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('touchstart', onTouchStart)
      scroller.removeEventListener('touchend', onTouchEnd)
      scroller.removeEventListener('touchcancel', onTouchEnd)
      scroller.removeEventListener('pointerenter', onPointerEnter)
      scroller.removeEventListener('pointerleave', onPointerLeave)
      scroller.removeEventListener('focusin', onFocusIn)
      scroller.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('visibilitychange', onVisibility)
      motion?.removeEventListener?.('change', onMotion)
      observer?.disconnect()
    }
  }, [scrollRef, listKey, count, panelOpen])
}

function useCurrentCard(scrollRef: RefObject<HTMLUListElement | null>, listKey: string, count: number): number {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || count < 2) return
    const update = () => setIndex(nearestIndex(scroller))
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    return () => scroller.removeEventListener('scroll', update)
  }, [scrollRef, listKey, count])
  return Math.min(index, Math.max(0, count - 1))
}

export function ReorderStrip({ orders, products, onReorder }: ReorderStripProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLUListElement>(null)
  const plans = recentOrders(orders).map((order) => planReorder(order, products))
  const listKey = plans.map((plan) => plan.orderId).join('|')
  const openPlanId = plans.some((plan) => plan.orderId === openId) ? openId : null
  useReorderAutoplay(scrollRef, listKey, plans.length, openPlanId !== null)
  const current = useCurrentCard(scrollRef, listKey, plans.length)
  if (plans.length === 0) return null
  const openPlan = plans.find((plan) => plan.orderId === openId)

  return (
    <section className="reorder" aria-label="Pedir de novo">
      <p className="reorder__label">
        <RefreshIcon />
        <span>
          Peça de <b>novo</b>
        </span>
      </p>
      {plans.length > 1 && (
        <span className="reorder__dots" aria-hidden="true">
          {plans.map((plan, index) => (
            <i key={plan.orderId} className={index === current ? 'is-on' : undefined} />
          ))}
        </span>
      )}
      <ul className="reorder__scroll" ref={scrollRef}>
        {plans.map((plan) => {
          const none = plan.available === 0
          const partial = !none && plan.available < plan.wanted
          const when = formatOrderWhen(plan.createdAtMs)
          return (
            <li key={plan.orderId} className={none ? 'reorder__card is-off' : 'reorder__card'}>
              <button
                type="button"
                className="reorder__open"
                aria-haspopup="dialog"
                aria-label={`Ver itens do pedido${when ? ` de ${when}` : ''}`}
                onClick={() => setOpenId(plan.orderId)}
              >
                <span className="reorder__thumbs" aria-hidden="true">
                  {plan.images.slice(0, 3).map((image) => (
                    <ProductPhoto key={image} src={image} />
                  ))}
                </span>
                <span className="reorder__info">
                  <span className="reorder__meta">
                    {partial || none
                      ? `${plan.available} de ${plan.wanted} itens disponíveis`
                      : `${unitsLabel(plan.wanted)}${when ? ` · ${when}` : ''}`}
                  </span>
                  <strong className="reorder__total">{none ? 'Indisponível' : formatPrice(plan.totalCents)}</strong>
                </span>
                <span className="reorder__chevron" aria-hidden="true">
                  <ChevronIcon />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {openPlan && (
        <ReorderSheet
          plan={openPlan}
          onClose={() => setOpenId(null)}
          onAdd={() => {
            onReorder(openPlan.entries, `${openPlan.available} ${openPlan.available === 1 ? 'item' : 'itens'} do pedido`)
            setOpenId(null)
          }}
        />
      )}
    </section>
  )
}
