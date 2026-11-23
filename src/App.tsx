import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Griddle } from './components/Griddle'
import { MenuScreen } from './components/MenuScreen'
import { Splash } from './components/Splash'
import { CustomerTheme, ThemeFrame } from './components/ThemeMark'
import { RaffleProvider } from './components/RaffleProvider'
import { UpdateNotice } from './components/UpdateNotice'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OrdersProvider, useBootReady } from './context/OrdersContext'
import { lastCatalogWasLight, prefetchRemoteCatalog } from './lib/remoteCatalog'

const AdminRoute = lazy(() => import('./components/AdminRoute').then((module) => ({ default: module.AdminRoute })))

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

function AppRoutes() {
  return (
    <BrowserRouter basename={basename}>
      <CustomerTheme>
        <Routes>
          <Route path="/" element={<MenuScreen />} />
          <Route
            path="/admin"
            element={
              <Suspense fallback={<p className="muted admin-loading" role="status">Abrindo o painel.</p>}>
                <AdminRoute />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CustomerTheme>
    </BrowserRouter>
  )
}

function Boot() {
  const ready = useBootReady()
  const { session } = useAuth()
  const [booting, setBooting] = useState(true)
  const finishBoot = useCallback(() => setBooting(false), [])

  useEffect(() => {
    if (/\/admin\/?$/.test(window.location.pathname) || !lastCatalogWasLight()) return
    return prefetchRemoteCatalog()
  }, [])

  if (session.status === 'blocked') return <Splash locked ready={false} onDone={finishBoot} />

  return booting ? <Splash ready={ready} onDone={finishBoot} /> : <AppRoutes />
}

export function App() {
  return (
    <>
      <Griddle />
      <UpdateNotice />
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
