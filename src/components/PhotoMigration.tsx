import { useEffect, useState } from 'react'
import { movePhotosBack, type ListedProduct, type PhotoMoveResult } from '../lib/adminCatalog'
import { isPhotoRef } from '../lib/productPhotos'

function photosLabel(count: number): string {
  return `${count} ${count === 1 ? 'foto' : 'fotos'}`
}

/** The photos were already moved to productPhotos; only the undo is kept, with a quiet "done" note. */
export function PhotoMigration({ products }: { products: ListedProduct[] }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const separate = products.filter((product) => isPhotoRef(product.image)).length

  useEffect(() => {
    if (!asking) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      setAsking(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [asking])

  if (separate === 0 && !result && !error) return null

  async function undo() {
    setAsking(false)
    setBusy(true)
    setResult('')
    setError('')
    try {
      const step = (done: number, total: number) => setProgress(`Voltando ${done} de ${total}…`)
      const outcome: PhotoMoveResult = await movePhotosBack(products, step)
      setResult(`${photosLabel(outcome.done)} de volta dentro dos produtos.`)
      if (outcome.failed.length > 0) {
        setError(`Não deu para mexer em: ${outcome.failed.join(', ')}. Esses continuam como estavam; tente de novo.`)
      }
    } finally {
      setProgress('')
      setBusy(false)
    }
  }

  return (
    <section className="photo-move" aria-label="Fotos do cardápio">
      <h3 className="catalog__heading">Fotos do cardápio</h3>
      {separate > 0 && <p className="muted">Fotos no formato rápido.</p>}
      {separate > 0 && (
        <div className="actions">
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setAsking(true)}>
            Desfazer: voltar fotos para os produtos
          </button>
        </div>
      )}
      {progress && (
        <p className="muted" role="status">
          {progress}
        </p>
      )}
      {result && !progress && (
        <p className="notice" role="status">
          {result}
        </p>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {asking && (
        <div className="confirm-screen" role="alertdialog" aria-modal="true" aria-label="Confirmar fotos">
          <div className="confirm-screen__box">
            <h2>Voltar as fotos?</h2>
            <p className="muted">Cada foto volta para dentro do seu produto, como era antes. O cardápio volta a esperar todas as fotos.</p>
            <div className="confirm-screen__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setAsking(false)}>
                Cancelar
              </button>
              <button type="button" className="btn" onClick={() => void undo()}>
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
