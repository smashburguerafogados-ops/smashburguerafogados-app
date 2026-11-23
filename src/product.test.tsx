import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { parsePrice } from './lib/adminCatalog'
import { sortCategories } from './lib/menu'
import { activeListeners, emit, emitDoc, firebaseMocks } from './test/mocks'
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

function lastSet(path: string): Record<string, unknown> {
  const call = firebaseMocks.setDoc.mock.calls.filter(([ref]) => (ref as { path: string }).path === path).pop()
  if (!call) throw new Error(`no setDoc on ${path}`)
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

  it('lists existing categories and does not create one from the product', async () => {
    const { user, form } = await openForm()
    expect(form.querySelector('select')).toBeNull()
    await user.click(within(form).getByRole('button', { name: 'Categoria' }))
    const list = within(form).getByRole('listbox', { name: 'Categoria' })
    const listStyle = getComputedStyle(list)
    expect(listStyle.backgroundColor).toBe('rgb(0, 0, 0)')
    expect(listStyle.color).toBe('rgb(244, 245, 246)')
    const options = within(list).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Escolha uma categoria', 'Promoções (destaque)', 'Lanches'])
    expect(within(form).queryByRole('button', { name: '+ Adicional' })).not.toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: 'Criar categoria' })).not.toBeInTheDocument()
    expect(options).not.toContain('Início')
  })

  it('saves a product that selects an existing category and add-on', async () => {
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
    const price = within(form).getByRole('textbox', { name: 'Valor (R$)' })
    await user.type(price, '2')
    expect(price).toHaveValue('0,02')
    await user.type(price, '99')
    expect(price).toHaveValue('2,99')
    await user.clear(price)
    await user.type(price, 'R$29,90x')
    expect(price).toHaveValue('29,90')
    await user.type(within(form).getByRole('textbox', { name: 'Descrição' }), 'Blend 90g, bacon e cheddar.')
    await waitFor(() => expect(activeListeners('addons')).toHaveLength(1))
    await act(async () => {
      emit('addons', [{ id: 'addon-bacon', name: 'Bacon', price: 4 }])
    })
    await user.click(within(form).getByRole('checkbox', { name: 'Bacon · R$ 4,00' }))
    await user.click(within(form).getByRole('button', { name: 'Salvar produto' }))

    expect(await within(form).findByRole('status')).toHaveTextContent('Smash Bacon salvo no cardápio.')
    expect(lastSet('productPhotos/novo-produto')).toEqual({
      image: 'data:image/jpeg;base64,QUJD',
      updatedAtMs: expect.any(Number),
    })
    const saved = lastSet('products/novo-produto')
    expect(saved).toMatchObject({
      name: 'Smash Bacon',
      categoryId: 'promo',
      price: 29.9,
      description: 'Blend 90g, bacon e cheddar.',
      photoVersion: lastSet('productPhotos/novo-produto').updatedAtMs,
      extras: [{ id: 'addon-bacon', name: 'Bacon', price: 4 }],
      available: true,
    })
    expect(saved).not.toHaveProperty('image')
    expect(firebaseMocks.addDoc.mock.calls.filter(([ref]) => (ref as { path: string }).path === 'products')).toHaveLength(0)
  })

  it('keeps the photo inside the product while the new rules are not published', async () => {
    firebaseMocks.setDoc.mockImplementation(async (ref: unknown) => {
      if ((ref as { path: string }).path.startsWith('productPhotos/')) {
        throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' })
      }
    })
    const { user, form } = await openForm()
    await user.type(within(form).getByRole('textbox', { name: 'Nome' }), 'Smash Bacon')
    await user.upload(
      within(form).getByLabelText('Escolher foto da galeria'),
      new File(['abc'], 'smash.jpg', { type: 'image/jpeg' }),
    )
    await pickCategory(user, form, 'Lanches')
    await user.type(within(form).getByRole('textbox', { name: 'Valor (R$)' }), '2990')
    await user.click(within(form).getByRole('button', { name: 'Salvar produto' }))

    expect(await within(form).findByRole('status')).toHaveTextContent('Smash Bacon salvo no cardápio.')
    const saved = lastSet('products/novo-produto')
    expect(saved).toMatchObject({ name: 'Smash Bacon', image: 'data:image/jpeg;base64,QUJD', available: true })
    expect(saved).not.toHaveProperty('photoVersion')
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

    renderApp()
    await act(async () => {
      emit('categories', categories)
      emit('products', [
        { id: 'p1', categoryId: 'lanches', name: 'X-Salada', price: 20, available: true, description: '' },
        { id: 'p2', categoryId: 'promo', name: 'Combo do dia', price: 30, available: true, description: '' },
      ])
    })

    await screen.findByRole('button', { name: 'Promoções' })
    const chips = Array.from(document.querySelectorAll('.chips .chip')) as HTMLElement[]
    expect(chips.map((chip) => chip.textContent)).toEqual(['Início', 'Promoções', 'Lanches'])
    expect(chips[0]).not.toHaveClass('chip--destaque')
    expect(chips[0]).toHaveClass('is-active')
    expect(chips[1]).toHaveClass('chip--destaque')
    const lit = getComputedStyle(chips[1])
    expect(lit.animationName).toBe('destaque-pulse')
    expect(lit.borderTopWidth).toBe('2px')
    expect(lit.borderTopColor).toBe('rgb(227, 177, 90)')
    expect(lit.boxShadow).toContain('rgba(227, 177, 90, 0.55)')
    const sun = chips[1].querySelector('.chip__sun') as HTMLElement
    expect(sun).not.toBeNull()
    const sunStyle = getComputedStyle(sun)
    expect(sunStyle.animationName).toBe('chip-sun')
    expect(sunStyle.borderRadius).toBe('50%')
    expect(sunStyle.backgroundImage).toContain('radial-gradient')
    expect(chips[0].querySelector('.chip__sun')).toBeNull()
    expect(chips[2].querySelector('.chip__sun')).toBeNull()
    expect(chips[2]).not.toHaveClass('chip--destaque')
    expect(getComputedStyle(chips[2]).borderTopWidth).not.toBe('2px')
    const names = Array.from(document.querySelectorAll('.items .item__name')).map((node) => node.textContent)
    expect(names).toEqual(['Combo do dia', 'X-Salada'])
  })

  it('fills the selected category with solid gold and leaves the others outlined', async () => {
    document.documentElement.dataset.theme = 'pascoa'
    const user = userEvent.setup()
    renderApp()
    await act(async () => {
      emit('categories', [
        { id: 'lanches', name: 'Lanches', order: 1, destaque: false },
        { id: 'promo', name: 'Promoções', order: 2, destaque: true },
        { id: 'bebidas', name: 'Bebidas', order: 3, destaque: true },
      ])
      emit('products', [
        { id: 'p1', categoryId: 'lanches', name: 'X-Salada', price: 20, available: true, description: '' },
        { id: 'p2', categoryId: 'promo', name: 'Combo do dia', price: 30, available: true, description: '' },
      ])
    })

    const plain = await screen.findByRole('button', { name: 'Lanches' })
    const idle = screen.getByRole('button', { name: 'Bebidas' })
    expect(getComputedStyle(idle).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(idle).backgroundImage).toBe('none')
    await user.click(plain)
    expect(plain).toHaveClass('is-active')
    expect(plain).not.toHaveClass('chip--destaque')
    expect(getComputedStyle(plain).backgroundColor).toBe('rgb(227, 177, 90)')
    expect(getComputedStyle(plain).backgroundImage).toBe('none')

    const featured = screen.getByRole('button', { name: 'Promoções' })
    await user.click(featured)
    expect(featured).toHaveClass('is-active')
    expect(featured).toHaveClass('chip--destaque')
    expect(getComputedStyle(featured).backgroundColor).toBe('rgb(227, 177, 90)')
    delete document.documentElement.dataset.theme
  })
})

async function openAdminScreen(label: string) {
  signInAs(adminProfile)
  const user = userEvent.setup()
  renderApp('/admin')
  await user.click(await screen.findByRole('button', { name: 'Abrir menu' }))
  await user.click(screen.getByRole('button', { name: label }))
  const dialog = await screen.findByRole('dialog', { name: label })
  return { user, dialog }
}

describe('Categorias', () => {
  it('creates, renames, highlights and deletes a category outside the product', async () => {
    firebaseMocks.getDocs.mockImplementation(async (ref: unknown) => {
      const constraints = (ref as { constraints?: { value?: string }[] }).constraints
      if (constraints?.some((constraint) => constraint.value === 'lanches')) {
        return { empty: false, docs: [{ id: 'smash' }] }
      }
      return { empty: true, docs: [] }
    })
    const { user, dialog } = await openAdminScreen('Categorias')
    await waitFor(() => expect(activeListeners('categories')).toHaveLength(1))
    await act(async () => {
      emit('categories', categories)
    })

    expect(dialog).toHaveTextContent('Início continua mostrando todos os produtos')
    expect(within(dialog).queryByRole('article', { name: 'Início' })).not.toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Bebidas')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Destaque' }))
    await user.click(within(dialog).getByRole('button', { name: 'Criar categoria' }))
    expect(lastAdd('categories')).toMatchObject({ name: 'Bebidas', destaque: true, order: 3 })

    const card = within(dialog).getByRole('article', { name: 'Lanches' })
    const tools = within(card).getAllByRole('button')
    expect(tools).toHaveLength(3)
    for (const button of tools) {
      expect(button.querySelector('svg')).toBeInTheDocument()
      expect(parseFloat(getComputedStyle(button).width)).toBeGreaterThanOrEqual(44)
    }
    await user.click(within(card).getByRole('button', { name: 'Editar' }))
    const name = within(card).getByRole('textbox', { name: 'Novo nome' })
    await user.clear(name)
    await user.type(name, 'Burgers')
    await user.click(within(card).getByRole('button', { name: 'Salvar nome' }))
    expect(firebaseMocks.updateDoc).toHaveBeenCalledWith({ path: 'categories/lanches' }, { name: 'Burgers' })

    const promo = within(dialog).getByRole('article', { name: 'Promoções' })
    await user.click(within(promo).getByRole('button', { name: 'Tirar destaque' }))
    expect(firebaseMocks.updateDoc).toHaveBeenCalledWith({ path: 'categories/promo' }, { destaque: false })

    await user.click(within(card).getByRole('button', { name: 'Apagar' }))
    await user.click(within(screen.getByRole('alertdialog', { name: 'Confirmar exclusão' })).getByRole('button', { name: 'Excluir' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Esta categoria ainda tem produtos. Exclua esses produtos antes.',
    )
    expect(firebaseMocks.deleteDoc).not.toHaveBeenCalled()

    await user.click(within(promo).getByRole('button', { name: 'Apagar' }))
    await user.click(within(screen.getByRole('alertdialog', { name: 'Confirmar exclusão' })).getByRole('button', { name: 'Excluir' }))
    expect(firebaseMocks.deleteDoc).toHaveBeenCalledWith({ path: 'categories/promo' })
  })
})

describe('Adicionais', () => {
  it('creates an add-on outside the product', async () => {
    const { user, dialog } = await openAdminScreen('Adicionais')
    await waitFor(() => expect(activeListeners('settings/catalog')).toHaveLength(1))
    await act(async () => {
      emitDoc('settings/catalog', { seeded: true })
      emit('addons', [])
      emit('products', [])
    })
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Molho especial')
    const price = within(dialog).getByRole('textbox', { name: 'Valor (R$)' })
    await user.type(price, '300')
    expect(price).toHaveValue('3,00')
    await user.click(within(dialog).getByRole('button', { name: 'Criar adicional' }))
    expect(lastAdd('addons')).toEqual({ name: 'Molho especial', price: 3 })
    expect(within(dialog).queryByRole('button', { name: '+ Adicional' })).not.toBeInTheDocument()
  })

  it('lists each stored product extra once, keeping the first price', async () => {
    const { dialog } = await openAdminScreen('Adicionais')
    await waitFor(() => expect(activeListeners('addons')).toHaveLength(1))
    await act(async () => {
      emit('products', [
        {
          id: 'x',
          name: 'X-Burger',
          categoryId: 'lanches',
          price: 20,
          available: true,
          description: '',
          image: '',
          extras: [{ id: 'e1', name: 'Bacon', price: 5 }],
        },
        {
          id: 'smash',
          name: 'Smash da casa',
          categoryId: 'lanches',
          price: 28,
          available: true,
          description: '',
          image: '',
          extras: [
            { id: 'e2', name: 'Bacon', price: 4 },
            { id: 'e3', name: 'Cheddar', price: 3 },
          ],
        },
      ])
      emit('addons', [])
      emitDoc('settings/catalog', null)
    })

    await waitFor(() => expect(firebaseMocks.addDoc).toHaveBeenCalled())
    const created = firebaseMocks.addDoc.mock.calls
      .filter(([ref]) => (ref as { path: string }).path === 'addons')
      .map(([, data]) => data)
    expect(created).toEqual([
      { name: 'Bacon', price: 4 },
      { name: 'Cheddar', price: 3 },
    ])
    expect(firebaseMocks.setDoc).toHaveBeenCalledWith({ path: 'settings/catalog' }, { seeded: true }, { merge: true })
    expect(firebaseMocks.updateDoc).not.toHaveBeenCalled()

    await act(async () => {
      emit('addons', [
        { id: 'bacon', name: 'Bacon', price: 4 },
        { id: 'cheddar', name: 'Cheddar', price: 3 },
      ])
    })
    expect(within(dialog).getByRole('article', { name: 'Bacon' })).toHaveTextContent('R$ 4,00')
    expect(within(dialog).getByRole('article', { name: 'Cheddar' })).toHaveTextContent('R$ 3,00')
  })
})

describe('Ícones das categorias', () => {
  it('maps names to icons without needing a saved icon', async () => {
    const { autoIconForName, iconForCategory } = await import('./lib/categoryIcons')
    expect(autoIconForName('Combos')).toBe('combo')
    expect(autoIconForName('Smash industrial')).toBe('burger')
    expect(autoIconForName('Smash artesanal')).toBe('burger')
    expect(autoIconForName('Hambúrgueres')).toBe('burger')
    expect(autoIconForName('Batata P M G')).toBe('fries')
    expect(autoIconForName('Sobremesas')).toBe('sweet')
    expect(autoIconForName('Salgados')).toBe('salgado')
    expect(autoIconForName('Suco turbinado')).toBe('suco')
    expect(autoIconForName('Bebidas')).toBe('drink')
    expect(autoIconForName('Porções')).toBe('porcao')
    expect(autoIconForName('Qualquer coisa nova')).toBe('prato')
    expect(iconForCategory('Bebidas', 'pizza')).toBe('pizza')
    expect(iconForCategory('Bebidas', 'invalido')).toBe('drink')
  })

  it('shows an icon on every category pill, chosen or automatic', async () => {
    renderApp()
    await act(async () => {
      emit('categories', [
        { id: 'a', name: 'Lanches', order: 1, icon: 'pizza' },
        { id: 'b', name: 'Bebidas', order: 2 },
      ])
      emit('products', [{ id: 'p1', categoryId: 'a', name: 'X-Salada', price: 20, available: true, description: '' }])
    })
    for (const name of ['Início', 'Lanches', 'Bebidas']) {
      const pill = await screen.findByRole('button', { name })
      expect(pill.querySelector('svg.cat-icon')).toBeInTheDocument()
    }
  })

  it('lets the admin pick an icon, or leave it automatic, when creating and editing', async () => {
    const { user, dialog } = await openAdminScreen('Categorias')
    await waitFor(() => expect(activeListeners('categories')).toHaveLength(1))
    await act(async () => {
      emit('categories', [{ id: 'lanches', name: 'Lanches', order: 1, icon: 'burger' }])
    })

    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Pizzas')
    const picker = within(dialog).getAllByRole('radiogroup', { name: 'Ícone da categoria' })[0]
    expect(within(picker).getAllByRole('radio').length).toBeGreaterThanOrEqual(29)
    expect(within(picker).getByRole('radio', { name: 'Automático' })).toHaveAttribute('aria-checked', 'true')
    await user.click(within(picker).getByRole('radio', { name: 'Pizza' }))
    await user.click(within(dialog).getByRole('button', { name: 'Criar categoria' }))
    expect(lastAdd('categories')).toMatchObject({ name: 'Pizzas', icon: 'pizza' })

    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Sucos')
    await user.click(within(dialog).getByRole('button', { name: 'Criar categoria' }))
    expect(lastAdd('categories')).not.toHaveProperty('icon')

    const card = within(dialog).getByRole('article', { name: 'Lanches' })
    await user.click(within(card).getByRole('button', { name: 'Editar' }))
    const editPicker = within(dialog).getAllByRole('radiogroup', { name: 'Ícone da categoria' })[1]
    expect(within(editPicker).getByRole('radio', { name: 'Hambúrguer' })).toHaveAttribute('aria-checked', 'true')
    await user.click(within(editPicker).getByRole('radio', { name: 'Automático' }))
    await user.click(within(card).getByRole('button', { name: 'Salvar nome' }))
    expect(firebaseMocks.updateDoc).toHaveBeenCalledWith({ path: 'categories/lanches' }, { icon: 'DELETE_FIELD' })
  })
})

