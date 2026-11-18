import { useCallback, useEffect, useState } from 'react'
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
import { AdminPrompt } from './AdminPrompt'
import { AttendancePrompt } from './AttendancePrompt'
import { BottomBar } from './BottomBar'
import { CartSheet } from './CartSheet'
import { OrderHistory } from './OrderHistory'
import { Overlay } from './Overlay'
import { ProductDialog } from './ProductDialog'
import { ProductForm } from './ProductForm'
import { ProfileSheet } from './ProfileSheet'
import { SideMenu } from './SideMenu'

type Sheet = 'cart' | 'profile' | 'whatsapp' | 'menu' | 'orders' | 'product-form' | null

function linkedProductId(): string {
  try {
    return new URLSearchParams(window.location.search).get('produto') ?? ''
  } catch {
    return ''
  }
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function MenuScreen() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<Catalog>(seedCatalog)
  const [categoryId, setCategoryId] = useState(readSavedCategory)
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<CartLine[]>([])
  const [product, setProduct] = useState<Product | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [linkedId, setLinkedId] = useState(linkedProductId)

  useEffect(() => {
    document.title = 'Cardápio | Smash Burguer'
  }, [])

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
    setProduct(null)
  }

  const hold = useLongPress(() => {
    if (isAdmin) {
      navigate('/admin')
      return
    }
    setAdminOpen(true)
  })

  function toggle(next: Sheet) {
    setSheet((current) => (current === next ? null : next))
  }

  return (
    <main className="menu">
      <div className="menu__content">
      <header className="menu__top">
        <button
          type="button"
          className="menu__burger"
          aria-label="Abrir menu"
          aria-expanded={sheet === 'menu'}
          onClick={() => toggle('menu')}
        >
          <MenuIcon />
        </button>
        <button type="button" className="menu__logo" aria-label="Smash Burguer" {...hold}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
        </button>
        <div>
          <p className="eyebrow">Smash Burguer</p>
          <h1 className="menu__title">Cardápio</h1>
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
      {sheet === 'menu' && (
        <SideMenu
          onClose={() => setSheet(null)}
          onOrders={() => setSheet('orders')}
          onPanel={() => navigate('/admin')}
          onCreateProduct={() => setSheet('product-form')}
        />
      )}
      {sheet === 'orders' && (
        <Overlay label="Meus pedidos" onClose={() => setSheet(null)}>
          <h2>Meus pedidos</h2>
          <OrderHistory />
        </Overlay>
      )}
      {sheet === 'product-form' && isAdmin && (
        <ProductForm onClose={() => setSheet(null)} onSaved={reloadCatalog} />
      )}
      {adminOpen && <AdminPrompt onClose={() => setAdminOpen(false)} />}
    </main>
  )
}
