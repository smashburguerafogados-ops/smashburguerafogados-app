import { Overlay } from './Overlay'

type SideMenuProps = {
  onClose: () => void
  onPanel: () => void
  onShop: () => void
  onProducts: () => void
  onRevenue: () => void
  onThemes: () => void
  onContact: () => void
  onRaffle: () => void
  onCreateProduct: () => void
}

export function SideMenu({
  onClose,
  onPanel,
  onShop,
  onProducts,
  onRevenue,
  onThemes,
  onContact,
  onRaffle,
  onCreateProduct,
}: SideMenuProps) {
  return (
    <Overlay label="Menu" onClose={onClose} variant="drawer">
      <h2>Menu</h2>
      <nav className="drawer__nav" aria-label="Opções">
        <button type="button" className="drawer__link" onClick={onPanel}>
          Painel de pedidos
        </button>
        <button type="button" className="drawer__link" onClick={onShop}>
          Funcionamento
        </button>
        <button type="button" className="drawer__link" onClick={onProducts}>
          Produtos
        </button>
        <button type="button" className="drawer__link" onClick={onRevenue}>
          Faturamento
        </button>
        <button type="button" className="drawer__link" onClick={onThemes}>
          Temas
        </button>
        <button type="button" className="drawer__link" onClick={onContact}>
          Contato
        </button>
        <button type="button" className="drawer__link" onClick={onRaffle}>
          Sorteio Smash Burger
        </button>
        <button type="button" className="drawer__link" onClick={onCreateProduct}>
          Criar Produto
        </button>
      </nav>
    </Overlay>
  )
}
