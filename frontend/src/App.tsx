import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { I18nProvider } from './i18n/I18nContext'
import { ThemeProvider } from './theme/ThemeContext'
import { PlayerProvider } from './player/PlayerContext'
import Login from './pages/Login'
import Library from './pages/Library'
import AdminApp from './pages/AdminApp'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <I18nProvider>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/*" element={<ProtectedRoute />} />
            </Routes>
          </I18nProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

function LoginRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <Login />
}

function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.is_admin) return <AdminApp />
  return (
    <PlayerProvider>
      <Library />
    </PlayerProvider>
  )
}
