import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canPlaceOrder,
  cashDigits,
  cashToCents,
  changeCents,
  checkoutProblem,
  type CheckoutState,
} from './lib/checkout'
import { joinPhone, phoneRest } from './lib/delivery'
import { firebaseMocks } from './test/mocks'
import { customerProfile, renderApp, signInAs } from './test/render'
import './index.css'
import './menu.css'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('telefone 87 9', () => {
  it('joins the prefix and what they typed into one number', () => {
    expect(joinPhone('88887777')).toBe('5587988887777')
    expect(joinPhone('8888-7777')).toBe('5587988887777')
    expect(joinPhone('8888777')).toBeNull()
    expect(phoneRest('5587988887777')).toBe('88887777')
  })
})

describe('troco math', () => {
  it('keeps only digits in the cash field', () => {
    expect(cashDigits('5a0')).toBe('50')
    expect(cashDigits('R$ 100,00')).toBe('10000')
    expect(cashDigits('-20')).toBe('20')
    expect(cashDigits('abc')).toBe('')
    expect(cashDigits('0050')).toBe('50')
    expect(cashDigits('12345678')).toBe('123456')
  })

  it('reads cash in whole reais and computes cash minus total', () => {
    expect(cashToCents('')).toBeNull()
    expect(cashToCents('50')).toBe(5000)
    expect(changeCents(5000, 2800)).toBe(2200)
    expect(changeCents(5000, 4450)).toBe(550)
    expect(changeCents(2800, 2800)).toBe(0)
    expect(changeCents(2000, 2800)).toBe(-800)
    expect(changeCents(null, 2800)).toBeNull()
  })

  it('enables Fazer Pedido only for a valid payment choice', () => {
    const total = 4400
    const cases: [CheckoutState, boolean][] = [
      [{ method: null, needsChange: null, cash: '' }, false],
      [{ method: 'pix', needsChange: null, cash: '' }, true],
      [{ method: 'cartao', needsChange: null, cash: '' }, true],
      [{ method: 'dinheiro', needsChange: null, cash: '' }, false],
      [{ method: 'dinheiro', needsChange: 'nao', cash: '' }, true],
      [{ method: 'dinheiro', needsChange: 'sim', cash: '' }, false],
      [{ method: 'dinheiro', needsChange: 'sim', cash: '40' }, false],
      [{ method: 'dinheiro', needsChange: 'sim', cash: '44' }, false],
      [{ method: 'dinheiro', needsChange: 'sim', cash: '45' }, true],
      [{ method: 'dinheiro', needsChange: 'sim', cash: '100' }, true],
    ]
    for (const [state, expected] of cases) {
      expect(canPlaceOrder(state, total, 2), JSON.stringify(state)).toBe(expected)
    }
    expect(canPlaceOrder({ method: 'pix', needsChange: null, cash: '' }, 0, 0)).toBe(false)
    expect(checkoutProblem({ method: 'dinheiro', needsChange: 'sim', cash: '44' }, total, 2)).toBe(
      'O valor em dinheiro precisa ser maior que o total.',
    )
  })
})

async function addToCart(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole('button', { name }))
  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }))
}

function dock() {
  return screen.getByRole('navigation', { name: 'Atalhos' })
}

describe('cart and checkout', () => {
  it('updates the bar total the moment a product is added', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(dock().querySelector('.dock__sum')).toHaveTextContent('R$ 0,00')
    await addToCart(user, /Smash da casa/)
    expect(dock().querySelector('.dock__sum')).toHaveTextContent('R$ 28,00')
    expect(dock().querySelector('.dock__count')).toHaveTextContent('1')
    await addToCart(user, /Batata rústica/)
    expect(dock().querySelector('.dock__sum')).toHaveTextContent('R$ 44,00')
    expect(dock().querySelector('.dock__count')).toHaveTextContent('2')
  })

  it('lists each item price and the total, then asks for payment with a red notice', async () => {
    const user = userEvent.setup()
    renderApp()
    await addToCart(user, /Smash da casa/)
    await addToCart(user, /Batata rústica/)
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))

    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    const rows = cart.querySelectorAll('.cart li')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Smash da casa')
    expect(rows[0]).toHaveTextContent('R$ 28,00')
    expect(rows[1]).toHaveTextContent('Batata rústica')
    expect(rows[1]).toHaveTextContent('R$ 16,00')
    expect(within(cart).getByTestId('cart-total')).toHaveTextContent('R$ 44,00')

    expect(within(cart).getByRole('group', { name: 'Forma de pagamento' })).toBeInTheDocument()
    expect(cart.querySelector('select')).toBeNull()
    const notice = within(cart).getByText('Os pagamentos são feitos ao entregador.')
    expect(getComputedStyle(notice).color).toBe('rgb(255, 59, 48)')
    expect(within(cart).getByRole('button', { name: 'Fazer Pedido' })).toBeDisabled()

    await user.click(within(cart).getByRole('radio', { name: 'Pix' }))
    expect(within(cart).getByRole('button', { name: 'Fazer Pedido' })).toBeEnabled()
    await user.click(within(cart).getByRole('radio', { name: 'Cartão' }))
    expect(within(cart).getByRole('button', { name: 'Fazer Pedido' })).toBeEnabled()
  })

  it('handles dinheiro: troco Sim needs a numeric amount above the total, Não enables at once', async () => {
    const user = userEvent.setup()
    renderApp()
    await addToCart(user, /Smash da casa/)
    await addToCart(user, /Batata rústica/)
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    const order = () => within(cart).getByRole('button', { name: 'Fazer Pedido' })

    await user.click(within(cart).getByRole('radio', { name: 'Dinheiro' }))
    expect(within(cart).getByRole('group', { name: 'Precisa de troco?' })).toBeInTheDocument()
    expect(order()).toBeDisabled()

    await user.click(within(cart).getByRole('radio', { name: 'Não' }))
    expect(within(cart).queryByRole('textbox', { name: /Valor em dinheiro/ })).not.toBeInTheDocument()
    expect(order()).toBeEnabled()

    await user.click(within(cart).getByRole('radio', { name: 'Sim' }))
    const cash = within(cart).getByRole('textbox', { name: /Valor em dinheiro/ })
    expect(cash).toHaveAttribute('inputmode', 'numeric')
    expect(order()).toBeDisabled()

    await user.type(cash, 'abc')
    expect(cash).toHaveValue('')

    await user.type(cash, '4')
    expect(cash).toHaveValue('4')
    expect(cart).toHaveTextContent('Informe um valor maior que R$ 44,00.')
    expect(order()).toBeDisabled()

    await user.type(cash, '4')
    expect(cash).toHaveValue('44')
    expect(cart).toHaveTextContent('Informe um valor maior que R$ 44,00.')
    expect(order()).toBeDisabled()

    await user.clear(cash)
    await user.type(cash, '5')
    expect(cart).toHaveTextContent('Informe um valor maior que R$ 44,00.')
    await user.type(cash, '0')
    expect(cash).toHaveValue('50')
    expect(cart).toHaveTextContent('Seu troco: R$ 6,00')
    expect(order()).toBeEnabled()

    await user.type(cash, ',x0')
    expect(cash).toHaveValue('500')
    expect(cart).toHaveTextContent('Seu troco: R$ 456,00')

    await user.type(cash, '0')
    expect(cash).toHaveValue('5.000')
    expect(cart).toHaveTextContent('Seu troco: R$ 4.956,00')
    expect(cash.parentElement?.querySelector('.money-join__prefix')).toHaveTextContent('R$')
  })

  it('saves the order in Firestore with the payment and troco, then clears the cart', async () => {
    signInAs(customerProfile)
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())

    await addToCart(user, /Smash da casa/)
    await addToCart(user, /Batata rústica/)
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    await user.click(within(cart).getByRole('radio', { name: 'Dinheiro' }))
    await user.click(within(cart).getByRole('radio', { name: 'Sim' }))
    await user.type(within(cart).getByRole('textbox', { name: /Valor em dinheiro/ }), '50')
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))

    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    expect(firebaseMocks.addDoc).toHaveBeenCalledTimes(1)
    const [ref, payload] = firebaseMocks.addDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>]
    expect(ref.path).toBe('orders')
    expect(payload).toMatchObject({
      customerId: 'cliente-1',
      customerName: 'Ana Souza',
      customerWhatsapp: '5587988887777',
      status: 'novo',
      reason: '',
      fulfillment: 'entrega',
      totalCents: 4400,
      payment: { method: 'dinheiro', needsChange: true, cashCents: 5000, changeCents: 600 },
    })
    expect(payload.items).toHaveLength(2)
    expect(payload.address).toMatchObject({ street: 'Rua das Flores', number: '120' })
    expect(dock().querySelector('.dock__count')).toHaveTextContent('0')
    expect(dock().querySelector('.dock__sum')).toHaveTextContent('R$ 0,00')
  })

  it('places a pickup order without asking for address', async () => {
    signInAs({ ...customerProfile, address: null })
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    await addToCart(user, /Smash da casa/)
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    await user.click(within(cart).getByRole('radio', { name: 'Retirada' }))
    expect(within(cart).getByText('Os pagamentos são feitos na retirada.')).toBeInTheDocument()
    await user.click(within(cart).getByRole('radio', { name: 'Pix' }))
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Dados para entrega' })).not.toBeInTheDocument()
    const [, payload] = firebaseMocks.addDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(payload).toMatchObject({
      fulfillment: 'retirada',
      customerName: 'Ana Souza',
      address: null,
    })
  })

  it('asks only for name and phone when pickup data is missing', async () => {
    signInAs({ ...customerProfile, nome: '', whatsapp: '', address: null })
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    await addToCart(user, /Smash da casa/)
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    await user.click(within(cart).getByRole('radio', { name: 'Retirada' }))
    await user.click(within(cart).getByRole('radio', { name: 'Pix' }))
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))
    const form = screen.getByRole('dialog', { name: 'Dados para retirada' })
    expect(within(form).getByText('Finalize seu cadastro.')).toBeInTheDocument()
    expect(within(form).queryByRole('textbox', { name: 'CEP' })).not.toBeInTheDocument()
    expect(firebaseMocks.signInWithEmailAndPassword).not.toHaveBeenCalled()
    await user.type(within(form).getByRole('textbox', { name: 'Nome' }), 'Ana Souza')
    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '88887777')
    await user.click(within(form).getByRole('button', { name: 'Salvar e pedir' }))
    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    expect(firebaseMocks.updateDoc).toHaveBeenCalledWith(
      { path: 'users/cliente-1' },
      { nome: 'Ana Souza', whatsapp: '5587988887777' },
    )
    const [, payload] = firebaseMocks.addDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(payload).toMatchObject({ fulfillment: 'retirada', address: null, customerName: 'Ana Souza' })
  })

  it('opens the delivery fields instead of Conta when the person is signed out', async () => {
    const user = userEvent.setup()
    renderApp()
    await addToCart(user, /Smash da casa/)
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    await user.click(within(cart).getByRole('radio', { name: 'Pix' }))
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))

    const form = screen.getByRole('dialog', { name: 'Dados para entrega' })
    const close = within(form).getByRole('button', { name: 'Fechar' })
    expect(close).toHaveClass('mark-btn')
    expect(close).not.toHaveTextContent('Fechar')
    expect(screen.queryByRole('dialog', { name: 'Conta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Entrar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Criar conta' })).not.toBeInTheDocument()
    expect(within(form).queryByRole('textbox', { name: 'Nome' })).not.toBeInTheDocument()
    expect(within(form).getByText('87 9')).toBeInTheDocument()
    expect(within(form).getByRole('textbox', { name: 'Telefone' })).toBeRequired()
    expect(within(form).queryByRole('textbox', { name: 'CEP' })).not.toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: 'Salvar e pedir' })).not.toBeInTheDocument()
    expect(firebaseMocks.addDoc).not.toHaveBeenCalled()
  })

  it('asks for nome, telefone and address instead of Conta when they are missing', async () => {
    signInAs({ ...customerProfile, nome: '', whatsapp: '', address: null })
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    await addToCart(user, /Smash da casa/)
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    const cart = screen.getByRole('dialog', { name: 'Carrinho' })
    await user.click(within(cart).getByRole('radio', { name: 'Pix' }))
    await user.click(within(cart).getByRole('button', { name: 'Fazer Pedido' }))

    const form = screen.getByRole('dialog', { name: 'Dados para entrega' })
    expect(screen.queryByRole('dialog', { name: 'Conta' })).not.toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
    expect(within(form).getByText('Finalize seu cadastro.')).toBeInTheDocument()
    expect(within(form).getByRole('textbox', { name: 'Telefone' })).toBeRequired()
    expect(within(form).getByRole('textbox', { name: 'CEP' })).toBeInTheDocument()
    expect(within(form).queryByRole('textbox', { name: 'Nome' })).not.toBeInTheDocument()
    expect(firebaseMocks.signInWithEmailAndPassword).not.toHaveBeenCalled()
    expect(firebaseMocks.addDoc).not.toHaveBeenCalled()
    expect(firebaseMocks.updateDoc).not.toHaveBeenCalled()
  })

  it('saves one full number and the ViaCEP address, then places the order', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input)
        if (!url.includes('https://viacep.com.br/ws/01001000/json')) throw new Error(`unexpected ${url}`)
        return {
          ok: true,
          json: async () => ({
            logradouro: 'Praça da Sé',
            bairro: 'Sé',
            localidade: 'São Paulo',
            uf: 'SP',
          }),
        }
      }),
    )
    signInAs({ ...customerProfile, nome: '', whatsapp: '', address: null })
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    await addToCart(user, /Smash da casa/)
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    await user.click(screen.getByRole('radio', { name: 'Pix' }))
    await user.click(screen.getByRole('button', { name: 'Fazer Pedido' }))

    const form = screen.getByRole('dialog', { name: 'Dados para entrega' })
    expect(within(form).getByText('Finalize seu cadastro.')).toBeInTheDocument()
    expect(firebaseMocks.signInWithEmailAndPassword).not.toHaveBeenCalled()
    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '88887777')
    await user.type(within(form).getByRole('textbox', { name: 'CEP' }), '01001000')
    await user.type(await within(form).findByRole('textbox', { name: 'Nome' }), 'João Lima')

    expect(await within(form).findByDisplayValue('Praça da Sé')).toBeInTheDocument()
    expect(within(form).getByDisplayValue('Sé')).toBeInTheDocument()
    expect(within(form).getByDisplayValue('São Paulo')).toBeInTheDocument()
    const number = within(form).getByRole('textbox', { name: 'Número' })
    expect(number).toHaveValue('')
    expect(number).toBeRequired()
    await user.type(number, '15')
    await user.click(within(form).getByRole('button', { name: 'Salvar e pedir' }))

    expect(await screen.findByText('Pedido enviado')).toBeInTheDocument()
    const [userRef, patch] = firebaseMocks.updateDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>]
    expect(userRef.path).toBe('users/cliente-1')
    expect(Object.keys(patch).sort()).toEqual(['address', 'nome', 'whatsapp'])
    expect(patch.whatsapp).toBe('5587988887777')
    expect(patch.address).toMatchObject({
      cep: '01001000',
      street: 'Praça da Sé',
      number: '15',
      neighborhood: 'Sé',
      city: 'São Paulo',
      state: 'SP',
    })
    const [, order] = firebaseMocks.addDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(order).toMatchObject({
      customerName: 'João Lima',
      customerWhatsapp: '5587988887777',
      address: { street: 'Praça da Sé', number: '15', neighborhood: 'Sé', city: 'São Paulo' },
    })
  })

  it('still requires endereço, bairro, cidade and número when the CEP is not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ erro: true }),
      })),
    )
    signInAs({ ...customerProfile, nome: 'João Lima', whatsapp: '', address: null })
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(firebaseMocks.getDoc).toHaveBeenCalled())
    await addToCart(user, /Smash da casa/)
    await user.click(screen.getByRole('button', { name: /^Carrinho,/ }))
    await user.click(screen.getByRole('radio', { name: 'Pix' }))
    await user.click(screen.getByRole('button', { name: 'Fazer Pedido' }))

    const form = screen.getByRole('dialog', { name: 'Dados para entrega' })
    await user.type(within(form).getByRole('textbox', { name: 'Telefone' }), '88887777')
    await user.type(within(form).getByRole('textbox', { name: 'CEP' }), '99999999')

    const street = await within(form).findByRole('textbox', { name: 'Endereço' })
    const neighborhood = within(form).getByRole('textbox', { name: 'Bairro' })
    const city = within(form).getByRole('textbox', { name: 'Cidade' })
    const number = within(form).getByRole('textbox', { name: 'Número' })
    expect(street).toHaveValue('')
    expect(neighborhood).toHaveValue('')
    expect(city).toHaveValue('')
    expect(number).toHaveValue('')
    expect(street).toBeRequired()
    expect(neighborhood).toBeRequired()
    expect(city).toBeRequired()
    expect(number).toBeRequired()
    expect(within(form).getByRole('textbox', { name: 'Ponto de referência (opcional)' })).not.toBeRequired()

    await user.click(within(form).getByRole('button', { name: 'Salvar e pedir' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('Preencha endereço, número, bairro e cidade.')
    expect(firebaseMocks.addDoc).not.toHaveBeenCalled()
    expect(firebaseMocks.updateDoc).not.toHaveBeenCalled()
  })
})
