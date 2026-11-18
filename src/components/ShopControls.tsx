import { useEffect, useRef, useState } from 'react'
import { DEFAULT_CLOSED_MESSAGE, saveShop, watchShop, type ShopSettings } from '../lib/shop'

export function ShopControls() {
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
