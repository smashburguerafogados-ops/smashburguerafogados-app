import { act, render, screen, waitFor, within } from '@testing-library/react'
import './index.css'
import './griddle.css'
import './menu.css'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { Splash } from './components/Splash'
import { ThemeFrame } from './components/ThemeMark'
import { activeListeners, emitDoc, firebaseMocks } from './test/mocks'
import { adminProfile, renderApp, signInAs } from './test/render'

afterEach(() => {
  delete document.documentElement.dataset.theme
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
  expect(document.querySelector('[data-theme-tree] svg')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-ball] svg')).toBeInTheDocument()
  expect(getComputedStyle(document.querySelector('[data-theme-snow]')!).pointerEvents).toBe('none')
  expect(getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()).toBe('#f2d27a')
  expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Temas' })).not.toBeInTheDocument()

  await act(async () => {
    emitDoc('settings/theme', { theme: 'ano-novo' })
  })
  expect(document.querySelector('[data-theme-snow]')).toBeNull()
  expect(document.querySelector('[data-theme-sparks] svg')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-year]')?.textContent).toMatch(/\d{4}/)

  await act(async () => {
    emitDoc('settings/theme', { theme: 'carnaval' })
  })
  expect(document.querySelector('[data-theme-confetti] svg')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-mask] svg')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-flag] svg')).toBeInTheDocument()

  await act(async () => {
    emitDoc('settings/theme', { theme: 'pascoa' })
  })
  expect(document.querySelector('[data-theme-egg] svg')).toBeInTheDocument()
  expect(document.querySelector('[data-theme-bunny] svg')).toBeInTheDocument()

  await act(async () => {
    emitDoc('settings/theme', { theme: 'sao-joao' })
  })
  expect(document.querySelectorAll('[data-theme-flags] svg').length).toBeGreaterThan(1)
  expect(document.querySelector('[data-theme-glow]')).toBeInTheDocument()

  await act(async () => {
    emitDoc('settings/theme', { theme: 'atual' })
  })
  expect(document.querySelector('[data-theme-ornament]')).toBeNull()
  expect(document.documentElement).toHaveAttribute('data-theme', 'atual')
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
  expect(document.querySelector('[data-theme-tree] svg')).toBeInTheDocument()
})
