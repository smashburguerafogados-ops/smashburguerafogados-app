import { useState } from 'react'
import { saveTheme, THEME_IDS, THEME_LABEL, type ThemeId } from '../lib/theme'
import { CloseButton } from './Overlay'

type ThemeScreenProps = {
  applied: ThemeId
  onClose: () => void
}

export function ThemeScreen({ applied, onClose }: ThemeScreenProps) {
  const [draft, setDraft] = useState<ThemeId>(applied)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      await saveTheme(draft)
    } catch {
      setError('Não foi possível salvar o tema.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="product-screen" role="dialog" aria-modal="true" aria-label="Temas">
      <div className="product-screen__inner">
        <div className="product-screen__bar">
          <h2>Temas</h2>
          <CloseButton onClick={onClose} />
        </div>
        <fieldset className="theme-options">
          <legend className="sr-only">Tema</legend>
          {THEME_IDS.map((id) => (
            <label key={id} className={draft === id ? 'is-selected' : ''}>
              <input
                type="radio"
                name="tema"
                value={id}
                checked={draft === id}
                onChange={() => setDraft(id)}
              />
              {THEME_LABEL[id]}
            </label>
          ))}
        </fieldset>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn" disabled={busy} onClick={() => void confirm()}>
          Confirmar
        </button>
      </div>
    </div>
  )
}
