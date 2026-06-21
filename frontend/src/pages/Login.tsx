import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import BrandIcon from '../components/BrandIcon'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { signIn } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(username, password)
      await signIn()
      navigate('/')
    } catch {
      setError(t('login.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <BrandIcon size={26} />
          LanPlayer
        </div>
        <form onSubmit={onSubmit}>
          {error && <div className="login-error">{error}</div>}
          <input
            placeholder={t('login.username')}
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
          />
          <input
            type="password"
            placeholder={t('login.password')}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button type="submit" disabled={busy}>{busy ? t('login.signing_in') : t('login.submit')}</button>
        </form>
      </div>
    </div>
  )
}
