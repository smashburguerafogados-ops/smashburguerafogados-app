export type Address = {
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  reference: string
}

export type UserRole = 'customer' | 'admin'

export type UserProfile = {
  uid: string
  nome: string
  whatsapp: string
  address: Address | null
  role: UserRole
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseAddress(value: unknown): Address | null {
  if (!value || typeof value !== 'object') return null
  const address = value as Record<string, unknown>
  const parsed: Address = {
    cep: asString(address.cep),
    street: asString(address.street),
    number: asString(address.number),
    neighborhood: asString(address.neighborhood),
    city: asString(address.city),
    state: asString(address.state),
    reference: asString(address.reference),
  }
  const hasAny = Object.values(parsed).some((part) => part.trim().length > 0)
  return hasAny ? parsed : null
}

export function parseProfile(uid: string, data: unknown): UserProfile | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (record.role !== 'customer' && record.role !== 'admin') return null
  if (typeof record.uid === 'string' && record.uid.length > 0 && record.uid !== uid) {
    return null
  }

  return {
    uid,
    nome: asString(record.nome).trim(),
    whatsapp: asString(record.whatsapp),
    address: parseAddress(record.address),
    role: record.role,
  }
}
