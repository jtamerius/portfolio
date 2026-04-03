import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import AuthBar from './components/AuthBar'
import AppCard from './components/AppCard'
import SignInModal from './components/SignInModal'
import { APPS } from './config/apps'

/**
 * Determine whether the current user can access an app.
 *
 *  - Public apps are always accessible.
 *  - Protected apps require a signed-in user whose Cognito groups include
 *    the app's requiredGroup (or any protected app when requiredGroup is null).
 */
function isAppAccessible(app, user, groups) {
  if (app.isPublic) return true
  if (!user) return false
  if (!app.requiredGroup) return true
  return groups.includes(app.requiredGroup)
}

export default function App() {
  const { user, groups, isLoading, signIn, signOut } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)

  const hasProtectedApps = APPS.some((app) => !app.isPublic)

  const appsWithAccess = APPS.map((app) => ({
    ...app,
    isAccessible: isAppAccessible(app, user, groups),
  }))

  // ── Layout styles ──────────────────────────────────────────────────────────

  const pageStyle = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  }

  const mainStyle = {
    flex: 1,
    maxWidth: '960px',
    width: '100%',
    margin: '0 auto',
    padding: '40px 24px 64px',
  }

  const headingStyle = {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#111',
    marginBottom: '8px',
    letterSpacing: '-0.02em',
  }

  const subheadingStyle = {
    fontSize: '0.95rem',
    color: '#666',
    marginBottom: '32px',
  }

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '20px',
  }

  const bannerStyle = {
    marginTop: '32px',
    padding: '14px 18px',
    background: '#f0f4ff',
    border: '1px solid #c7d5f8',
    borderRadius: '8px',
    fontSize: '0.875rem',
    color: '#3451b2',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const loadingStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    fontSize: '0.9rem',
    color: '#888',
  }

  return (
    <div style={pageStyle}>
      <AuthBar
        user={user}
        onSignIn={() => setModalOpen(true)}
        onSignOut={signOut}
      />

      <main style={mainStyle}>
        <h1 style={headingStyle}>Available Tools</h1>
        <p style={subheadingStyle}>
          Select an app below to get started.
        </p>

        {isLoading ? (
          <div style={loadingStyle}>Loading&hellip;</div>
        ) : (
          <>
            <div style={gridStyle}>
              {appsWithAccess.map((app) => (
                <AppCard
                  key={app.id}
                  name={app.name}
                  description={app.description}
                  url={app.url}
                  isPublic={app.isPublic}
                  isAccessible={app.isAccessible}
                  requiredGroup={app.requiredGroup}
                />
              ))}
            </div>

            {!user && hasProtectedApps && (
              <div style={bannerStyle}>
                <span>🔐</span>
                <span>
                  <strong>Sign in to see more apps.</strong> Some tools are only
                  available to authenticated members.
                </span>
              </div>
            )}
          </>
        )}
      </main>

      <SignInModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSignIn={async (email, password) => {
          await signIn(email, password)
          setModalOpen(false)
        }}
      />
    </div>
  )
}
