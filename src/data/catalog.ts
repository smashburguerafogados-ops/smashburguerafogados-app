export type Extra = {
  id: string
  name: string
  price: number
}

export type Category = {
  id: string
  name: string
  order: number
  destaque?: boolean
}

export type Product = {
  id: string
  categoryId: string
  name: string
  description: string
  price: number
  image: string
  available: boolean
  extras?: Extra[]
}

export type Catalog = {
  categories: Category[]
  products: Product[]
}

function image(file: string): string {
  return `${import.meta.env.BASE_URL}menu/${file}`
}

export const seedCatalog: Catalog = {
  categories: [
    { id: 'smash', name: 'Smash', order: 1 },
    { id: 'sides', name: 'Acompanhamentos', order: 2 },
    { id: 'drinks', name: 'Bebidas', order: 3 },
  ],
  products: [
    {
      id: 'smash-casa',
      categoryId: 'smash',
      name: 'Smash da casa',
      description: 'Pão brioche, blend 80g, queijo cheddar e molho da casa.',
      price: 28,
      image: image('smash.svg'),
      available: true,
      extras: [
        { id: 'cheddar', name: 'Cheddar', price: 4 },
        { id: 'bacon', name: 'Bacon', price: 5 },
      ],
    },
    {
      id: 'smash-duplo',
      categoryId: 'smash',
      name: 'Smash duplo',
      description: 'Dois blends 80g, cheddar duplo e pão brioche.',
      price: 36,
      image: image('double.svg'),
      available: true,
    },
    {
      id: 'smash-picante',
      categoryId: 'smash',
      name: 'Smash picante',
      description: 'Blend com pimenta e jalapeño.',
      price: 32,
      image: image('spicy.svg'),
      available: false,
    },
    {
      id: 'batata',
      categoryId: 'sides',
      name: 'Batata rústica',
      description: 'Batatas com casca, sal e alecrim.',
      price: 16,
      image: image('fries.svg'),
      available: true,
    },
    {
      id: 'aneis',
      categoryId: 'sides',
      name: 'Anéis de cebola',
      description: 'Anéis empanados e crocantes.',
      price: 14,
      image: image('onion.svg'),
      available: true,
    },
    {
      id: 'lata',
      categoryId: 'drinks',
      name: 'Refrigerante lata',
      description: 'Lata 350ml.',
      price: 8,
      image: image('soda.svg'),
      available: true,
    },
    {
      id: 'suco',
      categoryId: 'drinks',
      name: 'Suco da casa',
      description: 'Copo 300ml, feito na hora.',
      price: 10,
      image: image('juice.svg'),
      available: true,
    },
  ],
}
