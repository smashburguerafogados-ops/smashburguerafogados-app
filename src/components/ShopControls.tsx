import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_CLOSED_MESSAGE, saveShop, watchShop, type ShopSettings } from '../lib/shop'
import { CloseButton } from './Overlay'

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
          <CloseButton onClick={onClose} />
        </div>
        <ShopControls />
      </div>
    </div>
  )
}

function ShopControls(): ReactNode {
  const [shop, setShop] = useState<ShopSettings>({ online: true, message: DEFAULT_CLOSED_MESSAGE, hours: '' })
  const [draft, setDraft] = useState(DEFAULT_CLOSED_MESSAGE)
  const [hoursDraft, setHoursDraft] = useState('')
  const [error, setError] = useState('')
  const dirty = useRef(false)
  const hoursDirty = useRef(false)

  useEffect(
    () =>
      watchShop(
        (next) => {
          setShop(next)
          if (!dirty.current) setDraft(next.message)
          if (!hoursDirty.current) setHoursDraft(next.hours)
        },
        () => setError('Não foi possível carregar o status da loja.'),
      ),
    [],
  )

  async function toggle() {
    setError('')
    const next = { online: !shop.online, message: draft, hours: hoursDraft }
    setShop(next)
    try {
      await saveShop(next)
    } catch {
      setError('Não foi possível atualizar a loja.')
    }
  }

  async function saveMessage() {
    setError('')
    const next = { online: shop.online, message: draft, hours: hoursDraft }
    dirty.current = false
    setShop(next)
    try {
      await saveShop(next)
    } catch {
      setError('Não foi possível salvar a mensagem.')
    }
  }

  async function saveHours() {
    setError('')
    const next = { online: shop.online, message: draft, hours: hoursDraft }
    hoursDirty.current = false
    setShop(next)
    try {
      await saveShop(next)
    } catch {
      setError('Não foi possível salvar o horário.')
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
        <span>Horário de funcionamento</span>
        <input
          value={hoursDraft}
          maxLength={120}
          placeholder="Ex.: Quarta a domingo, 18h às 23h"
          onChange={(event) => {
            hoursDirty.current = true
            setHoursDraft(event.target.value)
          }}
        />
      </label>
      <button type="button" className="btn btn--ghost" onClick={() => void saveHours()}>
        Salvar horário
      </button>
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
