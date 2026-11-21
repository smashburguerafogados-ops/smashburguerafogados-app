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
  HOME_LABEL,
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
import { ProductDialog, descriptionItems } from './ProductDialog'
import { DeliveryForm } from './DeliveryForm'
import type { UserProfile } from '../types'
import { CategoryIcon, iconForCategory } from '../lib/categoryIcons'

type Sheet = 'cart' | 'profile' | 'whatsapp' | 'orders' | null

const EMPTY_CUSTOMER: UserProfile = {
  uid: '',
  nome: '',
  whatsapp: '',
  address: null,
  role: 'customer',
}

/** Signed out: phone first, same lookup as the order. Signed in: the account as before. */
function ContaSheet({ onClose }: { onClose: () => void }) {
  const { session } = useAuth()
  const customer = session.status === 'ready' && session.profile.role === 'customer' ? session.profile : null
  const [identify] = useState(() => !customer)
  const [opened, setOpened] = useState<UserProfile | null>(null)

  if (identify && !opened) {
    return (
      <DeliveryForm
        key="identify"
        profile={customer ?? EMPTY_CUSTOMER}
        ordering
        fromAccount
        onClose={onClose}
        onSaved={(saved) => setOpened(saved)}
      />
    )
  }

  return (
    <DeliveryForm
      key="account"
      profile={opened ?? customer ?? EMPTY_CUSTOMER}
      onClose={onClose}
      onSaved={onClose}
    />
  )
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
    return <ClosedScreen message={shop.message} hours={shop.hours} />
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
        <button
          type="button"
          className="menu__cart"
          aria-label={`Abrir carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
          onClick={() => toggle('cart')}
        >
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
          {count > 0 && <span className="menu__cart-count">{count}</span>}
        </button>
      </header>

      {shop.hours ? (
        <p className="menu__hours" role="status">
          Horário: {shop.hours}
        </p>
      ) : null}

      <label className="field menu__search">
        <span className="sr-only">Buscar</span>
        <svg className="menu__search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16l4.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          placeholder="Buscar no cardápio…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {catalogError && (
        <p className="alert" role="alert">
          Não foi possível carregar o cardápio.
        </p>
      )}
      {!catalog && !catalogError && (
        <p className="menu-loading" role="status" aria-label="Carregando o cardápio." aria-busy="true">
          <span className="menu-loading__spin" aria-hidden="true" />
          Carregando o cardápio.
        </p>
      )}

      {catalog && (
      <>
      <div className="chips" role="toolbar" aria-label="Categorias">
        <button
          type="button"
          className={activeCategory ? 'chip' : 'chip is-active'}
          aria-pressed={!activeCategory}
          onClick={() => chooseCategory('')}
        >
          <CategoryIcon iconKey="home" />
          {HOME_LABEL}
        </button>
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
              <CategoryIcon iconKey={iconForCategory(category.name, category.icon)} />
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
                  <span className="item__price">{formatPrice(toCents(item.price))}</span>
                  {item.description.trim() && (
                    <span className="item__desc">{descriptionItems(item.description).join(', ')}</span>
                  )}
                  {!item.available && <span className="item__tag">Esgotado</span>}
                </span>
                {item.available && (
                  <span className="mark-btn item__add" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 6v12M6 12h12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  </span>
                )}
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
      {sheet === 'profile' && <ContaSheet onClose={() => setSheet(null)} />}
      {sheet === 'whatsapp' && <AttendancePrompt onClose={() => setSheet(null)} />}
      {sheet === 'orders' && (
        <Overlay label="Meus pedidos" onClose={() => setSheet(null)} back>
          <h2>Meus pedidos</h2>
          <OrderHistory />
        </Overlay>
      )}
      {adminOpen && <AdminPrompt onClose={() => setAdminOpen(false)} />}
    </main>
  )
}
