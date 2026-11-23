import { act, render, screen, waitFor, within } from '@testing-library/react'
import './index.css'
import indexCss from './index.css?raw'
import './griddle.css'
import './menu.css'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import treeSvg from './assets/theme/christmas-tree.svg?raw'
import flagSvg from './assets/theme/flag-yellow.svg?raw'
import maskSvg from './assets/theme/performing-arts.svg?raw'
import { Splash } from './components/Splash'
import { ThemeFrame } from './components/ThemeMark'
import { AuthProvider } from './context/AuthContext'
import { activeListeners, emitDoc, firebaseMocks } from './test/mocks'
import { adminProfile, renderApp, signInAs } from './test/render'

afterEach(() => {
  delete document.documentElement.dataset.theme
})

function expectNoThemeWash(style: CSSStyleDeclaration) {
  expect(style.backgroundImage).toBe('none')
  expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)')
}

it('uses colorful shipped icons instead of one-color line drawings', () => {
  expect(treeSvg).toMatch(/fill="/)
  expect(maskSvg).toMatch(/fill="/)
  expect(flagSvg).toContain('#FFE14D')
  expect(treeSvg).not.toContain('stroke="currentColor"')
  expect(maskSvg).not.toContain('stroke="currentColor"')
})

it('keeps the current look until an admin confirms another theme', async () => {
  signInAs(adminProfile)
  const user = userEvent.setup()
  renderApp('/admin')
  await screen.findByRole('heading', { name: 'Painel' })
  await waitFor(() => expect(activeListeners('settings/theme')).toHaveLength(1))
  expect(document.documentElement).not.toHaveAttribute('data-theme')
  expect(document.querySelector('[data-theme-ornament]')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
  await user.click(screen.getByRole('button', { name: 'Temas' }))
  const sheet = screen.getByRole('dialog', { name: 'Temas' })
  const natal = within(sheet).getByRole('radio', { name: 'Natal' })
  const carnaval = within(sheet).getByRole('radio', { name: 'Carnaval' })
  const atual = within(sheet).getByRole('radio', { name: 'Atual' })
  expect(atual).toBeChecked()

  await user.click(natal)
  expect(natal).toBeChecked()
  expect(carnaval).not.toBeChecked()
  expect(atual).not.toBeChecked()
  expect(document.documentElement).not.toHaveAttribute('data-theme')

  await user.click(carnaval)
  expect(carnaval).toBeChecked()
  expect(natal).not.toBeChecked()
  expect(within(sheet).getAllByRole('radio').filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(1)
  expect(document.documentElement).not.toHaveAttribute('data-theme')

  await user.click(within(sheet).getByRole('button', { name: 'Confirmar' }))
  expect(firebaseMocks.setDoc).toHaveBeenCalledWith({ path: 'settings/theme' }, { theme: 'carnaval' }, { merge: true })
  expect(document.documentElement).not.toHaveAttribute('data-theme')

  await act(async () => {
    emitDoc('settings/theme', { theme: 'carnaval' })
  })
  expect(document.documentElement).not.toHaveAttribute('data-theme')
  expect(document.querySelector('[data-theme-ornament]')).toBeNull()
  expect(document.querySelector('[data-theme-bg]')).toBeNull()
  expect(document.querySelector('[data-theme-snow]')).toBeNull()
  expect(getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()).toBe('#e3b15a')
})

it('shows customers the confirmed theme and hides the picker', async () => {
  renderApp()
  await waitFor(() => expect(activeListeners('settings/theme')).toHaveLength(1))
  expect(screen.queryByRole('button', { name: 'Temas' })).not.toBeInTheDocument()
  expect(document.querySelector('[data-theme-ornament]')).toBeNull()

  await act(async () => {
    emitDoc('settings/theme', { theme: 'natal' })
  })
  expect(document.documentElement).toHaveAttribute('data-theme', 'natal')
  expect(document.querySelector('[data-theme-ornament="natal"]')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-snow] .theme-snow__flake--thin')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-snow] .theme-snow__flake--large')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-tree] img')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-ball] img')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-bg="natal"]')).toBeInTheDocument()
  expect(getComputedStyle(document.querySelector('[data-theme-bg="natal"]')!).pointerEvents).toBe('none')
  expect(getComputedStyle(document.querySelector('[data-theme-snow]')!).pointerEvents).toBe('none')
  expect(getComputedStyle(document.querySelector('[data-theme-fall]')!).pointerEvents).toBe('none')
  const fallIcon = document.querySelector('[data-theme-fall] img') as HTMLElement
  expect(getComputedStyle(fallIcon).pointerEvents).toBe('none')
  const decor = document.querySelector('.theme-decor') as HTMLElement
  const menu = document.querySelector('.menu__content') as HTMLElement
  const dock = document.querySelector('.dock') as HTMLElement
  expect(Number(getComputedStyle(decor).zIndex)).toBeLessThan(Number(getComputedStyle(menu).zIndex))
  expect(Number(getComputedStyle(decor).zIndex)).toBeLessThan(Number(getComputedStyle(dock).zIndex))
  expect(Number(getComputedStyle(document.querySelector('.theme-pin')!).zIndex) || 0).toBeLessThanOrEqual(
    Number(getComputedStyle(decor).zIndex) || 0,
  )
  const natalKinds = new Set(
    [...document.querySelectorAll('[data-theme-ornament="natal"] [data-fall-kind]')].map((node) => node.getAttribute('data-fall-kind')),
  )
  expect(natalKinds.size).toBeGreaterThan(1)
  expect(natalKinds.has('flake')).toBe(true)
  expect(natalKinds.has('snowflake')).toBe(true)
  const natalIcons = new Set(
    [...document.querySelectorAll('[data-theme-ornament="natal"] img')].map((img) => img.getAttribute('src')),
  )
  expect(natalIcons.size).toBeGreaterThan(4)
  const natalBg = getComputedStyle(document.querySelector('[data-theme-bg="natal"]')!)
  expectNoThemeWash(natalBg)
  expect(document.querySelectorAll('[data-theme-fall] .theme-piece')).toHaveLength(8)
  expect(document.querySelectorAll('.theme-snow__flake')).toHaveLength(6)
  expect(getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()).toBe('#e3b15a')
  expect(getComputedStyle(document.documentElement).getPropertyValue('--theme-scene').trim()).toBe('snow-night')
  const search = screen.getByRole('searchbox', { name: 'Buscar' })
  expect(getComputedStyle(search).borderTopColor).toBe('rgba(255, 255, 255, 0.08)')
  expect(getComputedStyle(search).borderTopColor).not.toBe('rgb(255, 255, 255)')
  expect(getComputedStyle(search).borderRadius).toBe('14px')
  expect(indexCss).not.toMatch(/html\[data-theme='natal'\] \.menu__search input/)
  expect(indexCss).not.toMatch(/border-color:\s*#ffffff/)
  expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Temas' })).not.toBeInTheDocument()

  await act(async () => {
    emitDoc('settings/theme', { theme: 'ano-novo' })
  })
  expect(document.querySelector('[data-theme-snow]')).toBeNull()
  expect(document.querySelector('[data-theme-sparks] img')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-year]')?.textContent).toMatch(/\d{4}/)
  expect(getComputedStyle(document.documentElement).getPropertyValue('--theme-scene').trim()).toBe('fireworks-night')

  await act(async () => {
    emitDoc('settings/theme', { theme: 'carnaval' })
  })
  expect(document.querySelector('[data-theme-confetti] img')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-mask] img')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-flag] img')).toBeInTheDocument()
  const carnaval = getComputedStyle(document.documentElement)
  expect(carnaval.getPropertyValue('--gold').trim().toLowerCase()).toBe('#e3b15a')
  expect(carnaval.getPropertyValue('--orange').trim().toLowerCase()).toBe('#e3b15a')
  const carnivalColors = ['--theme-green', '--theme-blue', '--theme-yellow', '--theme-pink'].map((name) =>
    carnaval.getPropertyValue(name).trim().toLowerCase(),
  )
  expect(carnivalColors).toEqual(['#009c3b', '#2f6fed', '#ffe14d', '#ff4f9a'])
  expect(carnivalColors.join(' ')).not.toMatch(/c46bff|7c3aed|purple/)
  expect(carnaval.getPropertyValue('--theme-wash')).not.toMatch(/72,\s*8,\s*96|196,\s*107,\s*255/)
  expect(carnaval.getPropertyValue('--theme-scene').trim()).toBe('carnival-pattern')
  const carnivalBg = getComputedStyle(document.querySelector('[data-theme-bg="carnaval"]')!)
  expectNoThemeWash(carnivalBg)
  expect(document.querySelectorAll('[data-theme-confetti] .theme-piece')).toHaveLength(8)
  const carnivalKinds = new Set(
    [...document.querySelectorAll('[data-theme-ornament="carnaval"] [data-fall-kind]')].map((node) => node.getAttribute('data-fall-kind')),
  )
  expect(carnivalKinds.size).toBeGreaterThan(1)

  await act(async () => {
    emitDoc('settings/theme', { theme: 'pascoa' })
  })
  expect(document.querySelector('[data-theme-egg] img')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-bunny] img')).toBeInTheDocument()
  expect(getComputedStyle(document.documentElement).getPropertyValue('--theme-scene').trim()).toBe('easter')

  await act(async () => {
    emitDoc('settings/theme', { theme: 'sao-joao' })
  })
  expect(document.querySelector('[data-theme-flags]')).toBeNull()
  expect(document.querySelector('.theme-flags')).toBeNull()
  expect(document.querySelectorAll('[data-theme-ornament="sao-joao"] [data-theme-pin]').length).toBeGreaterThan(2)
  expect(document.querySelector('[data-theme-glow]')).toBeInTheDocument()
  expect(getComputedStyle(document.documentElement).getPropertyValue('--theme-scene').trim()).toBe('festa-junina')

  const scenes = ['natal', 'ano-novo', 'carnaval', 'pascoa', 'sao-joao'] as const
  for (const theme of scenes) {
    await act(async () => {
      emitDoc('settings/theme', { theme })
    })
    const scene = document.querySelector(`[data-theme-bg="${theme}"]`)
    expect(scene).toBeInTheDocument()
    expectNoThemeWash(getComputedStyle(scene!))
    expect(document.querySelectorAll(`[data-theme-ornament="${theme}"] .theme-piece`)).toHaveLength(8)
    const kinds = new Set(
      [...document.querySelectorAll(`[data-theme-ornament="${theme}"] [data-fall-kind]`)].map((node) =>
        node.getAttribute('data-fall-kind'),
      ),
    )
    expect(kinds.size).toBeGreaterThan(1)
    expect(document.querySelectorAll(`[data-theme-ornament="${theme}"] [data-theme-pin]`).length).toBeGreaterThan(2)
    expect(getComputedStyle(document.querySelector(`[data-theme-ornament="${theme}"] .theme-pin`)!).pointerEvents).toBe('none')
  }

  await act(async () => {
    emitDoc('settings/theme', { theme: 'atual' })
  })
  expect(document.querySelector('[data-theme-ornament]')).toBeNull()
  expect(document.querySelector('[data-fall-kind]')).toBeNull()
  expect(document.documentElement).toHaveAttribute('data-theme', 'atual')
  expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(11, 11, 10)')
})

it('decorates the opening screen with the confirmed theme', async () => {
  render(
    <AuthProvider>
      <ThemeFrame>
        <Splash onDone={() => {}} ready={false} />
      </ThemeFrame>
    </AuthProvider>,
  )
  await waitFor(() => expect(activeListeners('settings/theme')).toHaveLength(1))
  expect(screen.getByText('Preparando a chapa')).toBeInTheDocument()

  await act(async () => {
    emitDoc('settings/theme', { theme: 'natal' })
  })
  expect(document.documentElement).toHaveAttribute('data-theme', 'natal')
  expect(document.querySelector('[data-theme-snow] .theme-snow__flake--thin')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-tree] img')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-bg="natal"]')).toBeInTheDocument()
  expectNoThemeWash(getComputedStyle(document.querySelector('[data-theme-bg="natal"]')!))
  expect(getComputedStyle(screen.getByRole('status')).backgroundColor).toBe('rgb(18, 18, 20)')
  expect(getComputedStyle(document.querySelector('.fire')!).display).not.toBe('none')
  expect(document.querySelectorAll('[data-theme-fall] .theme-piece')).toHaveLength(8)
  const splashKinds = new Set(
    [...document.querySelectorAll('[data-theme-ornament="natal"] [data-fall-kind]')].map((node) => node.getAttribute('data-fall-kind')),
  )
  expect(splashKinds.size).toBeGreaterThan(1)
  await act(async () => {
    emitDoc('settings/theme', { theme: 'sao-joao' })
  })
  expect(document.querySelector('[data-theme-flags]')).toBeNull()
  expect(document.querySelector('.theme-flags')).toBeNull()
  expect(document.querySelectorAll('[data-theme-ornament="sao-joao"] [data-theme-pin]').length).toBeGreaterThan(2)
})
