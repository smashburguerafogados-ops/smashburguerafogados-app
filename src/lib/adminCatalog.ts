import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { Category, Extra } from '../data/catalog'
import { db } from './firebase'
import { sortCategories } from './menu'

export function watchCategories(onNext: (categories: Category[]) => void, onError: () => void): () => void {
  return onSnapshot(
    collection(db, 'categories'),
    (snapshot) => {
      const categories: Category[] = []
      snapshot.docs.forEach((entry) => {
        const data = entry.data() as Record<string, unknown>
        if (typeof data.name !== 'string') return
        categories.push({
          id: entry.id,
          name: data.name,
          order: typeof data.order === 'number' ? data.order : 0,
          destaque: data.destaque === true,
        })
      })
      onNext(sortCategories(categories))
    },
    () => onError(),
  )
}

export async function createCategory(name: string, destaque: boolean, order: number): Promise<string> {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (!clean) throw new Error('Informe o nome da categoria.')
  const ref = await addDoc(collection(db, 'categories'), {
    name: clean,
    destaque,
    order,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function setCategoryDestaque(id: string, destaque: boolean): Promise<void> {
  await updateDoc(doc(db, 'categories', id), { destaque })
}

export async function deleteCategory(id: string): Promise<void> {
  const using = await getDocs(query(collection(db, 'products'), where('categoryId', '==', id)))
  if (!using.empty) {
    throw new Error('Esta categoria ainda tem produtos. Exclua esses produtos antes.')
  }
  await deleteDoc(doc(db, 'categories', id))
}

export type ListedProduct = {
  id: string
  name: string
  categoryId: string
  price: number
  available: boolean
}

export function watchProducts(onNext: (products: ListedProduct[]) => void, onError: () => void): () => void {
  return onSnapshot(
    collection(db, 'products'),
    (snapshot) => {
      const products: ListedProduct[] = []
      snapshot.docs.forEach((entry) => {
        const data = entry.data() as Record<string, unknown>
        if (typeof data.name !== 'string') return
        products.push({
          id: entry.id,
          name: data.name,
          categoryId: typeof data.categoryId === 'string' ? data.categoryId : '',
          price: typeof data.price === 'number' ? data.price : 0,
          available: data.available !== false,
        })
      })
      products.sort((a, b) => a.name.localeCompare(b.name, 'pt'))
      onNext(products)
    },
    () => onError(),
  )
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, 'products', id))
}

export async function setProductPrice(id: string, price: number): Promise<void> {
  if (!(price > 0)) throw new Error('Informe um valor válido.')
  await updateDoc(doc(db, 'products', id), { price })
}

export async function setProductAvailable(id: string, available: boolean): Promise<void> {
  await updateDoc(doc(db, 'products', id), { available })
}

export type NewProduct = {
  name: string
  categoryId: string
  price: number
  description: string
  image: string
  extras: Extra[]
}

/** Accepts "28", "28,5" or "28.50" and returns reais, or null when it is not a price. */
export function parsePrice(input: string): number | null {
  const clean = input.trim().replace(/\s/g, '').replace(/^R\$/i, '')
  if (!/^\d{1,5}([.,]\d{1,2})?$/.test(clean)) return null
  const value = Number(clean.replace(',', '.'))
  return value > 0 ? value : null
}

export async function createProduct(product: NewProduct): Promise<string> {
  if (!product.name.trim()) throw new Error('Informe o nome do produto.')
  if (!product.categoryId) throw new Error('Escolha uma categoria.')
  if (!(product.price > 0)) throw new Error('Informe um valor válido.')
  const ref = await addDoc(collection(db, 'products'), {
    name: product.name.trim(),
    categoryId: product.categoryId,
    price: product.price,
    description: product.description.trim(),
    image: product.image,
    extras: product.extras,
    available: true,
    createdAt: serverTimestamp(),
  })
  return ref.id
}
