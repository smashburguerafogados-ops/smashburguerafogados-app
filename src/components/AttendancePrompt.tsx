import { useAuth } from '../context/AuthContext'
import { BUSINESS_NAME, BUSINESS_WHATSAPP, attendanceMessage, openWhatsapp } from '../lib/whatsapp'
import { Overlay } from './Overlay'

type AttendancePromptProps = {
  onClose: () => void
}

export function AttendancePrompt({ onClose }: AttendancePromptProps) {
  const { session } = useAuth()
  const name = session.status === 'ready' ? session.profile.nome : ''

  function talk() {
    openWhatsapp(BUSINESS_WHATSAPP, attendanceMessage(name))
    onClose()
  }

  return (
    <Overlay label="Atendimento" onClose={onClose} variant="popup">
      <h2>Atendimento</h2>
      <p>Deseja falar com o Atendimento da {BUSINESS_NAME}?</p>
      <div className="actions">
        <button type="button" className="btn" onClick={talk}>
          Sim
        </button>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Não
        </button>
      </div>
    </Overlay>
  )
}
