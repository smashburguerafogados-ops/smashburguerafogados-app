import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from './App'
import { FIRE_PLAYBACK_RATE } from './components/FireBackdrop'
import { Splash } from './components/Splash'

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
  expect(video?.playbackRate).toBe(FIRE_PLAYBACK_RATE)
  expect(FIRE_PLAYBACK_RATE).toBeLessThan(1)
  expect(container.querySelector('.grill__grate')).toBeNull()
  expect(container.querySelector('.grill__flame')).toBeNull()
  expect(screen.getByRole('img', { name: 'Smash Burguer' })).toBeInTheDocument()
})

it('leaves the splash on the menu, not a login wall', async () => {
  vi.useFakeTimers()
  render(<App />)

  await act(async () => {
    await vi.advanceTimersByTimeAsync(3200)
  })

  expect(screen.getByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Smash da casa/ })).toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Entrar' })).not.toBeInTheDocument()
})
