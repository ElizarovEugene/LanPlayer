import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User } from '../api/types'
import { getMe, logout } from '../api'

interface AuthContextValue {
  user: User | null
  setUser: (user: User | null) => void
  signIn: () => Promise<void>
  signOut: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const signIn = async () => {
    const me = await getMe()
    setUser(me)
  }

  const signOut = () => {
    logout().catch(() => {})
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
