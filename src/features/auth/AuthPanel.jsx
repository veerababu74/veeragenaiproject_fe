import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react'
import { api } from '../../lib/api'
import './AuthPanel.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD

export default function AuthPanel({ onAuthenticated, onViewChange, initialView = 'login' }) {
  const [view, setView] = useState(initialView)
  const [form, setForm] = useState({ email: '', password: '', otp: '', confirmPassword: '' })
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function resetMessages() {
    setError('')
    setNotice('')
  }

  function changeView(nextView) {
    setView(nextView)
    onViewChange?.(nextView)
    resetMessages()
  }

  async function submit(event) {
    event.preventDefault()
    resetMessages()
    setBusy(true)
    try {
      if (view === 'register') {
        const result = await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, password: form.password }),
        })
        setNotice(result.message)
        setView('verify')
      } else if (view === 'verify') {
        const result = await api('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, otp: form.otp }),
        })
        setNotice(result.message)
        setView('login')
      } else if (view === 'forgot') {
        const result = await api('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: form.email }),
        })
        setNotice(result.message)
        setView('reset')
      } else if (view === 'reset') {
        if (form.password !== form.confirmPassword) throw new Error('Passwords do not match')
        const result = await api('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, otp: form.otp, new_password: form.password }),
        })
        setNotice(result.message)
        setForm((current) => ({ ...current, password: '', confirmPassword: '', otp: '' }))
        setView('login')
      } else {
        onAuthenticated(await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, password: form.password }),
        }))
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function googleSuccess(result) {
    resetMessages()
    try {
      onAuthenticated(await api('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential: result.credential }),
      }))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function useDemoAccount() {
    resetMessages()
    setBusy(true)
    try {
      onAuthenticated(await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
      }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function resendOtp() {
    resetMessages()
    try {
      const result = await api('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: form.email }),
      })
      setNotice(result.message)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return <>
    <header>
      <p className="eyebrow">WELCOME TO VEERA AI</p>
      <h2>{view === 'register' ? 'Create your account' : view === 'verify' ? 'Check your inbox' : view === 'forgot' ? 'Forgot your password?' : view === 'reset' ? 'Set a new password' : 'Sign in to continue'}</h2>
      <p>{view === 'verify' || view === 'reset' ? `Enter the six-digit code sent to ${form.email}` : view === 'forgot' ? 'We will email you a secure reset code.' : 'Build, organize, and return to your AI projects.'}</p>
    </header>

    {(view === 'login' || view === 'register') && <div className="tabs" role="tablist">
      <button className={view === 'login' ? 'active' : ''} onClick={() => changeView('login')}>Sign in</button>
      <button className={view === 'register' ? 'active' : ''} onClick={() => changeView('register')}>Register</button>
    </div>}

    {(view === 'login' || view === 'register') && DEMO_EMAIL && DEMO_PASSWORD && <aside className="demo-credentials">
      <div><strong>Read-only demo</strong><span>Explore every project without making changes.</span></div>
      <dl><div><dt>Email</dt><dd>{DEMO_EMAIL}</dd></div><div><dt>Password</dt><dd>{DEMO_PASSWORD}</dd></div></dl>
      <button type="button" onClick={useDemoAccount} disabled={busy}>Use demo account <ArrowRight size={16} /></button>
    </aside>}

    <form onSubmit={submit}>
      {(view === 'login' || view === 'register' || view === 'forgot') && <label>Email address<div className="input-wrap"><Mail size={18} /><input type="email" name="email" value={form.email} onChange={update} required autoComplete="email" placeholder="you@gmail.com" /></div></label>}
      {(view === 'login' || view === 'register') && <label>Password<div className="input-wrap"><LockKeyhole size={18} /><input type="password" name="password" value={form.password} onChange={update} required minLength={view === 'register' ? 8 : undefined} autoComplete={view === 'register' ? 'new-password' : 'current-password'} /></div></label>}
      {(view === 'verify' || view === 'reset') && <label>Verification code<input className="otp-input" name="otp" value={form.otp} onChange={update} required pattern="[0-9]{6}" maxLength="6" inputMode="numeric" autoFocus /></label>}
      {view === 'reset' && <>
        <label>New password<div className="input-wrap"><LockKeyhole size={18} /><input type="password" name="password" value={form.password} onChange={update} required minLength="8" autoComplete="new-password" /></div></label>
        <label>Confirm new password<div className="input-wrap"><LockKeyhole size={18} /><input type="password" name="confirmPassword" value={form.confirmPassword} onChange={update} required minLength="8" autoComplete="new-password" /></div></label>
      </>}
      {error && <p className="message error" role="alert">{error}</p>}
      {notice && <p className="message success">{notice}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Please wait...' : view === 'register' ? 'Create account' : view === 'verify' ? 'Verify email' : view === 'forgot' ? 'Send reset code' : view === 'reset' ? 'Reset password' : 'Sign in'}<ArrowRight size={18} /></button>
    </form>

    {view === 'verify' ? <div className="verify-actions"><button className="text-button" onClick={resendOtp}>Send a new code</button><button className="text-button" onClick={() => changeView('register')}>Change email</button></div> : <>
      {view === 'login' && <button className="text-button forgot-link" onClick={() => changeView('forgot')}>Forgot password?</button>}
      {(view === 'forgot' || view === 'reset') && <button className="text-button back-link" onClick={() => changeView('login')}>Back to sign in</button>}
      {(view === 'login' || view === 'register') && <>
        <div className="divider"><span>or</span></div>
        <div className="google-button">
          {GOOGLE_CLIENT_ID ? <GoogleLogin onSuccess={googleSuccess} onError={() => setError('Google sign-in failed')} width="320" /> : <button className="google-disabled" disabled>Google sign-in needs a client ID</button>}
        </div>
        {view === 'register' && <p className="provider-note">Email registration supports Google, Outlook, and Apple iCloud addresses.</p>}
      </>}
    </>}
  </>
}