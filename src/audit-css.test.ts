import { describe, expect, it } from 'vitest'
import indexCss from './index.css?raw'
import menuCss from './menu.css?raw'
import printCss from './print.css?raw'

const files: Record<string, string> = { 'index.css': indexCss, 'menu.css': menuCss, 'print.css': printCss }
const read = (name: string) => files[name]

/** The first declaration block of a selector, as one string. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`rule not found: ${selector}`)
  return match[1]
}

describe('admin drawer', () => {
  it('scrolls inside the panel on short screens instead of cutting the last links', () => {
    const panel = rule(read('menu.css'), '.drawer__panel')
    expect(panel).toMatch(/overflow-y:\s*auto/)
    expect(panel).toMatch(/overscroll-behavior:\s*contain/)
    expect(panel).toMatch(/max-height:\s*100%/)
    expect(panel).not.toMatch(/min-height:\s*100%/)
    expect(panel).toMatch(/safe-bottom/)
  })
})

describe('touch targets', () => {
  it('give small round buttons, steppers, ghost buttons and the shop switch a 44px hit area', () => {
    const menu = read('menu.css')
    expect(rule(menu, '.mark-btn::after,\n.stepper button::after')).toMatch(/max\(100%,\s*44px\)/)
    expect(rule(menu, ".shop-controls button[role='switch']::after")).toMatch(/height:\s*44px/)
    expect(rule(menu, '.revenue__filters button')).toMatch(/min-height:\s*44px/)
    expect(rule(menu, '.menu .pay__option')).toMatch(/min-height:\s*44px/)
    expect(rule(read('index.css'), '.btn--ghost::after')).toMatch(/max\(100%,\s*44px\)/)
  })
})

describe('print', () => {
  it('prints only the order popup, black on white, without buttons and without breaking prices', () => {
    const css = read('print.css')
    expect(css).toContain('@media print')
    expect(css).toMatch(/body \* \{\s*visibility:\s*hidden/)
    expect(css).toMatch(/\.popup \.actions[\s\S]*display:\s*none/)
    expect(css).toMatch(/white-space:\s*nowrap/)
    expect(rule(read('menu.css'), '.order-items li > span:last-child')).toMatch(/white-space:\s*nowrap/)
  })
})
