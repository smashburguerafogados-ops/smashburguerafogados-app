import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLongPress } from '../lib/longPress'
import { AdminPrompt } from './AdminPrompt'
import { FireBackdrop } from './FireBackdrop'

type ClosedScreenProps = {
  message: string
}

export function ClosedScreen({ message }: ClosedScreenProps) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [adminOpen, setAdminOpen] = useState(false)
  const isAdmin = session.status === 'ready' && session.profile.role === 'admin'
  const hold = useLongPress(() => {
    if (isAdmin) {
      navigate('/admin')
      return
    }
    setAdminOpen(true)
  })

  return (
    <div className="splash closed" role="status">
      <FireBackdrop />
      <div className="splash__mark">
        <button type="button" className="closed__logo" aria-label="Smash Burguer" {...hold}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Smash Burguer" />
        </button>
      </div>
      <p className="closed__message">{message}</p>
      {adminOpen && <AdminPrompt onClose={() => setAdminOpen(false)} />}
    </div>
  )
}
