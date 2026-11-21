import { useState } from 'react'
import { useNewVersion } from '../lib/appVersion'

export function UpdateNotice({ enabled }: { enabled?: boolean }) {
  const version = useNewVersion(enabled)
  const [dismissed, setDismissed] = useState('')

  if (!version || dismissed === version) return null

  return (
    <section className="added" aria-label="Nova versão">
      <p className="added__text" role="status">
        <span className="added__label">Nova versão</span> O app foi atualizado.
      </p>
      <div className="added__actions">
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Atualizar
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setDismissed(version)}>
          Agora não
        </button>
      </div>
    </section>
  )
}
