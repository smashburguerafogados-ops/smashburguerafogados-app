import { Overlay } from './Overlay'

type SideMenuProps = {
  onClose: () => void
  onPanel: () => void
  onCreateProduct: () => void
}

export function SideMenu({ onClose, onPanel, onCreateProduct }: SideMenuProps) {
  return (
    <Overlay label="Menu" onClose={onClose} variant="drawer">
      <h2>Menu</h2>
      <nav className="drawer__nav" aria-label="Opções">
        <button type="button" className="drawer__link" onClick={onPanel}>
          Painel de pedidos
        </button>
        <button type="button" className="drawer__link" onClick={onCreateProduct}>
          Criar Produto
        </button>
      </nav>
    </Overlay>
  )
}
