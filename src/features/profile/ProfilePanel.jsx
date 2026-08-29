import { useState } from 'react'
import { ArrowRight, Camera, Link2, LockKeyhole, MapPin, Phone, UserRound } from 'lucide-react'
import { api } from '../../lib/api'
import './ProfilePanel.css'

export default function ProfilePanel({ user, onUserChange }) {
  const [form, setForm] = useState({ password: '', currentPassword: '' })
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

  async function updateProfile(event) {
    event.preventDefault()
    resetMessages()
    setBusy(true)
    try {
      const payload = {
        name: form.name || user.name,
        first_name: form.first_name ?? user.first_name,
        last_name: form.last_name ?? user.last_name,
        linkedin_url: form.linkedin_url ?? user.linkedin_url,
        github_url: form.github_url ?? user.github_url,
        phone_number: form.phone_number ?? user.phone_number,
        address: form.address ?? user.address,
      }
      Object.keys(payload).forEach((key) => payload[key] == null && delete payload[key])
      if (form.password) {
        payload.current_password = form.currentPassword
        payload.new_password = form.password
      }
      onUserChange(await api('/auth/me', { method: 'PATCH', body: JSON.stringify(payload) }))
      setNotice('Profile updated')
      setForm((current) => ({ ...current, password: '', currentPassword: '' }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function uploadProfilePicture(event) {
    const picture = event.target.files?.[0]
    if (!picture) return
    resetMessages()
    setBusy(true)
    const body = new FormData()
    body.append('picture', picture)
    try {
      onUserChange(await api('/auth/me/profile-picture', { method: 'POST', body }))
      setNotice('Profile picture updated')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  return <>
    <div className="profile-heading">
      <div className="avatar">
        {user.profile_picture_url ? <img src={user.profile_picture_url} alt="" /> : user.name.charAt(0).toUpperCase()}
        <label className="photo-button" title="Change profile picture">
          <Camera size={14} />
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadProfilePicture} disabled={busy} />
        </label>
      </div>
      <div><span>Signed in as</span><h2>{user.name}</h2><p>{user.email}</p></div>
    </div>
    <form onSubmit={updateProfile}>
      <label>Display name<div className="input-wrap"><UserRound size={18} /><input name="name" defaultValue={user.name} onChange={update} /></div></label>
      <div className="field-row">
        <label>First name<div className="input-wrap"><UserRound size={18} /><input name="first_name" defaultValue={user.first_name || ''} onChange={update} autoComplete="given-name" /></div></label>
        <label>Last name<div className="input-wrap"><UserRound size={18} /><input name="last_name" defaultValue={user.last_name || ''} onChange={update} autoComplete="family-name" /></div></label>
      </div>
      <label>LinkedIn profile<div className="input-wrap"><Link2 size={18} /><input type="url" name="linkedin_url" defaultValue={user.linkedin_url || ''} onChange={update} placeholder="https://linkedin.com/in/username" /></div></label>
      <label>GitHub profile<div className="input-wrap"><Link2 size={18} /><input type="url" name="github_url" defaultValue={user.github_url || ''} onChange={update} placeholder="https://github.com/username" /></div></label>
      <label>Phone number<div className="input-wrap"><Phone size={18} /><input type="tel" name="phone_number" defaultValue={user.phone_number || ''} onChange={update} autoComplete="tel" /></div></label>
      <label>Address<div className="input-wrap"><MapPin size={18} /><input name="address" defaultValue={user.address || ''} onChange={update} autoComplete="street-address" /></div></label>
      {user.provider === 'email' && <>
        <p className="password-section-title">Change password</p>
        <label>Current password<div className="input-wrap"><LockKeyhole size={18} /><input type="password" name="currentPassword" value={form.currentPassword} onChange={update} /></div></label>
        <label>New password<div className="input-wrap"><LockKeyhole size={18} /><input type="password" name="password" value={form.password} minLength="8" onChange={update} /></div></label>
      </>}
      {error && <p className="message error" role="alert">{error}</p>}
      {notice && <p className="message success">{notice}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Updating...' : 'Update profile'}<ArrowRight size={18} /></button>
    </form>
  </>
}