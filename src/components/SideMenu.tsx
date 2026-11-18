import { useAuth } from '../context/AuthContext'
import { Overlay } from './Overlay'

type SideMenuProps = {
  onClose: () => void
  onOrders: () => void
  onPanel: () => void
  onCreateProduct: () => void
}

export function SideMenu({ onClose, onOrders, onPanel, onCreateProduct }: SideMenuProps) {
  const { session } = useAuth()
  const isAdmin = session.status === 'ready' && session.profile.role === 'admin'

  return (
    <Overlay label="Menu" onClose={onClose} variant="drawer">
      <h2>Menu</h2>
      <nav className="drawer__nav" aria-label="Opções">
        {!isAdmin && (
          <button type="button" className="drawer__link" onClick={onOrders}>
            Meus pedidos
          </button>
        )}
        {isAdmin && (
          <>
            <button type="button" className="drawer__link" onClick={onPanel}>
              Painel de pedidos
            </button>
            <button type="button" className="drawer__link" onClick={onCreateProduct}>
              Criar Produto
            </button>
          </>
        )}
      </nav>
    </Overlay>
  )
}
