import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdateNotice } from './components/UpdateNotice'
import { APP_VERSION, VERSION_CHECK_MS } from './lib/appVersion'
import { keepListening, RETRY_MS } from './lib/listen'
import { activeListeners, emit } from './test/mocks'
import { customerProfile, makeOrder, renderApp, signInAs } from './test/render'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('keepListening', () => {
  it('opens the listener again after Firestore closes it with an error', () => {
    vi.useFakeTimers()
    const fails: Array<() => void> = []
    const stops: Array<ReturnType<typeof vi.fn>> = []
    const open = vi.fn((fail: () => void) => {
      fails.push(fail)
      const stop = vi.fn()
      stops.push(stop)
      return stop
    })
    const onError = vi.fn()

    const stop = keepListening(open, onError)
    expect(open).toHaveBeenCalledTimes(1)

    fails[0]()
    expect(onError).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(RETRY_MS[0] - 1)
    expect(open).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(open).toHaveBeenCalledTimes(2)

    fails[1]()
    vi.advanceTimersByTime(RETRY_MS[1])
    expect(open).toHaveBeenCalledTimes(3)

    stop()
    expect(stops[2]).toHaveBeenCalled()
    fails[2]()
    vi.advanceTimersByTime(RETRY_MS[RETRY_MS.length - 1])
    expect(open).toHaveBeenCalledTimes(3)
  })

  it('does not reopen after the screen stops listening', () => {
    vi.useFakeTimers()
    let fail = () => {}
    const open = vi.fn((next: () => void) => {
      fail = next
      return () => undefined
    })
    const stop = keepListening(open, () => undefined)
    fail()
    stop()
    vi.advanceTimersByTime(RETRY_MS[RETRY_MS.length - 1])
    expect(open).toHaveBeenCalledTimes(1)
  })
})

describe('customer orders listener', () => {
  it('comes back after Firestore closes it, so the order status keeps updating', async () => {
    signInAs(customerProfile)
    renderApp()
    await waitFor(() => expect(activeListeners('orders')).toHaveLength(1))
    const [first] = activeListeners('orders')

    vi.useFakeTimers()
    act(() => {
      first.error?.({ code: 'permission-denied' })
    })
    act(() => {
      vi.advanceTimersByTime(RETRY_MS[0])
    })
    vi.useRealTimers()

    const open = activeListeners('orders')
    expect(open).toHaveLength(1)
    expect(open[0]).not.toBe(first)
    act(() => {
      emit('orders', [makeOrder({ status: 'andamento' })])
    })
    expect(screen.getByRole('button', { name: 'Meus pedidos' })).toHaveClass('dock__item--live')
  })
})

function serve(version: string) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ version }) }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('UpdateNotice', () => {
  it('stays hidden while the deployed version is the one running', async () => {
    const fetchMock = serve(APP_VERSION)
    render(<UpdateNotice enabled />)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('version.json'), { cache: 'no-store' })
    expect(screen.queryByRole('region', { name: 'Nova versão' })).not.toBeInTheDocument()
  })

  it('offers the new version when the tab comes back after a deploy', async () => {
    serve('outra-versao')
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    render(<UpdateNotice enabled />)
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(await screen.findByRole('region', { name: 'Nova versão' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(reload).toHaveBeenCalled()
  })

  it('checks again every few minutes and can be dismissed', async () => {
    vi.useFakeTimers()
    serve('outra-versao')
    render(<UpdateNotice enabled />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS)
    })
    expect(screen.getByRole('region', { name: 'Nova versão' })).toBeInTheDocument()
    vi.useRealTimers()
    await userEvent.click(screen.getByRole('button', { name: 'Agora não' }))
    expect(screen.queryByRole('region', { name: 'Nova versão' })).not.toBeInTheDocument()
  })

  it('does nothing outside the published build', async () => {
    const fetchMock = serve('outra-versao')
    render(<UpdateNotice />)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
