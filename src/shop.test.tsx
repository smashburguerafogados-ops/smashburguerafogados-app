import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CLOSED_MESSAGE } from './lib/shop'
import { activeListeners, emit, emitDoc, firebaseMocks } from './test/mocks'
import { adminProfile, renderApp, signInAs } from './test/render'
import './index.css'
import './menu.css'

const products = [{ id: 'smash', name: 'Smash da casa', categoryId: 'lanches', price: 28, available: true }]
const categories = [
  { id: 'lanches', name: 'Lanches', order: 1, destaque: false },
  { id: 'bebidas', name: 'Bebidas', order: 2, destaque: false },
]

async function openDesk() {
  signInAs(adminProfile)
  const user = userEvent.setup()
  renderApp('/admin')
  await user.click(await screen.findByRole('button', { name: 'Abrir menu' }))
  await user.click(screen.getByRole('button', { name: 'Produtos' }))
  const desk = await screen.findByRole('dialog', { name: 'Produtos' })
  await waitFor(() => expect(activeListeners('products')).toHaveLength(1))
  await act(async () => {
    emit('products', products)
    emit('categories', categories)
  })
  return { user, desk }
}

describe('Produtos', () => {
  it('saves a new price', async () => {
    const { user, desk } = await openDesk()
    const price = within(desk).getByRole('textbox', { name: 'Valor de Smash da casa' })
    expect(price).toHaveValue('28,00')
    await user.clear(price)
    await user.type(price, '32,50')
    await user.click(within(desk).getByRole('button', { name: 'Salvar Smash da casa' }))
    expect(firebaseMocks.updateDoc).toHaveBeenCalledWith({ path: 'products/smash' }, { price: 32.5 })
  })

  it('marks a product esgotado', async () => {
    const { user, desk } = await openDesk()
    await user.click(within(desk).getByRole('button', { name: 'Marcar Smash da casa esgotado' }))
    expect(firebaseMocks.updateDoc).toHaveBeenCalledWith({ path: 'products/smash' }, { available: false })
  })

  it('asks before deleting a product', async () => {
    const { user, desk } = await openDesk()
    await user.click(within(desk).getByRole('button', { name: 'Excluir Smash da casa' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Confirmar exclusão' })
    expect(confirm).toHaveTextContent('Excluir Smash da casa?')
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }))
    expect(firebaseMocks.deleteDoc).not.toHaveBeenCalled()

    await user.click(within(desk).getByRole('button', { name: 'Excluir Smash da casa' }))
    await user.click(within(screen.getByRole('alertdialog', { name: 'Confirmar exclusão' })).getByRole('button', { name: 'Excluir' }))
    expect(firebaseMocks.deleteDoc).toHaveBeenCalledWith({ path: 'products/smash' })
  })

  it('asks before deleting a category and blocks the delete while products use it', async () => {
    firebaseMocks.getDocs.mockImplementation(async (ref: unknown) => {
      const constraints = (ref as { constraints?: { value?: string }[] }).constraints
      if (constraints?.some((constraint) => constraint.value === 'lanches')) {
        return { empty: false, docs: [{ id: 'smash' }] }
      }
      return { empty: true, docs: [] }
    })
    const { user, desk } = await openDesk()

    await user.click(within(desk).getByRole('button', { name: 'Excluir categoria Lanches' }))
    await user.click(within(screen.getByRole('alertdialog', { name: 'Confirmar exclusão' })).getByRole('button', { name: 'Excluir' }))
    expect(await within(desk).findByRole('alert')).toHaveTextContent(
      'Esta categoria ainda tem produtos. Exclua esses produtos antes.',
    )
    expect(firebaseMocks.deleteDoc).not.toHaveBeenCalled()

    await user.click(within(desk).getByRole('button', { name: 'Excluir categoria Bebidas' }))
    await user.click(within(screen.getByRole('alertdialog', { name: 'Confirmar exclusão' })).getByRole('button', { name: 'Excluir' }))
    expect(firebaseMocks.deleteDoc).toHaveBeenCalledWith({ path: 'categories/bebidas' })
  })
})

async function openShop() {
  signInAs(adminProfile)
  const user = userEvent.setup()
  renderApp('/admin')
  await screen.findByRole('heading', { name: 'Painel' })
  expect(screen.queryByRole('switch', { name: 'Online' })).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Mensagem de fechado' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Salvar mensagem' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
  await user.click(screen.getByRole('button', { name: 'Funcionamento' }))
  const sheet = await screen.findByRole('dialog', { name: 'Funcionamento' })
  await waitFor(() => expect(activeListeners('settings/shop')).toHaveLength(1))
  return { user, sheet }
}

describe('shop hours', () => {
  it('opens Online and the closed message from the hamburger, not the painel', async () => {
    const { user, sheet } = await openShop()
    await act(async () => {
      emitDoc('settings/shop', { online: true, message: DEFAULT_CLOSED_MESSAGE })
    })

    const toggle = within(sheet).getByRole('switch', { name: 'Online' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await user.click(toggle)
    expect(firebaseMocks.setDoc).toHaveBeenCalledWith(
      { path: 'settings/shop' },
      { online: false, message: DEFAULT_CLOSED_MESSAGE },
      { merge: true },
    )

    const message = within(sheet).getByRole('textbox', { name: 'Mensagem de fechado' })
    await user.clear(message)
    await user.type(message, 'Hoje fechado. Abrimos sexta, das 18h às 23h.')
    await user.click(within(sheet).getByRole('button', { name: 'Salvar mensagem' }))
    expect(firebaseMocks.setDoc).toHaveBeenLastCalledWith(
      { path: 'settings/shop' },
      { online: false, message: 'Hoje fechado. Abrimos sexta, das 18h às 23h.' },
      { merge: true },
    )
  })

  it('keeps a customer on the opening screen when the shop is offline', async () => {
    renderApp()
    await waitFor(() => expect(activeListeners('settings/shop')).toHaveLength(1))
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()

    await act(async () => {
      emitDoc('settings/shop', { online: false, message: '' })
    })

    expect(screen.getByText(DEFAULT_CLOSED_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Smash Burger' })).toBeInTheDocument()
    expect(document.querySelector('video.fire__video')).toHaveAttribute('src', expect.stringContaining('fire.mp4'))
    expect(screen.queryByRole('searchbox', { name: 'Buscar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /carrinho/i })).not.toBeInTheDocument()
  })

  it('stays open when the shop listener fails', async () => {
    renderApp()
    await waitFor(() => expect(activeListeners('settings/shop')).toHaveLength(1))
    const [listener] = activeListeners('settings/shop')
    await act(async () => {
      listener.error?.(new Error('permission'))
    })
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('lets a signed-in admin keep the menu while the shop is offline', async () => {
    signInAs(adminProfile)
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    await waitFor(() => expect(activeListeners('settings/shop')).toHaveLength(1))
    await act(async () => {
      emitDoc('settings/shop', { online: false, message: 'Fechado hoje.' })
    })
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
    expect(screen.queryByText('Fechado hoje.')).not.toBeInTheDocument()
  })

  it('keeps the admin panel available while the shop is offline', async () => {
    const { sheet } = await openShop()
    await act(async () => {
      emitDoc('settings/shop', { online: false, message: 'Fechado hoje.' })
    })
    expect(screen.getByRole('heading', { name: 'Painel' })).toBeInTheDocument()
    expect(within(sheet).getByRole('switch', { name: 'Online' })).toHaveAttribute('aria-checked', 'false')
  })
})
