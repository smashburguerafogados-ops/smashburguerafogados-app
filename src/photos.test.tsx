import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  hasInlinePhoto,
  movePhotosBack,
  movePhotosOut,
  photoRulesPublished,
  type ListedProduct,
} from './lib/adminCatalog'
import { publicImage } from './lib/orders'
import { encodeCanvas, MAX_SIDE } from './lib/photo'
import { FALLBACK_IMAGE, PHOTO_PLACEHOLDER, parsePhotoRef, photoRef } from './lib/productPhotos'
import { activeListeners, emit, firebaseMocks, type FakeDoc } from './test/mocks'
import { adminProfile, renderApp, signInAs } from './test/render'

const INLINE = 'data:image/jpeg;base64,QUJD'
const SEPARATE = 'data:image/webp;base64,Tk9WQQ'
const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' })

const categories = [{ id: 'lanches', name: 'Lanches', order: 1 }]
const legacy: FakeDoc = { id: 'velho', name: 'Smash antigo', categoryId: 'lanches', price: 25, available: true, description: '', image: INLINE }
const moved: FakeDoc = { id: 'novo', name: 'Smash novo', categoryId: 'lanches', price: 30, available: true, description: '', photoVersion: 1700 }

function photoDocs(store: Record<string, string>, options: { deny?: boolean } = {}) {
  firebaseMocks.getDoc.mockImplementation(async (ref: unknown) => {
    const path = (ref as { path: string }).path
    if (options.deny && path.startsWith('productPhotos/')) throw denied()
    const image = store[path]
    return { exists: () => image !== undefined, data: () => (image === undefined ? undefined : { image }) }
  })
}

function showMenu(products: FakeDoc[]) {
  renderApp('/?x')
  act(() => {
    emit('categories', categories)
    emit('products', products)
  })
}

function cardImage(name: string): HTMLImageElement {
  const card = screen.getByRole('button', { name: new RegExp(name) })
  return card.querySelector('img') as HTMLImageElement
}

afterEach(() => {
  Reflect.deleteProperty(window, 'IntersectionObserver')
})

describe('fotos fora do produto', () => {
  it('turns photoVersion into a reference and keeps inline photos as they are', () => {
    expect(photoRef('abc', 17)).toBe('photo:abc@17')
    expect(parsePhotoRef('photo:abc@17')).toEqual({ id: 'abc', version: 17 })
    expect(parsePhotoRef(INLINE)).toBeNull()
    expect(publicImage('photo:abc@17')).toBe('')
  })

  it('shows names and prices first and the photo when it arrives', async () => {
    let answer: (value: unknown) => void = () => undefined
    firebaseMocks.getDoc.mockImplementation(
      (ref: unknown) =>
        new Promise((resolve) => {
          if ((ref as { path: string }).path === 'productPhotos/novo') answer = resolve
          else resolve({ exists: () => false, data: () => undefined })
        }),
    )
    showMenu([moved])
    expect(screen.getByRole('button', { name: /Smash novo/ })).toHaveTextContent('R$ 30,00')
    const img = cardImage('Smash novo')
    expect(img).toHaveAttribute('src', PHOTO_PLACEHOLDER)
    expect(img).toHaveClass('is-loading')
    await waitFor(() =>
      expect(firebaseMocks.getDoc.mock.calls.some(([ref]) => (ref as { path: string }).path === 'productPhotos/novo')).toBe(true),
    )
    await act(async () => {
      answer({ exists: () => true, data: () => ({ image: SEPARATE }) })
    })
    await waitFor(() => expect(cardImage('Smash novo')).toHaveAttribute('src', SEPARATE))
    expect(cardImage('Smash novo')).not.toHaveClass('is-loading')
  })

  it('reads a photo only when its card comes near the screen', async () => {
    const observed: Array<{ cb: IntersectionObserverCallback; el: Element }> = []
    class FakeObserver {
      constructor(private cb: IntersectionObserverCallback) {}
      observe(el: Element) {
        observed.push({ cb: this.cb, el })
      }
      disconnect() {}
    }
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: FakeObserver })
    photoDocs({ 'productPhotos/novo': SEPARATE })
    showMenu([moved])
    expect(firebaseMocks.getDoc.mock.calls.some(([ref]) => (ref as { path: string }).path === 'productPhotos/novo')).toBe(false)
    const entry = observed.find((item) => item.el === cardImage('Smash novo'))
    expect(entry).toBeDefined()
    await act(async () => {
      entry!.cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    await waitFor(() => expect(cardImage('Smash novo')).toHaveAttribute('src', SEPARATE))
  })

  it('keeps legacy products with the photo inside working, with no extra read', () => {
    photoDocs({})
    showMenu([legacy])
    expect(cardImage('Smash antigo')).toHaveAttribute('src', INLINE)
    expect(firebaseMocks.getDoc.mock.calls.some(([ref]) => (ref as { path: string }).path.startsWith('productPhotos/'))).toBe(false)
  })

  it('falls back to the default image when the photo cannot be read (rules not published)', async () => {
    photoDocs({}, { deny: true })
    showMenu([moved, legacy])
    await waitFor(() => expect(cardImage('Smash novo')).toHaveAttribute('src', FALLBACK_IMAGE))
    expect(cardImage('Smash antigo')).toHaveAttribute('src', INLINE)
  })

  it('opens the product with its photo and puts it in the cart thumbnail', async () => {
    photoDocs({ 'productPhotos/novo': SEPARATE })
    const user = userEvent.setup()
    showMenu([moved])
    await user.click(screen.getByRole('button', { name: /Smash novo/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Smash novo' })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /Ampliar foto/ }).querySelector('img')).toHaveAttribute('src', SEPARATE))
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }))
    await user.click(screen.getByRole('button', { name: 'Ir ao carrinho' }))
    const cart = await screen.findByRole('dialog', { name: 'Carrinho' })
    expect(cart.querySelector('img.cart__thumb')).toHaveAttribute('src', SEPARATE)
  })
})

describe('admin: fotos', () => {
  const listed = (overrides: Partial<ListedProduct>): ListedProduct => ({
    id: 'p',
    name: 'P',
    categoryId: 'lanches',
    price: 10,
    available: true,
    description: '',
    image: INLINE,
    extras: [],
    ...overrides,
  })

  it('tells whether the new rules are published', async () => {
    firebaseMocks.getDoc.mockRejectedValueOnce(denied())
    expect(await photoRulesPublished()).toBe(false)
    firebaseMocks.getDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined })
    expect(await photoRulesPublished()).toBe(true)
  })

  it('moves inline photos with a backup, checks the copy, and can run again', async () => {
    const store: Record<string, string> = {}
    firebaseMocks.setDoc.mockImplementation(async (ref: unknown, data: unknown) => {
      store[(ref as { path: string }).path] = (data as { image: string }).image
    })
    photoDocs(store)
    const products = [listed({ id: 'a', name: 'A' }), listed({ id: 'b', name: 'B', image: photoRef('b', 5) }), listed({ id: 'c', name: 'C', image: 'https://x/c.jpg' })]
    const steps: string[] = []
    const result = await movePhotosOut(products, (done, total) => steps.push(`${done}/${total}`), () => 42)

    expect(result).toEqual({ done: 1, failed: [] })
    expect(steps).toEqual(['1/1'])
    expect(store['productPhotoBackups/a']).toBe(INLINE)
    expect(store['productPhotos/a']).toBe(INLINE)
    expect(firebaseMocks.updateDoc).toHaveBeenCalledTimes(1)
    expect(firebaseMocks.updateDoc).toHaveBeenCalledWith({ path: 'products/a' }, { photoVersion: 42, image: 'DELETE_FIELD' })
    expect(hasInlinePhoto(products[2])).toBe(false)
  })

  it('leaves the product untouched when the copy does not match or the write is refused', async () => {
    firebaseMocks.setDoc.mockImplementation(async (ref: unknown) => {
      if ((ref as { path: string }).path === 'productPhotoBackups/b') throw denied()
    })
    photoDocs({ 'productPhotos/a': 'data:image/jpeg;base64,b3V0cmE' })
    const result = await movePhotosOut([listed({ id: 'a', name: 'A' }), listed({ id: 'b', name: 'B' })])
    expect(result).toEqual({ done: 0, failed: ['A', 'B'] })
    expect(firebaseMocks.updateDoc).not.toHaveBeenCalled()
  })

  it('undoes the move, using the backup when the photo document is gone', async () => {
    photoDocs({ 'productPhotos/a': SEPARATE, 'productPhotoBackups/b': INLINE })
    const result = await movePhotosBack([
      listed({ id: 'a', name: 'A', image: photoRef('a', 1) }),
      listed({ id: 'b', name: 'B', image: photoRef('b', 1) }),
      listed({ id: 'c', name: 'C', image: photoRef('c', 1) }),
      listed({ id: 'd', name: 'D' }),
    ])
    expect(result).toEqual({ done: 2, failed: ['C'] })
    expect(firebaseMocks.updateDoc).toHaveBeenCalledWith({ path: 'products/a' }, { image: SEPARATE, photoVersion: 'DELETE_FIELD' })
    expect(firebaseMocks.updateDoc).toHaveBeenCalledWith({ path: 'products/b' }, { image: INLINE, photoVersion: 'DELETE_FIELD' })
    expect(firebaseMocks.updateDoc).toHaveBeenCalledTimes(2)
  })

  it('offers the move in Produtos and refuses it while the rules are not published', async () => {
    signInAs(adminProfile)
    const user = userEvent.setup()
    renderApp('/admin')
    await user.click(await screen.findByRole('button', { name: 'Abrir menu' }))
    await user.click(screen.getByRole('button', { name: 'Produtos' }))
    const desk = await screen.findByRole('dialog', { name: 'Produtos' })
    await waitFor(() => expect(activeListeners('products')).toHaveLength(1))
    await act(async () => {
      emit('products', [legacy, moved])
    })
    const section = within(desk).getByRole('region', { name: 'Fotos do cardápio' })
    expect(section).toHaveTextContent('1 foto ainda está dentro dos produtos')
    firebaseMocks.getDoc.mockRejectedValue(denied())
    await user.click(within(section).getByRole('button', { name: 'Mover 1 foto' }))
    await user.click(within(screen.getByRole('alertdialog', { name: 'Confirmar fotos' })).getByRole('button', { name: 'Mover' }))
    expect(await within(section).findByRole('alert')).toHaveTextContent('ainda não foram publicadas. Nada foi alterado.')
    expect(firebaseMocks.setDoc).not.toHaveBeenCalled()
    expect(firebaseMocks.updateDoc).not.toHaveBeenCalled()
  })

  it('does not rewrite an unchanged photo and deletes the photo document with the product', async () => {
    const { updateProduct, deleteProduct } = await import('./lib/adminCatalog')
    const draft = { name: 'X', categoryId: 'lanches', price: 10, description: '', image: photoRef('x', 3), extras: [], available: true }
    await updateProduct('x', draft, photoRef('x', 3))
    expect(firebaseMocks.updateDoc).toHaveBeenCalledWith({ path: 'products/x' }, { name: 'X', categoryId: 'lanches', price: 10, description: '', extras: [], available: true })
    expect(firebaseMocks.setDoc).not.toHaveBeenCalled()

    await deleteProduct('x', photoRef('x', 3))
    expect(firebaseMocks.deleteDoc).toHaveBeenCalledWith({ path: 'products/x' })
    expect(firebaseMocks.deleteDoc).toHaveBeenCalledWith({ path: 'productPhotos/x' })
  })
})

describe('compressão da foto', () => {
  function fakeCanvas(webp: boolean) {
    const toDataURL = vi.fn((type: string) => (type === 'image/webp' && webp ? 'data:image/webp;base64,V0VCUA' : type === 'image/jpeg' ? 'data:image/jpeg;base64,SlBFRw' : 'data:image/png;base64,UE5H'))
    return { canvas: { toDataURL } as unknown as HTMLCanvasElement, toDataURL }
  }

  it('uses WebP where the browser encodes it and JPEG otherwise, at a smaller size', () => {
    expect(MAX_SIDE).toBeLessThanOrEqual(560)
    expect(encodeCanvas(fakeCanvas(true).canvas)).toMatch(/^data:image\/webp/)
    const old = fakeCanvas(false)
    expect(encodeCanvas(old.canvas)).toMatch(/^data:image\/jpeg/)
    expect(old.toDataURL).toHaveBeenLastCalledWith('image/jpeg', 0.7)
  })
})
