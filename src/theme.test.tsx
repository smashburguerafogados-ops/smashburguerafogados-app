import { act, screen, waitFor, within } from '@testing-library/react'
import './index.css'
import './griddle.css'
import './menu.css'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { activeListeners, emitDoc, firebaseMocks } from './test/mocks'
import { adminProfile, renderApp, signInAs } from './test/render'

it('keeps the current look until an admin confirms another theme', async () => {
  signInAs(adminProfile)
  const user = userEvent.setup()
  renderApp('/admin')
  await screen.findByRole('heading', { name: 'Painel' })
  await waitFor(() => expect(activeListeners('settings/theme')).toHaveLength(1))
  expect(document.documentElement).toHaveAttribute('data-theme', 'atual')
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
  expect(document.documentElement).toHaveAttribute('data-theme', 'atual')

  await user.click(carnaval)
  expect(carnaval).toBeChecked()
  expect(natal).not.toBeChecked()
  expect(within(sheet).getAllByRole('radio').filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(1)
  expect(document.documentElement).toHaveAttribute('data-theme', 'atual')

  await user.click(within(sheet).getByRole('button', { name: 'Confirmar' }))
  expect(firebaseMocks.setDoc).toHaveBeenCalledWith({ path: 'settings/theme' }, { theme: 'carnaval' }, { merge: true })
  expect(document.documentElement).toHaveAttribute('data-theme', 'atual')

  await act(async () => {
    emitDoc('settings/theme', { theme: 'carnaval' })
  })
  expect(document.documentElement).toHaveAttribute('data-theme', 'carnaval')
  expect(document.querySelector('[data-theme-ornament="carnaval"]')).toBeInTheDocument()
  expect(getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()).toBe('#ffd23f')
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
  expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Temas' })).not.toBeInTheDocument()
})
