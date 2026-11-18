import { useCallback, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './components/AdminRoute'
import { Griddle } from './components/Griddle'
import { MenuScreen } from './components/MenuScreen'
import { Splash } from './components/Splash'
import { CustomerTheme, ThemeFrame } from './components/ThemeMark'
import { RaffleProvider } from './components/RaffleProvider'
import { AuthProvider } from './context/AuthContext'
import { OrdersProvider, useBootReady } from './context/OrdersContext'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

function AppRoutes() {
  return (
    <BrowserRouter basename={basename}>
      <CustomerTheme>
        <Routes>
          <Route path="/" element={<MenuScreen />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CustomerTheme>
    </BrowserRouter>
  )
}

function Boot() {
  const ready = useBootReady()
  const [booting, setBooting] = useState(true)
  const finishBoot = useCallback(() => setBooting(false), [])

  return booting ? <Splash ready={ready} onDone={finishBoot} /> : <AppRoutes />
}

export function App() {
  return (
    <>
      <Griddle />
      <AuthProvider>
        <ThemeFrame>
          <OrdersProvider>
            <RaffleProvider>
              <Boot />
            </RaffleProvider>
          </OrdersProvider>
        </ThemeFrame>
      </AuthProvider>
    </>
  )
}
