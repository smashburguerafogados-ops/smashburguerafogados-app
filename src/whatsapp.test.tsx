import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Order } from './lib/orders'
import {
  BUSINESS_WHATSAPP,
  SAFE_SYMBOLS,
  SYMBOLS,
  acceptedMessage,
  attendanceMessage,
  broadcastMessage,
  cancelledMessage,
  isAndroidDevice,
  openWhatsapp,
  page,
  refusedMessage,
  sanitizeMessage,
  sentMessage,
  whatsappUrl,
} from './lib/whatsapp'
import { firebaseMocks } from './test/mocks'
import { customerProfile, makeOrder, renderApp, signInAs } from './test/render'

const order = { ...makeOrder(), id: 'pedido-00001' } as unknown as Order

const messages: Record<string, string> = {
  aceito: acceptedMessage(order),
  recusado: refusedMessage(order, 'Fora da área'),
  enviado: sentMessage(order),
  cancelado: cancelledMessage(order, 'Acabou o pão'),
  atendimento: attendanceMessage('Ana Souza'),
  atendimentoSemNome: attendanceMessage(''),
}

/** Accented Portuguese letters and plain punctuation that every phone renders. */
const TEXT_CHARS = /[\p{Script=Latin}\p{N}\s.,:;!?()'"/%&+\-–|#@=_]/u

function symbolsIn(text: string): string[] {
  return Array.from(text).filter((char) => !TEXT_CHARS.test(char) && char.codePointAt(0)! > 0x7e)
}

describe('WhatsApp messages', () => {
  it('uses wa.me links with the text encoded', () => {
    const url = whatsappUrl('55 (87) 98888-7777', 'Olá, Ana! ✅')
    expect(url.startsWith('https://wa.me/5587988887777?text=')).toBe(true)
    expect(decodeURIComponent(url.split('?text=')[1])).toBe('Olá, Ana! ✅')
    expect(whatsappUrl('5500000000000')).toBe('https://wa.me/5500000000000')
  })

  it('uses the shop number +55 87 9661-9629', () => {
    expect(BUSINESS_WHATSAPP).toBe('558796619629')
    expect(whatsappUrl(BUSINESS_WHATSAPP)).toBe('https://wa.me/558796619629')
  })

  it('puts the Smash icon in front of a broadcast', () => {
    expect(broadcastMessage('Hoje tem combo')).toBe(`${SYMBOLS.burger} Hoje tem combo`)
  })

  it('strips broken characters, joiners and variation selectors before sending', () => {
    expect(sanitizeMessage('Ok\uFFFD \u2705\uFE0F\n\n\n\nfim\u200D')).toBe('Ok \u2705\n\nfim')
  })

  it.each(Object.entries(messages))('%s message carries symbols that render on iPhone and Android', (_, text) => {
    const symbols = symbolsIn(text)
    expect(symbols.length).toBeGreaterThan(0)
    for (const symbol of symbols) expect(SAFE_SYMBOLS).toContain(symbol)
    expect(text).not.toMatch(/[\uFE0E\uFE0F\u200D\uFFFD]/)
    for (const symbol of SAFE_SYMBOLS) expect(Array.from(symbol)).toHaveLength(1)
    expect(sanitizeMessage(text)).toBe(text)
  })

  it('keeps the delivery fee on a delivery message and leaves it off a pickup', () => {
    const pickup = { ...order, fulfillment: 'retirada' as const, address: null, deliveryFeeCents: 0 }
    expect(acceptedMessage(order)).toContain('Taxa de entrega')
    expect(sentMessage(order)).toContain('Taxa de entrega')
    expect(sentMessage(order)).toContain('saiu para entrega')
    expect(acceptedMessage(pickup)).not.toContain('Taxa de entrega')
    expect(sentMessage(pickup)).not.toContain('Taxa de entrega')
    expect(sentMessage(pickup)).toContain('está pronto para retirada')
    expect(sentMessage(pickup)).not.toContain('saiu para entrega')
  })

  it('sentMessage lists the items without any photo or product link', () => {
    const text = sentMessage(order)
    expect(text).not.toMatch(/Foto|produto=|https?:\/\//)
    const lines = text.split('\n')
    expect(lines.filter((line) => line.startsWith(`${SYMBOLS.burger} `) && / - R\$ /.test(line)).length).toBe(order.items.length)
    expect(lines[lines.length - 1]).toBe(`${SYMBOLS.scooter} A entrega está a caminho!`)
  })

  it('names the Smash Burger in every customer message', () => {
    for (const text of Object.values(messages)) expect(text).toContain('Smash Burger')
  })

  it('opens Atendimento only after Sim, with the registered customer name', async () => {
    signInAs(customerProfile)
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'WhatsApp' }))
    let prompt = screen.getByRole('dialog', { name: 'Atendimento' })
    expect(prompt).toHaveTextContent('Deseja falar com o Atendimento da Smash Burger?')
    await user.click(within(prompt).getByRole('button', { name: 'Não' }))
    expect(screen.queryByRole('dialog', { name: 'Atendimento' })).not.toBeInTheDocument()
    expect(window.open).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'WhatsApp' }))
    prompt = screen.getByRole('dialog', { name: 'Atendimento' })
    await user.click(within(prompt).getByRole('button', { name: 'Sim' }))

    const url = String(vi.mocked(window.open).mock.calls[0][0])
    expect(url.startsWith(`https://wa.me/${BUSINESS_WHATSAPP}?text=`)).toBe(true)
    const text = decodeURIComponent(url.split('?text=')[1])
    expect(text).toBe(attendanceMessage('Ana Souza'))
    expect(text.startsWith(`${SYMBOLS.wave} Olá, Atendimento da Smash Burger! Aqui é Ana Souza.`)).toBe(true)
    expect(text).toContain('\u{1F44B}')
  })

  it('leaves the name out when the customer has none saved', () => {
    const text = attendanceMessage('   ')
    expect(text).toBe(
      `${SYMBOLS.wave} Olá, Atendimento da Smash Burger!\n${SYMBOLS.burger} Vim pelo cardápio.\n${SYMBOLS.chat} Gostaria de falar com vocês.`,
    )
    expect(text).not.toMatch(/Aqui é|Cliente|Visitante/)
  })

  it('opens the WhatsApp app on Android with the customer name, and keeps wa.me on iPhone', () => {
    const agent = vi.spyOn(window.navigator, 'userAgent', 'get')
    const assign = vi.spyOn(page, 'assign').mockImplementation(() => undefined)

    agent.mockReturnValue('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile')
    expect(isAndroidDevice()).toBe(true)
    const android = openWhatsapp(BUSINESS_WHATSAPP, attendanceMessage('Ana Souza'))
    expect(window.open).not.toHaveBeenCalled()
    expect(assign).toHaveBeenCalledWith(android)
    expect(android.startsWith('whatsapp://send?phone=558796619629&text=')).toBe(true)
    expect(android.startsWith('https://')).toBe(false)
    expect(decodeURIComponent(android.split('&text=')[1])).toContain('Aqui é Ana Souza.')

    vi.mocked(window.open).mockClear()
    assign.mockClear()
    agent.mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')
    expect(isAndroidDevice()).toBe(false)
    const iphone = openWhatsapp(BUSINESS_WHATSAPP, attendanceMessage('Ana Souza'))
    expect(iphone.startsWith('https://wa.me/558796619629?text=')).toBe(true)
    expect(String(vi.mocked(window.open).mock.calls[0][0])).toBe(iphone)
    expect(assign).not.toHaveBeenCalled()

    agent.mockRestore()
    assign.mockRestore()
  })

  it('routes every send point through lib/whatsapp', () => {
    const sources = import.meta.glob('./**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<
      string,
      string
    >
    const libs = import.meta.glob('./lib/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<
      string,
      string
    >
    const app = Object.entries({ ...sources, ...libs }).filter(([path]) => !path.includes('.test.') && !path.includes('/test/'))
    for (const [path, code] of app) {
      if (path === './lib/whatsapp.ts') continue
      expect(code, path).not.toContain('wa.me')
      expect(code, path).not.toContain('window.open')
    }
    const senders = app.filter(([, code]) => code.includes('openWhatsapp(')).map(([path]) => path).sort()
    expect(senders).toEqual([
      './components/AttendancePrompt.tsx',
      './components/BroadcastScreen.tsx',
      './components/ContactScreen.tsx',
      './components/OrderDialog.tsx',
      './lib/whatsapp.ts',
    ])
    const dialog = sources['./components/OrderDialog.tsx']
    for (const builder of ['acceptedMessage', 'refusedMessage', 'sentMessage', 'cancelledMessage']) {
      expect(dialog).toContain(`${builder}(order`)
    }
  })
})
