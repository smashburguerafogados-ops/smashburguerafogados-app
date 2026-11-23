import { useEffect, useState } from 'react'
import {
  hasInlinePhoto,
  movePhotosBack,
  movePhotosOut,
  photoRulesPublished,
  type ListedProduct,
  type PhotoMoveResult,
} from '../lib/adminCatalog'
import { isPhotoRef } from '../lib/productPhotos'

type Action = 'out' | 'back'

function photosLabel(count: number): string {
  return `${count} ${count === 1 ? 'foto' : 'fotos'}`
}

/** Manual, opt-in move of legacy inline photos to productPhotos, with an undo. */
export function PhotoMigration({ products }: { products: ListedProduct[] }) {
  const [asking, setAsking] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const inline = products.filter(hasInlinePhoto).length
  const separate = products.filter((product) => isPhotoRef(product.image)).length

  useEffect(() => {
    if (!asking) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      setAsking(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [asking])

  if (inline === 0 && separate === 0 && !result && !error) return null

  async function run(action: Action) {
    setAsking(null)
    setBusy(true)
    setResult('')
    setError('')
    try {
      if (action === 'out' && !(await photoRulesPublished())) {
        setError('As regras novas do Firestore ainda não foram publicadas. Nada foi alterado.')
        return
      }
      const verb = action === 'out' ? 'Movendo' : 'Voltando'
      const step = (done: number, total: number) => setProgress(`${verb} ${done} de ${total}…`)
      const outcome: PhotoMoveResult = action === 'out' ? await movePhotosOut(products, step) : await movePhotosBack(products, step)
      setResult(
        action === 'out'
          ? `${photosLabel(outcome.done)} no formato rápido.`
          : `${photosLabel(outcome.done)} de volta dentro dos produtos.`,
      )
      if (outcome.failed.length > 0) {
        setError(`Não deu para mexer em: ${outcome.failed.join(', ')}. Esses continuam como estavam; tente de novo.`)
      }
    } catch {
      setError('Não foi possível conferir as regras do Firestore. Nada foi alterado.')
    } finally {
      setProgress('')
      setBusy(false)
    }
  }

  return (
    <section className="photo-move" aria-label="Fotos do cardápio">
      <h3 className="catalog__heading">Fotos do cardápio</h3>
      {inline > 0 ? (
        <p className="muted">
          {photosLabel(inline)} ainda {inline === 1 ? 'está' : 'estão'} dentro dos produtos. Em rede lenta o cardápio espera
          todas antes de mostrar os itens. No formato rápido, nomes e preços aparecem primeiro e cada foto chega depois.
        </p>
      ) : (
        <p className="muted">Todas as fotos estão no formato rápido.</p>
      )}
      <div className="actions">
        {inline > 0 && (
          <button type="button" className="btn" disabled={busy} onClick={() => setAsking('out')}>
            Mover {photosLabel(inline)}
          </button>
        )}
        {separate > 0 && (
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setAsking('back')}>
            Desfazer: voltar fotos para os produtos
          </button>
        )}
      </div>
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
            <h2>{asking === 'out' ? 'Mover as fotos?' : 'Voltar as fotos?'}</h2>
            <p className="muted">
              {asking === 'out'
                ? 'Cada foto ganha uma cópia de segurança e só sai do produto depois que a cópia é conferida. Dá para desfazer depois.'
                : 'Cada foto volta para dentro do seu produto, como era antes. O cardápio volta a esperar todas as fotos.'}
            </p>
            <div className="confirm-screen__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setAsking(null)}>
                Cancelar
              </button>
              <button type="button" className="btn" onClick={() => void run(asking)}>
                {asking === 'out' ? 'Mover' : 'Voltar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
