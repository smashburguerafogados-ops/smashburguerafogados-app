import { act, render, screen, waitFor, within } from '@testing-library/react'
import './index.css'
import './griddle.css'
import './menu.css'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import treeSvg from './assets/theme/christmas-tree.svg?raw'
import flagSvg from './assets/theme/flag-yellow.svg?raw'
import maskSvg from './assets/theme/performing-arts.svg?raw'
import { Splash } from './components/Splash'
import { ThemeFrame } from './components/ThemeMark'
import { activeListeners, emitDoc, firebaseMocks } from './test/mocks'
import { adminProfile, renderApp, signInAs } from './test/render'

afterEach(() => {
  delete document.documentElement.dataset.theme
})

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
  expect(natalBg.backgroundColor).toBe('rgb(0, 0, 0)')
  expect(natalBg.backgroundImage).toBe('none')
  expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(0, 0, 0)')
  expect(getComputedStyle(document.documentElement).backgroundColor).toBe('rgb(0, 0, 0)')
  expect(getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()).toBe('#d4af37')
  expect(getComputedStyle(document.documentElement).getPropertyValue('--theme-scene').trim()).toBe('snow-night')
  const search = screen.getByRole('searchbox', { name: 'Buscar' })
  expect(getComputedStyle(search).borderTopColor).toBe('rgb(255, 255, 255)')
  expect(getComputedStyle(search).borderTopWidth).toBe('1px')
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
  const carnivalColors = ['--gold', '--orange', '--theme-green', '--theme-blue', '--theme-yellow', '--theme-pink'].map((name) =>
    carnaval.getPropertyValue(name).trim().toLowerCase(),
  )
  expect(carnivalColors).toEqual(['#e6b325', '#ff4f9a', '#009c3b', '#2f6fed', '#ffe14d', '#ff4f9a'])
  expect(carnivalColors.join(' ')).not.toMatch(/c46bff|7c3aed|purple/)
  expect(carnaval.getPropertyValue('--theme-wash')).not.toMatch(/72,\s*8,\s*96|196,\s*107,\s*255/)
  expect(carnaval.getPropertyValue('--theme-scene').trim()).toBe('carnival-pattern')
  const carnivalBg = getComputedStyle(document.querySelector('[data-theme-bg="carnaval"]')!)
  expect(carnivalBg.backgroundColor).toBe('rgb(0, 0, 0)')
  expect(carnivalBg.backgroundImage).toBe('none')
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
  expect(document.querySelectorAll('[data-theme-flags] img').length).toBeGreaterThan(1)
  expect(document.querySelector('[data-theme-glow]')).toBeInTheDocument()
  expect(getComputedStyle(document.documentElement).getPropertyValue('--theme-scene').trim()).toBe('festa-junina')

  const scenes = ['natal', 'ano-novo', 'carnaval', 'pascoa', 'sao-joao']
  for (const theme of scenes) {
    await act(async () => {
      emitDoc('settings/theme', { theme })
    })
    const scene = document.querySelector(`[data-theme-bg="${theme}"]`)
    expect(scene).toBeInTheDocument()
    const sceneStyle = getComputedStyle(scene!)
    expect(sceneStyle.backgroundColor).toBe('rgb(0, 0, 0)')
    expect(sceneStyle.backgroundImage).toBe('none')
    expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(0, 0, 0)')
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
    <ThemeFrame>
      <Splash onDone={() => {}} ready={false} />
    </ThemeFrame>,
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
  expect(getComputedStyle(document.querySelector('[data-theme-bg="natal"]')!).backgroundColor).toBe('rgb(0, 0, 0)')
  expect(getComputedStyle(screen.getByRole('status')).backgroundColor).toBe('rgb(0, 0, 0)')
  expect(getComputedStyle(document.querySelector('.fire')!).display).toBe('none')
  const splashKinds = new Set(
    [...document.querySelectorAll('[data-theme-ornament="natal"] [data-fall-kind]')].map((node) => node.getAttribute('data-fall-kind')),
  )
  expect(splashKinds.size).toBeGreaterThan(1)
})
