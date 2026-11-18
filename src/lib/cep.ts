export type ViaCepAddress = {
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
}

type ViaCepPayload = {
  erro?: boolean | string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

export async function lookupCep(cep: string, signal?: AbortSignal): Promise<ViaCepAddress | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) {
    throw new Error('CEP inválido')
  }

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal })
  if (!response.ok) {
    throw new Error('Falha ao consultar o CEP')
  }

  const data = (await response.json()) as ViaCepPayload
  if (data.erro === true || data.erro === 'true') return null
  if (!data.localidade && !data.logradouro) return null

  return {
    cep: digits,
    street: (data.logradouro ?? '').trim(),
    neighborhood: (data.bairro ?? '').trim(),
    city: (data.localidade ?? '').trim(),
    state: (data.uf ?? '').trim(),
  }
}
