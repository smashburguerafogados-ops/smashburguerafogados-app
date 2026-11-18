import { collection, getDocs, query, where } from 'firebase/firestore'
import { seedCatalog, type Catalog, type Category, type Extra, type Product } from '../data/catalog'
import { db } from './firebase'
import { sortCategories } from './menu'

function asExtra(value: unknown): Extra | null {
  if (!value || typeof value !== 'object') return null
  const extra = value as Record<string, unknown>
  if (typeof extra.id !== 'string' || typeof extra.name !== 'string' || typeof extra.price !== 'number') {
    return null
  }
  return { id: extra.id, name: extra.name, price: extra.price }
}

export async function loadRemoteCatalog(): Promise<Catalog | null> {
  try {
    const [categoriesSnap, productsSnap] = await Promise.all([
      getDocs(collection(db, 'categories')),
      getDocs(query(collection(db, 'products'), where('available', '==', true))),
    ])

    const categories: Category[] = []
    categoriesSnap.docs.forEach((entry) => {
      const data = entry.data() as Record<string, unknown>
      if (typeof data.name !== 'string') return
      categories.push({
        id: entry.id,
        name: data.name,
        order: typeof data.order === 'number' ? data.order : 0,
        destaque: data.destaque === true,
      })
    })

    const products: Product[] = []
    productsSnap.docs.forEach((entry) => {
      const data = entry.data() as Record<string, unknown>
      if (typeof data.name !== 'string' || typeof data.categoryId !== 'string' || typeof data.price !== 'number') {
        return
      }
      const extras = Array.isArray(data.extras)
        ? data.extras.map(asExtra).filter((item): item is Extra => item !== null)
        : []
      products.push({
        id: entry.id,
        categoryId: data.categoryId,
        name: data.name,
        description: typeof data.description === 'string' ? data.description : '',
        price: data.price,
        image:
          typeof data.image === 'string' && data.image.length > 0
            ? data.image
            : seedCatalog.products[0].image,
        available: data.available !== false,
        extras: extras.length > 0 ? extras : undefined,
      })
    })

    if (categories.length === 0 && products.length === 0) return null
    return { categories: sortCategories(categories), products }
  } catch {
    return null
  }
}
