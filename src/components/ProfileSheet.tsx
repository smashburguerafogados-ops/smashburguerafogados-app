import { AuthScreen } from './AuthScreen'
import { Overlay } from './Overlay'
import { useAuth } from '../context/AuthContext'
import { formatCep, formatWhatsapp } from '../lib/identity'

type ProfileSheetProps = {
  onClose: () => void
}

export function ProfileSheet({ onClose }: ProfileSheetProps) {
  const { session, logout } = useAuth()

  return (
    <Overlay label="Conta" onClose={onClose}>
      <h2>Conta</h2>
      {session.status === 'loading' && <p className="muted">Conferindo a sessão.</p>}
      {session.status === 'error' && (
        <>
          <p role="alert">{session.message}</p>
          <button type="button" className="btn" onClick={() => void logout()}>
            Sair
          </button>
        </>
      )}
      {session.status === 'signedOut' && <AuthScreen embedded />}
      {session.status === 'ready' && (
        <>
          <dl className="details">
            {session.profile.nome && (
              <div>
                <dt>Nome</dt>
                <dd>{session.profile.nome}</dd>
              </div>
            )}
            {session.profile.whatsapp && (
              <div>
                <dt>WhatsApp</dt>
                <dd>{formatWhatsapp(session.profile.whatsapp)}</dd>
              </div>
            )}
            {session.profile.address && (
              <div>
                <dt>Endereço</dt>
                <dd>
                  {[session.profile.address.street, session.profile.address.number].filter(Boolean).join(', ')}
                  <br />
                  {[session.profile.address.neighborhood, session.profile.address.city].filter(Boolean).join(' · ')}
                  {session.profile.address.cep && (
                    <>
                      <br />
                      CEP {formatCep(session.profile.address.cep)}
                    </>
                  )}
                  {session.profile.address.reference && (
                    <>
                      <br />
                      Ref. {session.profile.address.reference}
                    </>
                  )}
                </dd>
              </div>
            )}
          </dl>
          <button type="button" className="btn" onClick={() => void logout()}>
            Sair
          </button>
        </>
      )}
    </Overlay>
  )
}
