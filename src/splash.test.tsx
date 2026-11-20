import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from './App'
import { FIRE_PLAYBACK_RATE } from './components/FireBackdrop'
import { Splash } from './components/Splash'
import { emitSeedCatalog } from './test/render'
import { emitDoc } from './test/mocks'

afterEach(() => {
  vi.useRealTimers()
})

it('plays the shipped fire loop and does not draw the old grill', () => {
  const onDone = vi.fn()
  const { container } = render(<Splash onDone={onDone} />)

  expect(screen.getByText('Preparando a chapa')).toBeInTheDocument()
  const video = container.querySelector('video')
  expect(video).not.toBeNull()
  const src = video?.getAttribute('src') ?? ''
  expect(src).toContain('fire.mp4')
  expect(src.startsWith('http://') || src.startsWith('https://')).toBe(false)
  expect(video?.playbackRate).toBe(0.25)
  expect(FIRE_PLAYBACK_RATE).toBe(0.25)
  expect(container.querySelector('.grill__grate')).toBeNull()
  expect(container.querySelector('.grill__flame')).toBeNull()
  expect(screen.getByRole('img', { name: 'Smash Burger' })).toBeInTheDocument()
})

it('leaves the splash on the menu, not a login wall', async () => {
  vi.useFakeTimers()
  render(<App />)

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2400)
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(700)
  })
  act(() => {
    emitSeedCatalog()
  })

  expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Smash da casa/ })).toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Entrar' })).not.toBeInTheDocument()
})

it('shows the real open state and hours and lets the customer enter before the hold ends', async () => {
  vi.useFakeTimers()
  const onDone = vi.fn()
  render(<Splash onDone={onDone} />)
  act(() => {
    emitDoc('settings/shop', { online: true, hours: '16h às 23h' })
  })
  expect(screen.getByText('Aberto agora')).toBeInTheDocument()
  expect(screen.getByText('16h às 23h')).toBeInTheDocument()

  act(() => {
    screen.getByRole('button', { name: /Entrar no cardápio/ }).click()
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(700)
  })
  expect(onDone).toHaveBeenCalledTimes(1)
})

it('marks the shop closed when the admin turned it off', () => {
  render(<Splash onDone={vi.fn()} />)
  act(() => {
    emitDoc('settings/shop', { online: false, hours: '16h às 23h' })
  })
  expect(screen.getByText('Fechado')).toBeInTheDocument()
  expect(screen.getByText('16h às 23h').closest('.shop-status')).toHaveClass('is-closed')
})
