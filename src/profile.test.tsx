import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { MenuScreen } from './components/MenuScreen'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('fills the street from ViaCEP and still requires the number', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo) => {
    const url = String(input)
    if (!url.includes('viacep.com.br/ws/01001000/json')) {
      throw new Error(`unexpected ${url}`)
    }
    return {
      ok: true,
      json: async () => ({
        logradouro: 'Praça da Sé',
        bairro: 'Sé',
        localidade: 'São Paulo',
        uf: 'SP',
      }),
    }
  })
  vi.stubGlobal('fetch', fetchMock)

  const user = userEvent.setup()
  render(
    <AuthProvider>
      <MemoryRouter>
        <MenuScreen />
      </MemoryRouter>
    </AuthProvider>,
  )

  await user.click(screen.getByRole('button', { name: 'Conta' }))
  await user.click(screen.getByRole('tab', { name: 'Criar conta' }))
  await user.type(screen.getByRole('textbox', { name: 'CEP' }), '01001000')

  expect(await screen.findByDisplayValue('Praça da Sé')).toBeInTheDocument()
  expect(screen.getByDisplayValue('Sé')).toBeInTheDocument()
  expect(screen.getByDisplayValue('São Paulo')).toBeInTheDocument()
  const number = screen.getByRole('textbox', { name: 'Número' })
  expect(number).toHaveValue('')
  expect(number).toBeRequired()
  expect(fetchMock).toHaveBeenCalled()
})
