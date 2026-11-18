import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Shell } from './Shell'
import { useAuth } from '../context/AuthContext'
import { formatCep, formatWhatsapp } from '../lib/identity'
import type { UserProfile } from '../types'

function useTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}

export function CustomerHome({ profile }: { profile: UserProfile }) {
  const { logout } = useAuth()
  useTitle('Conta | Smash Burguer')
  const first = profile.nome.split(' ')[0]
  const address = profile.address

  return (
    <Shell onLogout={() => void logout()}>
      <section className="card">
        <p className="eyebrow">Conta ativa</p>
        <h1>{first ? `Olá, ${first}` : 'Olá'}</h1>
        <dl className="details">
          {profile.nome && (
            <div>
              <dt>Nome</dt>
              <dd>{profile.nome}</dd>
            </div>
          )}
          {profile.whatsapp && (
            <div>
              <dt>WhatsApp</dt>
              <dd>{formatWhatsapp(profile.whatsapp)}</dd>
            </div>
          )}
          {address && (address.street || address.city) && (
            <div>
              <dt>Endereço</dt>
              <dd>
                {[address.street, address.number].filter(Boolean).join(', ')}
                <br />
                {[address.neighborhood, [address.city, address.state].filter(Boolean).join('/')]
                  .filter(Boolean)
                  .join(' · ')}
                {address.cep && (
                  <>
                    <br />
                    CEP {formatCep(address.cep)}
                  </>
                )}
                {address.reference && (
                  <>
                    <br />
                    Ref. {address.reference}
                  </>
                )}
              </dd>
            </div>
          )}
        </dl>
        {profile.role === 'admin' && (
          <Link className="btn" to="/admin">
            Painel
          </Link>
        )}
      </section>
    </Shell>
  )
}
