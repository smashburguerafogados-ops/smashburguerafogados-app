import { describe, expect, it } from 'vitest'
import indexHtml from '../index.html?raw'
import manifestJson from '../public/manifest.webmanifest?raw'
import indexCss from './index.css?raw'
import menuCss from './menu.css?raw'
import printCss from './print.css?raw'

const files: Record<string, string> = { 'index.css': indexCss, 'menu.css': menuCss, 'print.css': printCss }
const read = (name: string) => files[name]

/** The first declaration block of a selector, as one string. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const blocks = Array.from(css.matchAll(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'g')))
  if (blocks.length === 0) throw new Error(`rule not found: ${selector}`)
  return blocks.map((match) => match[1]).join('\n')
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

describe('legibility and safe areas', () => {
  it('draws the bar labels at 0.75rem or more with tabular numbers, so R$ 0,00 reads as a price', () => {
    const label = rule(read('menu.css'), '.dock__label')
    expect(parseFloat(label.match(/font-size:\s*([\d.]+)rem/)![1])).toBeGreaterThanOrEqual(0.75)
    expect(label).toMatch(/tabular-nums/)
  })

  it('keeps the page, bar, popups and admin out from under a notch in landscape', () => {
    const menu = read('menu.css')
    for (const selector of ['.menu__content', '.dock', '.popup', '.admin__bar', '.admin__main']) {
      const block = rule(menu, selector)
      expect(block, selector).toMatch(/env\(safe-area-inset-left/)
      expect(block, selector).toMatch(/env\(safe-area-inset-right/)
    }
  })
})

describe('menu grid', () => {
  const menu = read('menu.css')
  const columns = (block: string) => block.match(/grid-template-columns:\s*repeat\((\d+),/)?.[1]

  it('keeps two columns on phones and goes to three from 600px', () => {
    expect(columns(rule(menu, '.items'))).toBe('2')
    const tablet = menu.match(/@media \(min-width: 600px\) \{\s*\.items \{([^}]*)\}/)
    expect(tablet).not.toBeNull()
    expect(columns(tablet![1])).toBe('3')
    expect(menu).not.toMatch(/@media \(max-width: 599px\) \{\s*\.items/)
  })

  it('widens the container to 960px only from 900px', () => {
    expect(rule(menu, '.menu__content')).toMatch(/width:\s*min\(680px,\s*100%\)/)
    expect(menu).toMatch(/@media \(min-width: 900px\) \{\s*\.menu__content \{\s*width:\s*min\(960px,\s*100%\);/)
  })
})

describe('older browsers', () => {
  it('uses dvh only after a vh fallback', () => {
    for (const css of [read('menu.css'), read('index.css')]) {
      for (const match of css.matchAll(/^(\s*)([a-z-]+):[^;\n]*\d+dvh[^;\n]*;/gm)) {
        const before = css.slice(0, match.index)
        const lastLine = before.trimEnd().split('\n').pop() ?? ''
        expect(lastLine, match[0]).toMatch(new RegExp(`${match[2]}:[^;]*\\dvh`))
      }
    }
  })

  it('does not depend on :has() for layout, only for an optional focus ring', () => {
    const lines = read('menu.css')
      .split('\n')
      .filter((line) => line.includes(':has(') && !line.includes(':has(*)'))
    expect(lines).toEqual(['.menu .pay__option:has(input:focus-visible) {'])
    expect(read('menu.css')).toMatch(/@supports not selector\(:has\(\*\)\)[\s\S]*?\.pay__option:focus-within/)
  })
})

describe('home screen', () => {
  it('ships a manifest and an iPhone icon', () => {
    expect(indexHtml).toContain('rel="manifest"')
    expect(indexHtml).toContain('rel="apple-touch-icon"')
    const manifest = JSON.parse(manifestJson) as { display: string; start_url: string; icons: { sizes: string }[] }
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('./')
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512'])
  })

  it('stops the logo press from opening the iOS image menu', () => {
    const logo = rule(read('menu.css'), '.menu__logo')
    expect(logo).toMatch(/-webkit-touch-callout:\s*none/)
    expect(logo).toMatch(/user-select:\s*none/)
  })
})
