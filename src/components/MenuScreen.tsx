import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Catalog, Product } from '../data/catalog'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrdersContext'
import { isAccepted } from '../lib/orders'
import { useLongPress } from '../lib/longPress'
import {
  addCartLine,
  cartCount,
  cartTotal,
  filterProducts,
  readSavedCategory,
  removeCartLine,
  saveCategory,
  sortCategories,
  sortProductsByCategory,
  type CartLine,
} from '../lib/menu'
import { formatPrice, toCents } from '../lib/money'
import { watchRemoteCatalog } from '../lib/remoteCatalog'
import { scrollTopOf, stepDock } from '../lib/dockScroll'
import { useShop } from '../lib/shop'
import { AdminPrompt } from './AdminPrompt'
import { ClosedScreen } from './ClosedScreen'
import { AttendancePrompt } from './AttendancePrompt'
import { BottomBar } from './BottomBar'
import { CartSheet } from './CartSheet'
import { OrderHistory } from './OrderHistory'
import { Overlay } from './Overlay'
import { ProductDialog } from './ProductDialog'
import { DeliveryForm } from './DeliveryForm'
import type { UserProfile } from '../types'

type Sheet = 'cart' | 'profile' | 'whatsapp' | 'orders' | null

const EMPTY_CUSTOMER: UserProfile = {
  uid: '',
  nome: '',
  whatsapp: '',
  address: null,
  role: 'customer',
}

function linkedProductId(): string {
  try {
    return new URLSearchParams(window.location.search).get('produto') ?? ''
  } catch {
    return ''
  }
}

export function MenuScreen() {
  const { session } = useAuth()
  const history = useOrders()
  const shop = useShop()
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogError, setCatalogError] = useState(false)
  const [categoryId, setCategoryId] = useState(readSavedCategory)
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<CartLine[]>([])
  const [product, setProduct] = useState<Product | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [linkedId, setLinkedId] = useState(linkedProductId)
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const [dockAway, setDockAway] = useState(false)
  const noticeId = useRef(0)

  useEffect(() => {
    const anchors = new WeakMap<EventTarget, number>()
    let away = false
    let frame = 0

    function onScroll(event: Event) {
      const target = event.target
      const top = scrollTopOf(target)
      if (top === null || !target) return
      const anchor = anchors.get(target) ?? top
      const next = stepDock(away, anchor, top)
      anchors.set(target, next.anchor)
      if (next.hidden === away) return
      away = next.hidden
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setDockAway(away))
    }

    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true })
      cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    document.title = 'Cardápio | Smash Burger'
  }, [])

  useEffect(
    () =>
      watchRemoteCatalog(
        (next) => {
          setCatalog(next)
          setCatalogError(false)
        },
        () => setCatalogError(true),
      ),
    [],
  )

  useEffect(() => {
    if (!linkedId || !catalog) return
    const found = catalog.products.find((item) => item.id === linkedId)
    if (found) {
      setProduct(found)
      setLinkedId('')
    }
  }, [catalog, linkedId])

  const categories = catalog ? sortCategories(catalog.categories) : []
  const activeCategory = categories.some((category) => category.id === categoryId) ? categoryId : ''
  const visible = catalog
    ? sortProductsByCategory(filterProducts(catalog.products, activeCategory, search), categories)
    : []
  const count = cartCount(lines)
  const total = cartTotal(lines)
  const isAdmin = session.status === 'ready' && session.profile.role === 'admin'
  const orderLive = history.status === 'ready' && history.orders.some((order) => isAccepted(order.status))

  function chooseCategory(id: string) {
    const next = activeCategory === id ? '' : id
    setCategoryId(next)
    saveCategory(next)
  }

  function addProduct(item: Product, note: string, extraIds: string[], qty: number) {
    if (!item.available) return
    const extras = (item.extras ?? []).filter((extra) => extraIds.includes(extra.id))
    const priceCents = toCents(item.price) + extras.reduce((sum, extra) => sum + toCents(extra.price), 0)
    const clean = note.trim()
    const key = [item.id, clean, extras.map((extra) => extra.id).sort().join(',')].join('|')
    const name = extras.length > 0 ? `${item.name} + ${extras.map((extra) => extra.name).join(', ')}` : item.name
    setLines((current) =>
      addCartLine(
        current,
        {
          key,
          productId: item.id,
          name,
          image: item.image,
          priceCents,
          note: clean,
        },
        qty,
      ),
    )
    noticeId.current += 1
    setNotice({ id: noticeId.current, text: `Adicionado: ${name}` })
    setProduct(null)
  }

  const firstName =
    session.status === 'ready' ? (session.profile.nome.trim().split(/\s+/)[0] ?? '') : ''

  const hold = useLongPress(() => {
    if (isAdmin) {
      navigate('/admin')
      return
    }
    setAdminOpen(true)
  })

  const adminKeepsMenu = session.status === 'ready' && session.profile.role === 'admin'
  if (shop.ready && !shop.online && !adminKeepsMenu) {
    return <ClosedScreen message={shop.message} />
  }

  function toggle(next: Sheet) {
    setNotice(null)
    setSheet((current) => (current === next ? null : next))
  }

  return (
    <main className="menu">
      {notice && (
        <section key={notice.id} className="added" aria-label="Item adicionado">
          <p className="added__text" role="status">
            <span className="added__label">Adicionado:</span> {notice.text.replace(/^Adicionado:\s*/, '')}
          </p>
          <div className="added__actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setNotice(null)
                setSheet('cart')
              }}
            >
              Ir ao carrinho
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setNotice(null)}>
              Continuar no cardápio
            </button>
          </div>
        </section>
      )}
      <div className="menu__content">
      <header className="menu__top">
        <button type="button" className="menu__logo" aria-label="Smash Burger" {...hold}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
        </button>
        <div className="menu__brand">
          <p className="eyebrow">Smash Burger</p>
          {firstName ? <h1 className="menu__title">{firstName}</h1> : null}
        </div>
      </header>

      <label className="field menu__search">
        <span className="sr-only">Buscar</span>
        <input
          type="search"
          placeholder="Buscar"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {catalogError && (
        <p className="alert" role="alert">
          Não foi possível carregar o cardápio.
        </p>
      )}
      {!catalog && !catalogError && <p className="muted">Carregando o cardápio.</p>}

      {catalog && (
      <>
      <div className="chips" role="toolbar" aria-label="Categorias">
        {categories.map((category) => {
          const classes = ['chip']
          if (category.destaque) classes.push('chip--destaque')
          if (activeCategory === category.id) classes.push('is-active')
          return (
            <button
              key={category.id}
              type="button"
              className={classes.join(' ')}
              aria-pressed={activeCategory === category.id}
              onClick={() => chooseCategory(category.id)}
            >
              {category.name}
              {category.destaque && <span className="chip__sun" aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <p className="muted">Nenhum item encontrado.</p>
      ) : (
        <ul className="items">
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={item.available ? 'item' : 'item item--sold'}
                onClick={() => setProduct(item)}
              >
                <img src={item.image} alt="" />
                <span className="item__copy">
                  <span className="item__name">{item.name}</span>
                  {!item.available && <span className="item__tag">Esgotado</span>}
                </span>
                <span className="item__price">{formatPrice(toCents(item.price))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      </>
      )}
      </div>

      <BottomBar
        sheet={sheet}
        count={count}
        totalCents={total}
        away={dockAway}
        orderLive={orderLive}
        onOrders={() => toggle('orders')}
        onProfile={() => toggle('profile')}
        onCart={() => toggle('cart')}
        onWhatsapp={() => toggle('whatsapp')}
      />

      {product && (
        <ProductDialog
          key={product.id}
          product={product}
          onClose={() => setProduct(null)}
          onAdd={(note, extraIds, qty) => addProduct(product, note, extraIds, qty)}
        />
      )}
      {sheet === 'cart' && (
        <CartSheet
          lines={lines}
          onClose={() => setSheet(null)}
          onRemove={(key) => setLines((current) => removeCartLine(current, key))}
          onPlaced={() => setLines([])}
        />
      )}
      {sheet === 'profile' && (
        <DeliveryForm
          profile={session.status === 'ready' && session.profile.role === 'customer' ? session.profile : EMPTY_CUSTOMER}
          onClose={() => setSheet(null)}
          onSaved={() => setSheet(null)}
        />
      )}
      {sheet === 'whatsapp' && <AttendancePrompt onClose={() => setSheet(null)} />}
      {sheet === 'orders' && (
        <Overlay label="Meus pedidos" onClose={() => setSheet(null)}>
          <h2>Meus pedidos</h2>
          <OrderHistory />
        </Overlay>
      )}
      {adminOpen && <AdminPrompt onClose={() => setAdminOpen(false)} />}
    </main>
  )
}
