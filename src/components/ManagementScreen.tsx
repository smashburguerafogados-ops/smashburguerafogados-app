import { useEffect, useRef, useState } from 'react'
import { formatPrice, maskPrice } from '../lib/money'
import { saveDeliveryFee, watchShop } from '../lib/shop'
import { CloseButton } from './Overlay'

function centsFromMask(masked: string): number {
  const digits = masked.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

export function ManagementScreen({ onClose }: { onClose: () => void }) {
  const [fee, setFee] = useState('')
  const [current, setCurrent] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dirty = useRef(false)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(
    () =>
      watchShop(
        (shop) => {
          setCurrent(shop.deliveryFeeCents)
          if (!dirty.current) {
            setFee(shop.deliveryFeeCents > 0 ? formatPrice(shop.deliveryFeeCents).replace('R$ ', '') : '')
          }
        },
        () => setError('Não foi possível carregar o valor da entrega.'),
      ),
    [],
  )

  async function save() {
    setBusy(true)
    setError('')
    setNotice('')
    const cents = centsFromMask(fee)
    dirty.current = false
    try {
      await saveDeliveryFee(cents)
      setCurrent(cents)
      setFee(cents > 0 ? formatPrice(cents).replace('R$ ', '') : '')
      setNotice('Valor da entrega salvo.')
    } catch {
      setError('Não foi possível salvar o valor da entrega.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="product-screen" role="dialog" aria-modal="true" aria-label="Gerenciamento">
      <div className="product-screen__inner">
        <div className="product-screen__bar">
          <h2>Gerenciamento</h2>
          <CloseButton onClick={onClose} />
        </div>
        <section className="shop-controls" aria-label="Valor da entrega">
          <p className="muted">Cobrado só na entrega. Na retirada o cliente não paga esta taxa.</p>
          <p role="status">Valor atual: {formatPrice(current)}</p>
          <div className="field">
            <span id="delivery-fee">Valor da entrega</span>
            <div className="money-join">
              <span className="money-join__prefix" aria-hidden="true">
                R$
              </span>
              <input
                aria-labelledby="delivery-fee"
                inputMode="numeric"
                placeholder="0,00"
                value={fee}
                onChange={(event) => {
                  dirty.current = true
                  setFee(maskPrice(event.target.value))
                }}
              />
            </div>
          </div>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void save()}>
            {busy ? 'Salvando...' : 'Salvar valor da entrega'}
          </button>
          {notice && (
            <p className="hint hint--ok" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
