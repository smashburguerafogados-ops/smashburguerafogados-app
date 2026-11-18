import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { seedCatalog, type Catalog, type Product } from '../data/catalog'
import { useAuth } from '../context/AuthContext'
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
import { loadRemoteCatalog } from '../lib/remoteCatalog'
import { useShop } from '../lib/shop'
import { AdminPrompt } from './AdminPrompt'
import { ClosedScreen } from './ClosedScreen'
import { AttendancePrompt } from './AttendancePrompt'
import { BottomBar } from './BottomBar'
import { CartSheet } from './CartSheet'
import { OrderHistory } from './OrderHistory'
import { Overlay } from './Overlay'
import { ProductDialog } from './ProductDialog'
import { ProfileSheet } from './ProfileSheet'

type Sheet = 'cart' | 'profile' | 'whatsapp' | 'orders' | null

function linkedProductId(): string {
  try {
    return new URLSearchParams(window.location.search).get('produto') ?? ''
  } catch {
    return ''
  }
}

export function MenuScreen() {
  const { session } = useAuth()
  const shop = useShop()
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<Catalog>(seedCatalog)
  const [categoryId, setCategoryId] = useState(readSavedCategory)
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<CartLine[]>([])
  const [product, setProduct] = useState<Product | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [linkedId, setLinkedId] = useState(linkedProductId)
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const noticeId = useRef(0)

  useEffect(() => {
    document.title = 'Cardápio | Smash Burguer'
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const reloadCatalog = useCallback(() => {
    let active = true
    void loadRemoteCatalog().then((remote) => {
      if (active && remote) setCatalog(remote)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => reloadCatalog(), [reloadCatalog])

  useEffect(() => {
    if (!linkedId) return
    const found = catalog.products.find((item) => item.id === linkedId)
    if (found) {
      setProduct(found)
      setLinkedId('')
    }
  }, [catalog, linkedId])

  const categories = sortCategories(catalog.categories)
  const activeCategory = categories.some((category) => category.id === categoryId) ? categoryId : ''
  const visible = sortProductsByCategory(filterProducts(catalog.products, activeCategory, search), categories)
  const count = cartCount(lines)
  const total = cartTotal(lines)
  const isAdmin = session.status === 'ready' && session.profile.role === 'admin'

  function chooseCategory(id: string) {
    const next = activeCategory === id ? '' : id
    setCategoryId(next)
    saveCategory(next)
  }

  function addProduct(item: Product, note: string, extraIds: string[]) {
    if (!item.available) return
    const extras = (item.extras ?? []).filter((extra) => extraIds.includes(extra.id))
    const priceCents = toCents(item.price) + extras.reduce((sum, extra) => sum + toCents(extra.price), 0)
    const clean = note.trim()
    const key = [item.id, clean, extras.map((extra) => extra.id).sort().join(',')].join('|')
    const name = extras.length > 0 ? `${item.name} + ${extras.map((extra) => extra.name).join(', ')}` : item.name
    setLines((current) =>
      addCartLine(current, {
        key,
        productId: item.id,
        name,
        image: item.image,
        priceCents,
        note: clean,
      }),
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
    setSheet((current) => (current === next ? null : next))
  }

  return (
    <main className="menu">
      {notice && (
        <p className="toast" role="status">
          {notice.text}
        </p>
      )}
      <div className="menu__content">
      <header className="menu__top">
        <button type="button" className="menu__logo" aria-label="Smash Burguer" {...hold}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
        </button>
        <div className="menu__brand">
          <p className="eyebrow">Smash Burguer</p>
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
      </div>

      <BottomBar
        sheet={sheet}
        count={count}
        totalCents={total}
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
          onAdd={(note, extraIds) => addProduct(product, note, extraIds)}
        />
      )}
      {sheet === 'cart' && (
        <CartSheet
          lines={lines}
          onClose={() => setSheet(null)}
          onRemove={(key) => setLines((current) => removeCartLine(current, key))}
          onPlaced={() => setLines([])}
          onNeedAccount={() => setSheet('profile')}
        />
      )}
      {sheet === 'profile' && <ProfileSheet onClose={() => setSheet(null)} />}
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
