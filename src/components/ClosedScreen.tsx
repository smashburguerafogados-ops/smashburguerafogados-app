import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLongPress } from '../lib/longPress'
import { AdminPrompt } from './AdminPrompt'
import { FireBackdrop } from './FireBackdrop'
import { ShopStatus } from './ShopStatus'

type ClosedScreenProps = {
  message: string
  hours?: string
}

export function ClosedScreen({ message, hours = '' }: ClosedScreenProps) {
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
        <button type="button" className="closed__logo" aria-label="Smash Burger" {...hold}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Smash Burger" />
        </button>
      </div>
      <ShopStatus online={false} hours={hours} />
      <p className="closed__message">{message}</p>
      {adminOpen && <AdminPrompt onClose={() => setAdminOpen(false)} />}
    </div>
  )
}
