export type CategoryIconKey =
  | 'home'
  | 'burger'
  | 'combo'
  | 'fries'
  | 'drink'
  | 'sweet'
  | 'porcao'
  | 'lanche'
  | 'pizza'
  | 'acai'
  | 'salada'
  | 'frango'
  | 'carne'
  | 'peixe'
  | 'cerveja'
  | 'cafe'
  | 'suco'
  | 'refri'
  | 'churrasco'
  | 'wrap'
  | 'salgado'
  | 'bolo'
  | 'donut'
  | 'milkshake'
  | 'promo'
  | 'novo'
  | 'estrela'
  | 'fogo'
  | 'kids'
  | 'prato'

type IconDef = { label: string; paths: string[] }

export const CATEGORY_ICONS: Record<CategoryIconKey, IconDef> = {
  home: { label: 'Início', paths: ['M4 11l8-7 8 7', 'M6 10v9h12v-9', 'M10 19v-5h4v5'] },
  burger: {
    label: 'Hambúrguer',
    paths: ['M4 11c0-4 3.5-6 8-6s8 2 8 6z', 'M3 14h18', 'M4 17h16c0 2-2 3-4 3H8c-2 0-4-1-4-3z'],
  },
  combo: {
    label: 'Combo',
    paths: ['M3 11c0-3 3-5 5.5-5S14 8 14 11z', 'M3 14h11', 'M4 17h9c0 1.5-1 2.5-2.5 2.5h-4C5 19.5 4 18.5 4 17z', 'M17 8h4l-1 12h-2z'],
  },
  fries: { label: 'Batata', paths: ['M6 21l-1-11h14l-1 11z', 'M8 10V4', 'M12 10V3', 'M16 10V5'] },
  drink: { label: 'Bebida', paths: ['M7 8h10l-1.5 13h-7z', 'M6 8h12', 'M13 8l2-5'] },
  sweet: { label: 'Sobremesa', paths: ['M7 11a5 5 0 0110 0z', 'M7 11l5 10 5-10'] },
  porcao: { label: 'Porção', paths: ['M3 15h18', 'M5 15a7 7 0 0114 0', 'M12 8V6', 'M4 19h16'] },
  lanche: { label: 'Lanche', paths: ['M3 12a4 4 0 014-4h10a4 4 0 010 8H7a4 4 0 01-4-4z', 'M6 12c2-1.5 3 1.5 6 0s4-1.5 6 0'] },
  pizza: { label: 'Pizza', paths: ['M12 21L4 6c5-3 11-3 16 0z', 'M9 9.5h.01', 'M14 9h.01', 'M11.5 14h.01'] },
  acai: { label: 'Açaí', paths: ['M3 11h18c0 5-4 9-9 9s-9-4-9-9z', 'M8 8c1-2 3-3 4-3s3 1 4 3'] },
  salada: { label: 'Salada', paths: ['M5 19c0-8 5-14 15-14 0 10-6 15-14 15', 'M5 19l8-8'] },
  frango: { label: 'Frango', paths: ['M14 4a5.5 5.5 0 11-4.2 9l-4.3 4.3a2 2 0 11-2.8-2.8L7 10.2A5.5 5.5 0 0114 4z'] },
  carne: { label: 'Carne', paths: ['M5 9c0-3 4-5 8-4s7 4 6 8-5 6-9 5-5-5-5-9z', 'M11 10.5a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z'] },
  peixe: { label: 'Peixe', paths: ['M3 12c3-5 9-6 13-3l5-3v12l-5-3c-4 3-10 2-13-3z', 'M8 11h.01'] },
  cerveja: { label: 'Cerveja', paths: ['M6 7h10v13H6z', 'M16 10h3v6h-3', 'M6 7c0-2 2-3 4-2 1-1 4-1 5 2'] },
  cafe: { label: 'Café', paths: ['M4 9h12v6a4 4 0 01-4 4H8a4 4 0 01-4-4z', 'M16 10h2a2 2 0 010 4h-2', 'M8 3v3', 'M12 3v3'] },
  suco: { label: 'Suco', paths: ['M6 5h12l-1.5 15h-9z', 'M6.5 10h11', 'M12 3l2 2'] },
  refri: { label: 'Refrigerante', paths: ['M8 4h8v16H8z', 'M8 7h8', 'M8 17h8'] },
  churrasco: { label: 'Churrasco', paths: ['M3 21L21 3', 'M8 8l3-3 3 3-3 3z', 'M13 13l3-3 3 3-3 3z'] },
  wrap: { label: 'Wrap', paths: ['M4 15l9-9a3 3 0 014 4l-9 9z', 'M12 7l5 5'] },
  salgado: { label: 'Salgado', paths: ['M3 16a9 9 0 0118 0z', 'M6 16l1 3', 'M10 16l.5 3', 'M14 16l-.5 3', 'M18 16l-1 3'] },
  bolo: { label: 'Bolo', paths: ['M4 20h16', 'M5 20v-7h14v7', 'M5 16c3 2 5-2 7 0s4 2 7 0', 'M12 13V9', 'M12 6.5v.01'] },
  donut: { label: 'Donut', paths: ['M12 4a8 8 0 100 16 8 8 0 000-16z', 'M12 10a2 2 0 100 4 2 2 0 000-4z'] },
  milkshake: { label: 'Milkshake', paths: ['M7 9h10l-1.5 11h-7z', 'M6 9c0-2 2-3 3-3 .5-1.5 5-1.5 6 0 1 0 3 1 3 3', 'M14 6l2-3'] },
  promo: { label: 'Promoção', paths: ['M3 12l9-9h9v9l-9 9z', 'M16 8h.01'] },
  novo: { label: 'Novidade', paths: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'] },
  estrela: { label: 'Estrela', paths: ['M12 4l2.4 5 5.6.700-4.1 3.9 1 5.5L12 16.5 7.1 19.1l1-5.5L4 9.7 9.6 9z'] },
  fogo: { label: 'Fogo', paths: ['M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4 0-6 1-9z'] },
  kids: { label: 'Kids', paths: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M8 14c1 2 3 3 4 3s3-1 4-3', 'M9 10h.01', 'M15 10h.01'] },
  prato: { label: 'Prato', paths: ['M7 3v8', 'M5 3v5a2 2 0 004 0V3', 'M7 11v10', 'M17 3c-2 2-2 6 0 8v10'] },
}

export const SELECTABLE_ICONS = (Object.keys(CATEGORY_ICONS) as CategoryIconKey[]).filter((key) => key !== 'home')

export function isCategoryIconKey(value: unknown): value is CategoryIconKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_ICONS, value)
}

const AUTO_RULES: Array<[RegExp, CategoryIconKey]> = [
  [/^inicio$/, 'home'],
  [/combo/, 'combo'],
  [/kids|infantil|crianc/, 'kids'],
  [/hot ?dog|cachorro|lanche|sanduiche|sandu/, 'lanche'],
  [/pizza/, 'pizza'],
  [/acai/, 'acai'],
  [/salada|fit|vegano|vegetar/, 'salada'],
  [/milk ?shake|shake/, 'milkshake'],
  [/cerveja|chopp|chope/, 'cerveja'],
  [/cafe|capuccino|cappuccino/, 'cafe'],
  [/suco|vitamina/, 'suco'],
  [/refri|lata|soda|coca/, 'refri'],
  [/bebida|drink|agua|energetico/, 'drink'],
  [/bolo|torta/, 'bolo'],
  [/donut|rosquinha/, 'donut'],
  [/sobremesa|doce|sorvete|pudim|brownie/, 'sweet'],
  [/porc(ao|oes)|petisco|aperitivo/, 'porcao'],
  [/batata|fritas|acompanh|onion|anel/, 'fries'],
  [/frango|galeto|nugget|chicken|asa/, 'frango'],
  [/churrasc|espeto|grelha/, 'churrasco'],
  [/carne|steak|bife|picanha|costela/, 'carne'],
  [/peixe|camarao|frutos do mar|tilapia/, 'peixe'],
  [/tapioca|crepe|wrap|burrito|taco|shawarma|kebab/, 'wrap'],
  [/salgad|pastel|coxinha|empada|esfiha/, 'salgado'],
  [/promo|oferta|desconto/, 'promo'],
  [/novo|novidade|lancamento/, 'novo'],
  [/especial|quente|fogo|picante/, 'fogo'],
  [/smash|burg[u]?er|hamburg|artesanal|industrial|x-/, 'burger'],
]

function plain(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt')
    .trim()
}

export function autoIconForName(name: string): CategoryIconKey {
  const text = plain(name)
  for (const [pattern, key] of AUTO_RULES) {
    if (pattern.test(text)) return key
  }
  return 'prato'
}

export function iconForCategory(name: string, icon?: string): CategoryIconKey {
  return isCategoryIconKey(icon) ? icon : autoIconForName(name)
}

export function CategoryIcon({ iconKey, size = 20 }: { iconKey: CategoryIconKey; size?: number }) {
  return (
    <svg
      className="cat-icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {CATEGORY_ICONS[iconKey].paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
