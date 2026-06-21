import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import BrandIcon from '../components/BrandIcon'
import AdminView from '../components/AdminView'

export default function AdminApp() {
  const { signOut } = useAuth()
  const { t } = useI18n()

  return (
    <div className="admin-app">
      <header className="admin-app-header">
        <div className="brand"><BrandIcon /> LanPlayer</div>
        <button className="logout-btn" onClick={signOut}>{t('sidebar.logout')}</button>
      </header>
      <main className="admin-app-content">
        <AdminView />
      </main>
    </div>
  )
}
