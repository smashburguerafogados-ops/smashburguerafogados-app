import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReorderStrip, REORDER_AUTOPLAY_MS } from './components/ReorderStrip'
import { seedCatalog } from './data/catalog'
import type { Order } from './lib/orders'
import { makeOrder } from './test/render'

const products = seedCatalog.products
const STEP = 322
const MAX_SCROLL = 984 - 390

function order(id: string, createdAtMs: number, productId: string, name: string): Order {
  return makeOrder({
    id,
    status: 'finalizado',
    createdAtMs,
    items: [{ productId, name, image: 'x.svg', priceCents: 100, qty: 1, note: '' }],
  }) as unknown as Order
}

const three = [
  order('p1', 3, 'smash-casa', 'Smash da casa'),
  order('p2', 2, 'batata', 'Batata'),
  order('p3', 1, 'suco', 'Suco'),
]

type Layout = { scroller: HTMLElement; scrollTo: ReturnType<typeof vi.fn> }

function stubLayout(): Layout {
  const scroller = document.querySelector('.reorder__scroll') as HTMLElement
  let left = 0
  const cards = Array.from(scroller.children) as HTMLElement[]
  Object.defineProperty(scroller, 'scrollLeft', { configurable: true, get: () => left, set: (value: number) => (left = value) })
  Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 14 * 2 + cards.length * 312 + (cards.length - 1) * 10 })
  Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 390 })
  cards.forEach((card, index) => Object.defineProperty(card, 'offsetLeft', { configurable: true, value: 14 + index * STEP }))
  const scrollTo = vi.fn((options: ScrollToOptions) => {
    left = options.left ?? 0
  })
  scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo
  return { scroller, scrollTo }
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function mountStrip(orders: Order[] = three, onReorder = vi.fn()) {
  const view = render(<ReorderStrip orders={orders} products={products} onReorder={onReorder} />)
  const layout = stubLayout()
  return { ...view, ...layout, onReorder }
}

class FakeObserver {
  static instances: FakeObserver[] = []
  disconnected = false
  constructor(private callback: IntersectionObserverCallback) {
    FakeObserver.instances.push(this)
  }
  observe() {}
  unobserve() {}
  takeRecords() {
    return []
  }
  disconnect() {
    this.disconnected = true
  }
  emit(isIntersecting: boolean, ratio = isIntersecting ? 1 : 0) {
    this.callback([{ isIntersecting, intersectionRatio: ratio } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

function setHidden(value: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => value })
  document.dispatchEvent(new Event('visibilitychange'))
}

const originalMatchMedia = window.matchMedia

beforeEach(() => {
  vi.useFakeTimers()
  FakeObserver.instances = []
  vi.stubGlobal('IntersectionObserver', FakeObserver)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  window.matchMedia = originalMatchMedia
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})

describe('Pedir de novo autoplay', () => {
  it('moves to the next card every 3 seconds, smoothly and only inside the carousel', () => {
    const pageScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const { scrollTo, scroller } = mountStrip()
    advance(REORDER_AUTOPLAY_MS - 1)
    expect(scrollTo).not.toHaveBeenCalled()
    advance(1)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenLastCalledWith({ left: STEP, behavior: 'smooth' })
    act(() => {
      fireEvent.scroll(scroller)
    })
    const dots = Array.from(document.querySelectorAll('.reorder__dots i'))
    expect(dots).toHaveLength(3)
    expect(dots.map((dot) => dot.classList.contains('is-on'))).toEqual([false, true, false])
    expect(pageScroll).not.toHaveBeenCalled()
  })

  it('loops back to the first card after the last one', () => {
    const { scrollTo } = mountStrip()
    advance(REORDER_AUTOPLAY_MS)
    advance(REORDER_AUTOPLAY_MS)
    advance(REORDER_AUTOPLAY_MS)
    advance(REORDER_AUTOPLAY_MS)
    expect(scrollTo.mock.calls.map(([options]) => options.left)).toEqual([STEP, MAX_SCROLL, 0, STEP])
  })

  it('works with two purchases and does nothing with just one', () => {
    const two = mountStrip(three.slice(0, 2))
    advance(REORDER_AUTOPLAY_MS)
    advance(REORDER_AUTOPLAY_MS)
    expect(two.scrollTo.mock.calls.map(([options]) => options.left)).toEqual([272, 0])
    two.unmount()

    const one = mountStrip(three.slice(0, 1))
    expect(vi.getTimerCount()).toBe(0)
    advance(REORDER_AUTOPLAY_MS * 5)
    expect(one.scrollTo).not.toHaveBeenCalled()
    expect(document.querySelector('.reorder__dots')).not.toBeInTheDocument()
  })

  it('pauses while touching and resumes with a fresh 3 seconds after the finger leaves', () => {
    const { scrollTo, scroller } = mountStrip()
    advance(2000)
    fireEvent.touchStart(scroller)
    advance(REORDER_AUTOPLAY_MS * 4)
    expect(scrollTo).not.toHaveBeenCalled()
    fireEvent.touchEnd(scroller)
    advance(REORDER_AUTOPLAY_MS - 1)
    expect(scrollTo).not.toHaveBeenCalled()
    advance(1)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('restarts the wait whenever the user scrolls the carousel', () => {
    const { scrollTo, scroller } = mountStrip()
    advance(2000)
    act(() => {
      fireEvent.scroll(scroller)
    })
    advance(2000)
    expect(scrollTo).not.toHaveBeenCalled()
    advance(1000)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('pauses while the mouse is over the carousel', () => {
    const { scrollTo, scroller } = mountStrip()
    fireEvent.pointerEnter(scroller, { pointerType: 'mouse' })
    advance(REORDER_AUTOPLAY_MS * 3)
    expect(scrollTo).not.toHaveBeenCalled()
    fireEvent.pointerLeave(scroller, { pointerType: 'mouse' })
    advance(REORDER_AUTOPLAY_MS - 1)
    expect(scrollTo).not.toHaveBeenCalled()
    advance(1)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('ignores the sticky hover that a touch screen leaves behind', () => {
    const { scrollTo, scroller } = mountStrip()
    fireEvent.pointerEnter(scroller, { pointerType: 'touch' })
    advance(REORDER_AUTOPLAY_MS)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('pauses while the details panel is open and restarts the wait when it closes', () => {
    const { scrollTo, scroller } = mountStrip()
    advance(2000)
    fireEvent.click(within(scroller).getAllByRole('button', { name: /Ver itens/ })[0])
    expect(screen.getByRole('dialog', { name: /Compra/ })).toBeInTheDocument()
    advance(REORDER_AUTOPLAY_MS * 4)
    expect(scrollTo).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    advance(REORDER_AUTOPLAY_MS - 1)
    expect(scrollTo).not.toHaveBeenCalled()
    advance(1)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('pauses while the tab is hidden and resumes when it comes back', () => {
    const { scrollTo } = mountStrip()
    advance(2000)
    act(() => setHidden(true))
    advance(REORDER_AUTOPLAY_MS * 3)
    expect(scrollTo).not.toHaveBeenCalled()
    act(() => setHidden(false))
    advance(REORDER_AUTOPLAY_MS - 1)
    expect(scrollTo).not.toHaveBeenCalled()
    advance(1)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('pauses while the carousel is off screen', () => {
    const { scrollTo } = mountStrip()
    const observer = FakeObserver.instances[0]
    act(() => observer.emit(false))
    advance(REORDER_AUTOPLAY_MS * 3)
    expect(scrollTo).not.toHaveBeenCalled()
    act(() => observer.emit(true))
    advance(REORDER_AUTOPLAY_MS)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('stays off for people who prefer reduced motion', () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
    const { scrollTo } = mountStrip()
    expect(vi.getTimerCount()).toBe(0)
    advance(REORDER_AUTOPLAY_MS * 5)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('clears every timer and listener on unmount', () => {
    const { unmount, scrollTo } = mountStrip()
    advance(1000)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(FakeObserver.instances.every((observer) => observer.disconnected)).toBe(true)
    advance(REORDER_AUTOPLAY_MS * 3)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('follows the list in real time: restarts for a new list, stops when only one purchase is left', () => {
    const { rerender, scrollTo } = mountStrip(three.slice(1))
    advance(2000)
    const fresh = [order('p9', 9, 'lata', 'Lata'), ...three.slice(1)]
    rerender(<ReorderStrip orders={fresh} products={products} onReorder={vi.fn()} />)
    stubLayout()
    expect(vi.getTimerCount()).toBe(1)
    advance(2999)
    expect(scrollTo).not.toHaveBeenCalled()
    const after = document.querySelector('.reorder__scroll') as HTMLElement
    const calls = vi.fn()
    after.scrollTo = calls as unknown as typeof after.scrollTo
    advance(1)
    expect(calls).toHaveBeenCalledTimes(1)

    rerender(<ReorderStrip orders={fresh.slice(0, 1)} products={products} onReorder={vi.fn()} />)
    expect(vi.getTimerCount()).toBe(0)
    expect(document.querySelector('.reorder__dots')).not.toBeInTheDocument()
    advance(REORDER_AUTOPLAY_MS * 3)
    expect(calls).toHaveBeenCalledTimes(1)
  })

  it('opens the purchase that was tapped, even after the carousel has moved', () => {
    const { scroller, onReorder } = mountStrip()
    advance(REORDER_AUTOPLAY_MS)
    const openers = within(scroller).getAllByRole('button', { name: /Ver itens/ })
    fireEvent.touchStart(openers[2])
    advance(REORDER_AUTOPLAY_MS * 3)
    fireEvent.touchEnd(openers[2])
    fireEvent.click(openers[2])
    const sheet = screen.getByRole('dialog', { name: /Compra/ })
    expect(within(sheet).getByText('Suco da casa')).toBeInTheDocument()
    expect(within(sheet).queryByText('Batata rústica')).not.toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Adicionar ao carrinho' }))
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder.mock.calls[0][0][0].line.productId).toBe('suco')
  })

  it('does not take focus away while it moves', () => {
    const { scroller } = mountStrip()
    const field = document.createElement('input')
    document.body.appendChild(field)
    field.focus()
    advance(REORDER_AUTOPLAY_MS * 2)
    expect(field).toHaveFocus()
    expect(scroller.contains(document.activeElement)).toBe(false)
    field.remove()
  })
})
