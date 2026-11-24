import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { MenuScreen } from './components/MenuScreen'
import { groupBySection, sortCategories } from './lib/menu'
import { emitSeedCatalog } from './test/render'
import { emit } from './test/mocks'
import './index.css'
import './menu.css'

type Observed = { callback: IntersectionObserverCallback; options?: IntersectionObserverInit; targets: Element[] }
const observers: Observed[] = []

class FakeObserver {
  private readonly entry: Observed
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.entry = { callback, options, targets: [] }
    observers.push(this.entry)
  }
  observe(target: Element) {
    this.entry.targets.push(target)
  }
  unobserve() {}
  disconnect() {
    const at = observers.indexOf(this.entry)
    if (at >= 0) observers.splice(at, 1)
  }
  takeRecords() {
    return []
  }
}

const tops: Record<string, number> = {}
const realRect = Element.prototype.getBoundingClientRect

function layout(next: Record<string, number>) {
  Object.assign(tops, next)
}

function fire() {
  act(() => {
    for (const observer of observers.filter((entry) => entry.options?.rootMargin)) {
      observer.callback(observer.targets.map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry), {} as IntersectionObserver)
    }
  })
}

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y })
  act(() => {
    window.dispatchEvent(new Event('scroll'))
  })
}

function renderMenu() {
  render(
    <AuthProvider>
      <MemoryRouter>
        <MenuScreen />
      </MemoryRouter>
    </AuthProvider>,
  )
  act(() => {
    emitSeedCatalog()
  })
}

function current() {
  return screen.getAllByRole('button').filter((button) => button.getAttribute('aria-current') === 'true' && button.classList.contains('chip'))
}

beforeEach(() => {
  observers.length = 0
  for (const key of Object.keys(tops)) delete tops[key]
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  Element.prototype.scrollIntoView = vi.fn()
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  Element.prototype.getBoundingClientRect = function rect(this: Element) {
    const id = (this as HTMLElement).dataset?.section
    if (id !== undefined && id in tops) return { top: tops[id], bottom: tops[id] + 300, height: 300, left: 0, right: 375, width: 375, x: 0, y: tops[id], toJSON: () => ({}) }
    if (this.classList?.contains('chips')) return { top: 0, bottom: 54, height: 54, left: 0, right: 375, width: 375, x: 0, y: 0, toJSON: () => ({}) }
    return realRect.call(this)
  }
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 54 })
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Element.prototype.getBoundingClientRect = realRect
  delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
})

describe('scroll-spy of the category chips', () => {
  it('watches a thin band under the sticky chips and follows the section being read', () => {
    renderMenu()
    layout({ smash: 400, sides: 900, drinks: 1300 })
    fire()
    expect(current().map((chip) => chip.textContent)).toEqual(['Início'])

    const band = observers.find((observer) => observer.options?.rootMargin)
    expect(band?.targets.map((target) => (target as HTMLElement).dataset.section)).toEqual(['smash', 'sides', 'drinks'])
    expect(band?.options?.rootMargin).toMatch(/^-78px 0px -\d+px 0px$/)

    layout({ smash: 60, sides: 500, drinks: 900 })
    fire()
    expect(current().map((chip) => chip.textContent)).toEqual(['Smash'])
    expect(screen.getByRole('button', { name: 'Smash' })).toHaveClass('is-active')

    layout({ smash: -400, sides: 70, drinks: 500 })
    fire()
    expect(current().map((chip) => chip.textContent)).toEqual(['Acompanhamentos'])

    layout({ smash: -900, sides: -400, drinks: 20 })
    fire()
    expect(current().map((chip) => chip.textContent)).toEqual(['Bebidas'])

    layout({ smash: 300, sides: 700, drinks: 1100 })
    fire()
    expect(current().map((chip) => chip.textContent)).toEqual(['Início'])
  })

  it('slides the gold pill to the active chip', () => {
    renderMenu()
    const pill = () => document.querySelector('.chips__pill') as HTMLElement
    expect(pill()).toHaveAttribute('aria-hidden', 'true')
    layout({ smash: 60, sides: 500, drinks: 900 })
    fire()
    expect(document.querySelectorAll('.chips__pill')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Smash' })).toHaveClass('is-active')
  })

  it('shows the last section when the page is scrolled to the very end', () => {
    renderMenu()
    layout({ smash: -900, sides: -300, drinks: 200 })
    scrollTo(1500)
    const end = observers.find((observer) => !observer.options?.rootMargin)
    expect(end?.targets[0]).toHaveAttribute('data-menu-end')
    act(() => {
      end?.callback([{ target: end.targets[0], isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(current().map((chip) => chip.textContent)).toEqual(['Bebidas'])
    act(() => {
      end?.callback([{ target: end.targets[0], isIntersecting: false } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    layout({ smash: -900, sides: 20, drinks: 300 })
    fire()
    expect(current().map((chip) => chip.textContent)).toEqual(['Acompanhamentos'])
  })

  it('holds the tapped chip while the page glides, then lets the scroll take over again', () => {
    vi.useFakeTimers()
    renderMenu()
    layout({ smash: 300, sides: 700, drinks: 1100 })
    fire()

    fireEvent.click(screen.getByRole('button', { name: 'Bebidas' }))
    expect(current().map((chip) => chip.textContent)).toEqual(['Bebidas'])

    layout({ smash: -200, sides: 150, drinks: 600 })
    scrollTo(400)
    fire()
    expect(current().map((chip) => chip.textContent)).toEqual(['Bebidas'])

    layout({ smash: -800, sides: -400, drinks: 70 })
    scrollTo(1000)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    fire()
    expect(current().map((chip) => chip.textContent)).toEqual(['Bebidas'])

    scrollTo(1010)
    expect(current().map((chip) => chip.textContent)).toEqual(['Bebidas'])

    layout({ smash: -400, sides: 60, drinks: 500 })
    scrollTo(700)
    expect(current().map((chip) => chip.textContent)).toEqual(['Acompanhamentos'])
  })

  it('gives the scroll back as soon as the finger or wheel moves during the glide', () => {
    vi.useFakeTimers()
    renderMenu()
    layout({ smash: 300, sides: 700, drinks: 1100 })
    fire()
    fireEvent.click(screen.getByRole('button', { name: 'Bebidas' }))
    layout({ smash: -100, sides: 60, drinks: 400 })
    fireEvent.wheel(window)
    expect(current().map((chip) => chip.textContent)).toEqual(['Acompanhamentos'])
  })

  it('keeps working when a search leaves a single section', async () => {
    renderMenu()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: 'batata' } })
    layout({ sides: 60 })
    fire()
    expect(current().map((chip) => chip.textContent)).toEqual(['Acompanhamentos'])
    expect(screen.getByRole('button', { name: 'Smash' })).toBeDisabled()
  })

  it('stops watching when the menu goes away', () => {
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
    expect(observers.length).toBeGreaterThan(0)
    view.unmount()
    expect(observers).toHaveLength(0)
  })
})

describe('section layout', () => {
  it('pins the chips under the top edge and leaves room for them when scrolling to a section', () => {
    renderMenu()
    const chips = document.querySelector('.chips') as HTMLElement
    expect(getComputedStyle(chips).position).toBe('sticky')
    expect(getComputedStyle(chips).zIndex).toBe('5')
    expect(chips.style.top).toBe('')
    const section = document.querySelector('.section') as HTMLElement
    expect(getComputedStyle(section).scrollMarginTop).toBe('60px')
    expect(getComputedStyle(document.querySelector('.section__title') as HTMLElement).textTransform).toBe('uppercase')
  })

  it('animates the pill only when motion is allowed', async () => {
    const css = (await import('./menu.css?raw')).default
    const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference) {\n  .chips__pill.is-ready'))
    expect(motion).toMatch(/\.chips__pill\.is-ready \{\s+transition:[^;]*220ms/)
    const outside = css.replace(motion.slice(0, motion.indexOf('\n}\n') + 3), '')
    expect(outside).not.toMatch(/\.chips__pill\.is-ready/)
  })
})

describe('groupBySection', () => {
  const categories = sortCategories([
    { id: 'a', name: 'A', order: 2, destaque: false },
    { id: 'b', name: 'B', order: 1, destaque: false },
    { id: 'c', name: 'C', order: 3, destaque: false },
  ])
  const product = (id: string, categoryId: string) => ({ id, categoryId, name: id, price: 1, available: true, image: '', description: '' })

  it('follows category order, drops empty categories and closes with the orphans', () => {
    const sections = groupBySection([product('x', 'a'), product('y', 'gone'), product('z', 'b'), product('w', 'a')], categories)
    expect(sections.map((section) => [section.id, section.products.map((item) => item.id)])).toEqual([
      ['b', ['z']],
      ['a', ['x', 'w']],
      ['', ['y']],
    ])
  })

  it('returns nothing when there are no products', () => {
    expect(groupBySection([], categories)).toEqual([])
  })
})

it('still renders the sections for a fresh catalog snapshot', async () => {
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  Element.prototype.scrollIntoView = vi.fn()
  renderMenu()
  await act(async () => {
    emit('products', [])
  })
  expect(screen.getByText('Nenhum item encontrado.')).toBeInTheDocument()
  expect(document.querySelectorAll('.section')).toHaveLength(0)
  vi.unstubAllGlobals()
})
