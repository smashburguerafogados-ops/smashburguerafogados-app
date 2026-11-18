import { useCallback, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './components/AdminRoute'
import { MenuScreen } from './components/MenuScreen'
import { Splash } from './components/Splash'
import { AuthProvider } from './context/AuthContext'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

function AppRoutes() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<MenuScreen />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export function App() {
  const [booting, setBooting] = useState(true)
  const finishBoot = useCallback(() => setBooting(false), [])

  return <AuthProvider>{booting ? <Splash onDone={finishBoot} /> : <AppRoutes />}</AuthProvider>
}
