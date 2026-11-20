import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import './index.css'
import './menu.css'
import { AuthProvider } from './context/AuthContext'
import { MenuScreen } from './components/MenuScreen'
import { seedCatalog } from './data/catalog'
import { filterProducts } from './lib/menu'
import { emitSeedCatalog } from './test/render'

function renderMenu() {
  const view = render(
    <AuthProvider>
      <MemoryRouter>
        <MenuScreen />
      </MemoryRouter>
    </AuthProvider>,
  )
  act(() => {
    emitSeedCatalog()
  })
  return view
}

function visibleNames(): string[] {
  return Array.from(document.querySelectorAll('.items .item__name')).map((node) => node.textContent ?? '')
}

function expectedNames(query: string): string[] {
  return filterProducts(seedCatalog.products, '', query).map((product) => product.name)
}

describe('menu search', () => {
  it('rounds the search field on the current theme', () => {
    renderMenu()
    const box = screen.getByRole('searchbox', { name: 'Buscar' })
    expect(getComputedStyle(box).borderRadius).toBe('14px')
    expect(getComputedStyle(box).borderTopWidth).not.toBe('0px')
  })

  it('filters the cardápio after every typed letter', async () => {
    const user = userEvent.setup()
    renderMenu()
    const box = screen.getByRole('searchbox', { name: 'Buscar' })
    const all = visibleNames()
    expect(all).toHaveLength(seedCatalog.products.length)

    const word = 'Smash'
    for (let i = 1; i <= word.length; i += 1) {
      await user.type(box, word[i - 1])
      const typed = word.slice(0, i)
      expect(box).toHaveValue(typed)
      const shown = visibleNames()
      expect(shown).toEqual(expectedNames(typed))
      for (const name of shown) {
        const product = seedCatalog.products.find((item) => item.name === name)
        const text = `${product?.name} ${product?.description}`.toLowerCase()
        expect(text).toContain(typed.toLowerCase())
      }
    }

    expect(visibleNames()).toEqual(['Smash da casa', 'Smash duplo', 'Smash picante'])
    expect(visibleNames().length).toBeLessThan(all.length)
  })

  it('narrows as letters are added and widens again on backspace', async () => {
    const user = userEvent.setup()
    renderMenu()
    const box = screen.getByRole('searchbox', { name: 'Buscar' })

    await user.type(box, 'ca')
    const two = visibleNames()
    await user.type(box, 's')
    const three = visibleNames()
    expect(three.length).toBeLessThanOrEqual(two.length)
    expect(three.every((name) => two.includes(name))).toBe(true)

    await user.type(box, '{backspace}')
    expect(visibleNames()).toEqual(two)
  })

  it('ignores case: Smash, smash and SMASH show the same items', async () => {
    const user = userEvent.setup()
    renderMenu()
    const box = screen.getByRole('searchbox', { name: 'Buscar' })

    const results: string[][] = []
    for (const query of ['Smash', 'smash', 'SMASH', 'sMaSh']) {
      await user.clear(box)
      await user.type(box, query)
      results.push(visibleNames())
    }

    expect(results[0]).toEqual(['Smash da casa', 'Smash duplo', 'Smash picante'])
    for (const result of results) expect(result).toEqual(results[0])
  })

  it('ignores accents as well as case', () => {
    const plain = filterProducts(seedCatalog.products, '', 'RUSTICA').map((product) => product.id)
    const accented = filterProducts(seedCatalog.products, '', 'rústica').map((product) => product.id)
    expect(plain).toEqual(['batata'])
    expect(accented).toEqual(plain)
  })
})
