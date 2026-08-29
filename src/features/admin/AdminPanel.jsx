import { useEffect, useState } from 'react'
import { FolderKanban, FolderKey, LayoutTemplate, Search, ShieldCheck, Users } from 'lucide-react'
import { api } from '../../lib/api'
import LandingEditor from './LandingEditor'
import ProjectCatalogEditor from './ProjectCatalogEditor'
import './AdminPanel.css'

export default function AdminPanel({ currentUser }) {
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')
  const [view, setView] = useState('users')

  useEffect(() => {
    Promise.all([api('/admin/users'), api('/projects/catalog')])
      .then(([loadedUsers, loadedProjects]) => { setUsers(loadedUsers); setProjects(loadedProjects) })
      .catch((requestError) => setError(requestError.message))
  }, [])

  async function saveAccess(target, changes) {
    setError('')
    setSaving(target.id)
    try {
      const updated = await api(`/admin/users/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      })
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving('')
    }
  }

  const visibleUsers = users.filter((item) =>
    `${item.name} ${item.email}`.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return <div className="admin-panel">
    <div className="admin-view-tabs">
      <button className={view === 'users' ? 'active' : ''} onClick={() => setView('users')}><Users size={17} /> User access</button>
      <button className={view === 'projects' ? 'active' : ''} onClick={() => setView('projects')}><FolderKanban size={17} /> Project catalog</button>
      <button className={view === 'landing' ? 'active' : ''} onClick={() => setView('landing')}><LayoutTemplate size={17} /> Landing content</button>
    </div>
    {view === 'landing' ? <LandingEditor /> : view === 'projects' ? <ProjectCatalogEditor /> : <>
    <div className="admin-heading">
      <div><span>ADMINISTRATION</span><h2>User access</h2><p>{users.length} registered users</p></div>
      <ShieldCheck size={30} />
    </div>
    <label className="admin-search">Search users<div className="input-wrap"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or email" /></div></label>
    {error && <p className="message error" role="alert">{error}</p>}
    <div className="user-list">
      {visibleUsers.map((item) => <article className="user-row" key={item.id}>
        <div className="user-summary">
          <div className="small-avatar">{item.name.charAt(0).toUpperCase()}</div>
          <div><strong>{item.name}</strong><span>{item.email}</span><small>{item.role} · {item.provider}</small></div>
          <label className="status-toggle">
            <input type="checkbox" checked={item.is_active} disabled={saving === item.id || item.id === currentUser.id} onChange={(event) => saveAccess(item, { is_active: event.target.checked })} />
            <span>{item.is_active ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>
        <div className="project-access">
          <FolderKey size={17} />
          <div><strong>Project access</strong><small>New projects are enabled automatically.</small><div className="project-access-list">{projects.map((project) => {
            const enabled = item.role === 'admin' || !item.blocked_projects.includes(project.id)
            return <label key={project.id}><input type="checkbox" checked={enabled} disabled={saving === item.id || item.role === 'admin'} onChange={(event) => saveAccess(item, {
              blocked_projects: event.target.checked
                ? item.blocked_projects.filter((id) => id !== project.id)
                : [...item.blocked_projects, project.id],
            })} /><span>{project.title}</span></label>
          })}</div></div>
        </div>
      </article>)}
      {!visibleUsers.length && <p className="empty-state">No users match your search.</p>}
    </div>
    </>}
  </div>
}