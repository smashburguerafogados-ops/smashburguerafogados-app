import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { parsePrice } from './lib/adminCatalog'
import { sortCategories } from './lib/menu'
import { activeListeners, emit, firebaseMocks } from './test/mocks'
import { adminProfile, customerProfile, renderApp, signInAs } from './test/render'
import './index.css'
import './menu.css'

vi.mock('./lib/photo', () => ({
  readPhoto: vi.fn(async () => 'data:image/jpeg;base64,QUJD'),
}))

const categories = [
  { id: 'lanches', name: 'Lanches', order: 1, destaque: false },
  { id: 'promo', name: 'Promoções', order: 2, destaque: true },
]

async function openForm() {
  signInAs(adminProfile)
  const user = userEvent.setup()
  renderApp('/admin')
  await user.click(await screen.findByRole('button', { name: 'Abrir menu' }))
  await user.click(await screen.findByRole('button', { name: 'Criar Produto' }))
  await waitFor(() => expect(activeListeners('categories')).toHaveLength(1))
  await act(async () => {
    emit('categories', categories)
  })
  return { user, form: screen.getByRole('dialog', { name: 'Criar Produto' }) }
}

async function pickCategory(user: ReturnType<typeof userEvent.setup>, form: HTMLElement, name: string) {
  await user.click(within(form).getByRole('button', { name: 'Categoria' }))
  const list = within(form).getByRole('listbox', { name: 'Categoria' })
  await user.click(within(list).getByRole('option', { name }))
}

function lastAdd(path: string): Record<string, unknown> {
  const call = firebaseMocks.addDoc.mock.calls.filter(([ref]) => (ref as { path: string }).path === path).pop()
  if (!call) throw new Error(`no addDoc on ${path}`)
  return call[1] as Record<string, unknown>
}

describe('Criar Produto', () => {
  it('reads prices typed the Brazilian way', () => {
    expect(parsePrice('28')).toBe(28)
    expect(parsePrice('28,9')).toBe(28.9)
    expect(parsePrice('R$ 29,90')).toBe(29.9)
    expect(parsePrice('29.90')).toBe(29.9)
    expect(parsePrice('0')).toBeNull()
    expect(parsePrice('abc')).toBeNull()
    expect(parsePrice('1,234')).toBeNull()
  })

  it('offers camera and gallery for the photo', async () => {
    const { form } = await openForm()
    const camera = within(form).getByLabelText('Tirar foto com a câmera')
    const gallery = within(form).getByLabelText('Escolher foto da galeria')
    expect(camera).toHaveAttribute('type', 'file')
    expect(camera).toHaveAttribute('accept', 'image/*')
    expect(camera).toHaveAttribute('capture', 'environment')
    expect(gallery).toHaveAttribute('accept', 'image/*')
    expect(gallery).not.toHaveAttribute('capture')
  })

  it('is a full screen the admin can scroll', async () => {
    const { form } = await openForm()
    expect(form).toHaveClass('product-screen')
    expect(form.closest('.sheet, .popup')).toBeNull()
    const style = getComputedStyle(form)
    expect(style.position).toBe('fixed')
    expect(style.top).toBe('0px')
    expect(style.right).toBe('0px')
    expect(style.bottom).toBe('0px')
    expect(style.left).toBe('0px')
    expect(style.overflowY).toBe('auto')
    expect(style.maxHeight).toBe('none')
    expect(style.backgroundColor).toBe('rgb(0, 0, 0)')
    expect(Number(style.zIndex)).toBeGreaterThan(50)
    expect(form.querySelector('select')).toBeNull()
  })

  it('lists existing categories with destaque first and can create one', async () => {
    const { user, form } = await openForm()
    expect(form.querySelector('select')).toBeNull()
    await user.click(within(form).getByRole('button', { name: 'Categoria' }))
    const list = within(form).getByRole('listbox', { name: 'Categoria' })
    const listStyle = getComputedStyle(list)
    expect(listStyle.backgroundColor).toBe('rgb(0, 0, 0)')
    expect(listStyle.color).toBe('rgb(244, 245, 246)')
    const options = within(list).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Escolha uma categoria', 'Promoções (destaque)', 'Lanches', '+ Nova categoria'])

    await user.click(within(list).getByRole('option', { name: '+ Nova categoria' }))
    await user.type(within(form).getByRole('textbox', { name: 'Nova categoria' }), 'Bebidas')
    await user.click(within(form).getByRole('checkbox', { name: 'Destaque' }))
    await user.click(within(form).getByRole('button', { name: 'Criar categoria' }))

    expect(lastAdd('categories')).toMatchObject({ name: 'Bebidas', destaque: true, order: 3 })
  })

  it('toggles a category destaque tag and leaves delete to Produtos', async () => {
    const { user, form } = await openForm()
    await pickCategory(user, form, 'Lanches')
    await user.click(within(form).getByRole('checkbox', { name: 'Destaque' }))
    const [ref, patch] = firebaseMocks.updateDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>]
    expect(ref.path).toBe('categories/lanches')
    expect(patch).toEqual({ destaque: true })
    expect(within(form).queryByRole('button', { name: 'Excluir categoria' })).not.toBeInTheDocument()
    expect(firebaseMocks.deleteDoc).not.toHaveBeenCalled()
  })

  it('saves name, photo, category, valor, descrição and adicionais to Firestore', async () => {
    const { user, form } = await openForm()
    await user.type(within(form).getByRole('textbox', { name: 'Nome' }), 'Smash Bacon')
    await user.upload(
      within(form).getByLabelText('Escolher foto da galeria'),
      new File(['abc'], 'smash.jpg', { type: 'image/jpeg' }),
    )
    expect(await within(form).findByRole('img', { name: 'Prévia da foto' })).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,QUJD',
    )
    await pickCategory(user, form, 'Promoções (destaque)')
    await user.type(within(form).getByRole('textbox', { name: 'Valor (R$)' }), 'R$29,90x')
    await user.type(within(form).getByRole('textbox', { name: 'Descrição' }), 'Blend 90g, bacon e cheddar.')
    await user.click(within(form).getByRole('button', { name: '+ Adicional' }))
    await user.type(within(form).getByRole('textbox', { name: 'Adicional 1' }), 'Molho especial')
    await user.type(within(form).getByRole('textbox', { name: 'Valor do adicional 1' }), '3')
    await user.click(within(form).getByRole('button', { name: 'Salvar produto' }))

    expect(await within(form).findByRole('status')).toHaveTextContent('Smash Bacon salvo no cardápio.')
    expect(lastAdd('products')).toMatchObject({
      name: 'Smash Bacon',
      categoryId: 'promo',
      price: 29.9,
      description: 'Blend 90g, bacon e cheddar.',
      image: 'data:image/jpeg;base64,QUJD',
      extras: [{ id: 'extra-1', name: 'Molho especial', price: 3 }],
      available: true,
    })
  })

  it('refuses to save without a photo or a valid price', async () => {
    const { user, form } = await openForm()
    await user.type(within(form).getByRole('textbox', { name: 'Nome' }), 'X')
    await user.click(within(form).getByRole('button', { name: 'Salvar produto' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('Escolha uma foto.')
    expect(firebaseMocks.addDoc).not.toHaveBeenCalled()
  })

  it('is not offered to customers', async () => {
    signInAs(customerProfile)
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar Produto' })).not.toBeInTheDocument()
  })
})

describe('destaque categories on the menu', () => {
  it('sorts destaque first and pulses their border', async () => {
    expect(sortCategories(categories).map((category) => category.id)).toEqual(['promo', 'lanches'])

    firebaseMocks.getDocs.mockImplementation(async (ref: unknown) => {
      const path = (ref as { path: string }).path
      const docs =
        path === 'categories'
          ? categories
          : [
              { id: 'p1', categoryId: 'lanches', name: 'X-Salada', price: 20, available: true, description: '' },
              { id: 'p2', categoryId: 'promo', name: 'Combo do dia', price: 30, available: true, description: '' },
            ]
      return { docs: docs.map(({ id, ...data }) => ({ id, data: () => data })) }
    })
    renderApp()

    await screen.findByRole('button', { name: 'Promoções' })
    const chips = Array.from(document.querySelectorAll('.chips .chip')) as HTMLElement[]
    expect(chips.map((chip) => chip.textContent)).toEqual(['Promoções', 'Lanches'])
    expect(chips[0]).toHaveClass('chip--destaque')
    expect(getComputedStyle(chips[0]).animationName).toBe('destaque-pulse')
    expect(chips[1]).not.toHaveClass('chip--destaque')
    const names = Array.from(document.querySelectorAll('.items .item__name')).map((node) => node.textContent)
    expect(names).toEqual(['Combo do dia', 'X-Salada'])
  })
})
