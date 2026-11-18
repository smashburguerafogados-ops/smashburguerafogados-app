import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_CLOSED_MESSAGE, saveShop, watchShop, type ShopSettings } from '../lib/shop'

export function ShopScreen({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="product-screen" role="dialog" aria-modal="true" aria-label="Funcionamento">
      <div className="product-screen__inner">
        <div className="product-screen__bar">
          <h2>Funcionamento</h2>
          <button type="button" className="text-btn" onClick={onClose}>
            Fechar
          </button>
        </div>
        <ShopControls />
      </div>
    </div>
  )
}

function ShopControls(): ReactNode {
  const [shop, setShop] = useState<ShopSettings>({ online: true, message: DEFAULT_CLOSED_MESSAGE })
  const [draft, setDraft] = useState(DEFAULT_CLOSED_MESSAGE)
  const [error, setError] = useState('')
  const dirty = useRef(false)

  useEffect(
    () =>
      watchShop(
        (next) => {
          setShop(next)
          if (!dirty.current) setDraft(next.message)
        },
        () => setError('Não foi possível carregar o status da loja.'),
      ),
    [],
  )

  async function toggle() {
    setError('')
    const next = { online: !shop.online, message: draft }
    setShop(next)
    try {
      await saveShop(next)
    } catch {
      setError('Não foi possível atualizar a loja.')
    }
  }

  async function saveMessage() {
    setError('')
    const next = { online: shop.online, message: draft }
    dirty.current = false
    setShop(next)
    try {
      await saveShop(next)
    } catch {
      setError('Não foi possível salvar a mensagem.')
    }
  }

  return (
    <section className="shop-controls" aria-label="Funcionamento">
      <div className="shop-controls__row">
        <span>Online</span>
        <button type="button" role="switch" aria-checked={shop.online} aria-label="Online" onClick={() => void toggle()}>
          <span className="shop-controls__knob" />
        </button>
      </div>
      <label className="field">
        <span>Mensagem de fechado</span>
        <textarea
          rows={3}
          maxLength={280}
          value={draft}
          onChange={(event) => {
            dirty.current = true
            setDraft(event.target.value)
          }}
        />
      </label>
      <button type="button" className="btn btn--ghost" onClick={() => void saveMessage()}>
        Salvar mensagem
      </button>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
