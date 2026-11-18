import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'
import { AuthScreen } from './components/AuthScreen'
import { Griddle } from './components/Griddle'
import { Shell } from './components/Shell'
import { StatusScreen } from './components/StatusScreen'
import { AuthProvider } from './context/AuthContext'
import './index.css'
import './menu.css'
import './griddle.css'
import griddleCss from './griddle.css?raw'

afterEach(() => {
  vi.useRealTimers()
})

function seconds(value: string): number {
  return Math.max(...value.split(',').map((part) => parseFloat(part)))
}

function zIndex(element: Element): number {
  return Number(getComputedStyle(element).zIndex)
}

describe('griddle background', () => {
  it('is present from the splash through the menu, once', async () => {
    vi.useFakeTimers()
    render(<App />)
    expect(screen.getAllByTestId('griddle')).toHaveLength(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2400)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(screen.getByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()
    expect(screen.getAllByTestId('griddle')).toHaveLength(1)
  })

  it('is a near-black fixed plate that never takes clicks', () => {
    render(<Griddle />)
    const griddle = screen.getByTestId('griddle')
    const style = getComputedStyle(griddle)
    expect(griddle).toHaveAttribute('aria-hidden', 'true')
    expect(style.position).toBe('fixed')
    expect(style.pointerEvents).toBe('none')
    expect(style.backgroundColor).toBe('rgb(11, 11, 10)')
    expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(11, 11, 10)')
    expect(griddle.querySelector('.griddle__plate')).not.toBeNull()
  })

  it('has one slow gold glow and embers only at the edges', () => {
    render(<Griddle />)
    const glow = document.querySelector('.griddle__glow') as HTMLElement
    const glowStyle = getComputedStyle(glow)
    expect(glowStyle.backgroundImage).toContain('rgba(227, 177, 90')
    expect(glowStyle.animationName).toBe('griddle-glow')
    expect(seconds(glowStyle.animationDuration)).toBeGreaterThanOrEqual(20)

    const embers = Array.from(document.querySelectorAll('.griddle__embers')) as HTMLElement[]
    expect(embers.map((node) => node.className.split('--')[1])).toEqual(['left', 'right', 'bottom'])
    for (const ember of embers) {
      expect(seconds(getComputedStyle(ember).animationDuration)).toBeGreaterThanOrEqual(8)
    }

    const left = getComputedStyle(embers[0])
    expect(left.left).toBe('0px')
    expect(left.maxWidth).toBe('140px')
    const bottom = getComputedStyle(embers[2])
    expect(bottom.bottom).toBe('0px')
    expect(parseFloat(bottom.height)).toBeLessThanOrEqual(window.innerHeight * 0.2)
    expect(griddleCss).toMatch(/\.griddle__embers--left\s*\{[^}]*mask-image:\s*linear-gradient\(to right, #000 0%, transparent 100%\)/)
    expect(griddleCss).toMatch(/\.griddle__embers--bottom\s*\{[^}]*mask-image:\s*linear-gradient\(to top, #000 0%, transparent 100%\)/)
  })

  it('does not bring back the fast fire', () => {
    render(<Griddle />)
    expect(document.querySelector('video, .fire, .grill__flame, .grill__grate, .grill__ember')).toBeNull()
    const durations = [...griddleCss.matchAll(/animation:\s*[\w-]+\s+([\d.]+)s/g)].map((match) => Number(match[1]))
    expect(durations.length).toBeGreaterThan(0)
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(8)
  })

  it('keeps every screen transparent and above it so text stays readable', () => {
    render(
      <>
        <Griddle />
        <MemoryRouter>
          <AuthProvider>
            <Shell onLogout={() => {}}>
              <section className="card">
                <h1>Painel</h1>
              </section>
            </Shell>
            <StatusScreen title="Carregando" />
            <AuthScreen />
          </AuthProvider>
        </MemoryRouter>
      </>,
    )
    const base = zIndex(screen.getByTestId('griddle'))
    const shell = document.querySelector('.shell') as HTMLElement
    const stages = Array.from(document.querySelectorAll('.stage')) as HTMLElement[]
    expect(stages).toHaveLength(2)
    for (const root of [shell, ...stages]) {
      expect(getComputedStyle(root).backgroundColor).toBe('rgba(0, 0, 0, 0)')
      expect(getComputedStyle(root).position).toBe('relative')
      expect(zIndex(root)).toBeGreaterThan(base)
    }
    for (const card of Array.from(document.querySelectorAll('.card'))) {
      expect(getComputedStyle(card).backgroundColor).toBe('rgb(20, 20, 22)')
    }
    expect(getComputedStyle(document.querySelector('.topbar') as HTMLElement).backgroundColor).toBe(
      'rgba(11, 11, 10, 0.92)',
    )
    expect(document.querySelector('video')).toBeNull()
  })
})
