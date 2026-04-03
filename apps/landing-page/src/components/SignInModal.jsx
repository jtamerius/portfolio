import { useState, useEffect, useRef } from 'react'

/**
 * SignInModal
 *
 * A modal dialog for signing in via AWS Cognito.
 *
 * Props:
 *   isOpen   {boolean}  - Controls visibility
 *   onClose  {function} - Called when the modal should close
 *   onSignIn {function} - async (email, password) => void — called on submit;
 *                         should throw an Error with a human-readable message
 *                         on failure
 */
export default function SignInModal({ isOpen, onClose, onSignIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emailRef = useRef(null)

  // Focus the email input whenever the modal opens and reset form state.
  useEffect(() => {
    if (isOpen) {
      setEmail('')
      setPassword('')
      setError(null)
      setIsSubmitting(false)
      // Small delay so the element is visible before focus
      setTimeout(() => emailRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onSignIn(email.trim(), password)
    } catch (err) {
      setError(err.message ?? 'Sign in failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  if (!isOpen) return null

  // ── Styles ─────────────────────────────────────────────────────────────────

  const backdropStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  }

  const dialogStyle = {
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    width: '100%',
    maxWidth: '400px',
    padding: '32px 28px 28px',
    position: 'relative',
  }

  const closeBtnStyle = {
    position: 'absolute',
    top: '14px',
    right: '14px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#888',
    fontSize: '1.1rem',
    lineHeight: 1,
    padding: '4px 6px',
    borderRadius: '4px',
  }

  const titleStyle = {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#111',
    marginBottom: '6px',
    letterSpacing: '-0.02em',
  }

  const subtitleStyle = {
    fontSize: '0.875rem',
    color: '#666',
    marginBottom: '24px',
  }

  const fieldGroupStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginBottom: '20px',
  }

  const labelStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#333',
  }

  const inputStyle = {
    padding: '9px 12px',
    borderRadius: '6px',
    border: '1px solid #d0d0d0',
    fontSize: '0.9rem',
    color: '#111',
    outline: 'none',
    transition: 'border-color 0.15s ease',
    background: '#fafafa',
  }

  const errorStyle = {
    background: '#fff0f0',
    border: '1px solid #fca5a5',
    borderRadius: '6px',
    padding: '10px 12px',
    fontSize: '0.85rem',
    color: '#b91c1c',
    marginBottom: '16px',
    lineHeight: 1.4,
  }

  const submitBtnStyle = {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: 'none',
    background: isSubmitting ? '#555' : '#111',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: isSubmitting ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s ease',
    marginBottom: '16px',
  }

  const forgotStyle = {
    display: 'block',
    textAlign: 'center',
    fontSize: '0.8rem',
    color: '#888',
    cursor: 'default',
    userSelect: 'none',
  }

  return (
    <div style={backdropStyle} onClick={handleBackdropClick} aria-modal="true" role="dialog" aria-labelledby="signin-title">
      <div style={dialogStyle}>
        <button
          style={closeBtnStyle}
          onClick={onClose}
          aria-label="Close sign in dialog"
          type="button"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
        >
          ✕
        </button>

        <h2 id="signin-title" style={titleStyle}>Sign in</h2>
        <p style={subtitleStyle}>Access your Internal Tools account.</p>

        {error && (
          <div style={errorStyle} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>
              Email
              <input
                ref={emailRef}
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="you@example.com"
                disabled={isSubmitting}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#111' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#d0d0d0' }}
              />
            </label>

            <label style={labelStyle}>
              Password
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                disabled={isSubmitting}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#111' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#d0d0d0' }}
              />
            </label>
          </div>

          <button
            style={submitBtnStyle}
            type="submit"
            disabled={isSubmitting || !email || !password}
            onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = '#333' }}
            onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.background = '#111' }}
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Placeholder — wire up to a real reset flow when available */}
        <span style={forgotStyle}>
          Forgot password? Contact an administrator.
        </span>
      </div>
    </div>
  )
}
