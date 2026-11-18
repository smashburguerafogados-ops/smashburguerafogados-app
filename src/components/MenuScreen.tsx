import { useEffect, useState } from 'react'
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
  type CartLine,
} from '../lib/menu'
import { formatPrice, toCents } from '../lib/money'
import { loadRemoteCatalog } from '../lib/remoteCatalog'
import { AdminPrompt } from './AdminPrompt'
import { BottomBar } from './BottomBar'
import { CartSheet } from './CartSheet'
import { ProductDialog } from './ProductDialog'
import { ProfileSheet } from './ProfileSheet'

type Sheet = 'cart' | 'profile' | null

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

  useEffect(() => {
    document.title = 'Cardápio | Smash Burguer'
  }, [])

  useEffect(() => {
    let active = true
    void loadRemoteCatalog().then((remote) => {
      if (active && remote) setCatalog(remote)
    })
    return () => {
      active = false
    }
  }, [])

  const activeCategory = catalog.categories.some((category) => category.id === categoryId) ? categoryId : ''
  const visible = filterProducts(catalog.products, activeCategory, search)
  const count = cartCount(lines)
  const total = cartTotal(lines)

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
    setLines((current) =>
      addCartLine(current, {
        key,
        productId: item.id,
        name: item.name,
        priceCents,
        note: clean,
      }),
    )
    setProduct(null)
  }

  const hold = useLongPress(() => {
    if (session.status === 'ready' && session.profile.role === 'admin') {
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
      <div className="menu__night" aria-hidden="true">
        <span className="menu__night-gold" />
        <span className="menu__night-coals" />
      </div>
      <div className="menu__content">
      <header className="menu__top">
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
        {catalog.categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={activeCategory === category.id ? 'chip is-active' : 'chip'}
            aria-pressed={activeCategory === category.id}
            onClick={() => chooseCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
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
        />
      )}
      {sheet === 'profile' && <ProfileSheet onClose={() => setSheet(null)} />}
      {adminOpen && <AdminPrompt onClose={() => setAdminOpen(false)} />}
    </main>
  )
}
