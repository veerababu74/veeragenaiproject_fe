import { useEffect, useState } from 'react'
import { BookOpen, ChevronDown, FolderKanban, LogOut, Menu, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react'
import BrandPanel from './components/BrandPanel'
import AdminPanel from './features/admin/AdminPanel'
import AuthPanel from './features/auth/AuthPanel'
import BlogPanel from './features/blog/BlogPanel'
import LandingPage from './features/landing/LandingPage'
import ProfilePanel from './features/profile/ProfilePanel'
import ProjectsPanel from './features/projects/ProjectsPanel'
import { api } from './lib/api'
import './App.css'

const PUBLIC_ROUTES = { '/login': 'login', '/register': 'register' }
const WORKSPACE_ROUTES = { '/projects': 'projects', '/admin': 'admin', '/profile': 'profile', '/blog': 'blog' }
const PROJECT_ROUTES = { '/projects/basic-chat': 'basic-chat', '/projects/basic-rag': 'basic-rag', '/projects/advanced-rag': 'advanced-rag', '/projects/google-workspace-agent': 'google-workspace-agent' }

function App() {
  const [user, setUser] = useState(undefined)
  const [workspaceView, setWorkspaceView] = useState('projects')
  const [workspaceProject, setWorkspaceProject] = useState(null)
  const [workspaceBlog, setWorkspaceBlog] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [publicView, setPublicView] = useState('landing')
  const [authView, setAuthView] = useState('login')

  useEffect(() => {
    api('/auth/session').then(setUser).catch(() => setUser(null))
  }, [])

  useEffect(() => {
    function syncViewWithPath() {
      const path = window.location.pathname.replace(/\/$/, '') || '/'
      const blogSlug = path.match(/^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)$/)?.[1]
      if (PUBLIC_ROUTES[path]) {
        setAuthView(PUBLIC_ROUTES[path])
        setPublicView('auth')
      } else if (PROJECT_ROUTES[path]) {
        setWorkspaceView('projects')
        setWorkspaceProject(PROJECT_ROUTES[path])
        setWorkspaceBlog(null)
      } else if (blogSlug) {
        setWorkspaceView('blog')
        setWorkspaceProject(null)
        setWorkspaceBlog(blogSlug)
      } else if (WORKSPACE_ROUTES[path]) {
        setWorkspaceView(WORKSPACE_ROUTES[path])
        setWorkspaceProject(null)
        setWorkspaceBlog(null)
      } else {
        if (path !== '/') window.history.replaceState({}, '', '/')
        setPublicView('landing')
        setWorkspaceView('projects')
        setWorkspaceProject(null)
        setWorkspaceBlog(null)
      }
      setMobileNavOpen(false)
    }

    syncViewWithPath()
    window.addEventListener('popstate', syncViewWithPath)
    return () => window.removeEventListener('popstate', syncViewWithPath)
  }, [])

  useEffect(() => {
    if (user === undefined) return
    const path = window.location.pathname.replace(/\/$/, '') || '/'
    if (!user && (WORKSPACE_ROUTES[path] || PROJECT_ROUTES[path] || path.startsWith('/blog/'))) navigate('/login', { replace: true })
    if (user && PUBLIC_ROUTES[path]) navigate('/projects', { replace: true })
  }, [user])

  function navigate(path, { replace = false } = {}) {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
    navigate('/', { replace: true })
  }

  async function accountDeleted() {
    setUser(null)
    navigate('/', { replace: true })
  }

  async function createAccountFromDemo() {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
    navigate('/register', { replace: true })
  }

  function showAuth(view) {
    navigate(view === 'register' ? '/register' : '/login')
  }

  function openWorkspace(view) {
    navigate(`/${view}`)
  }

  if (user === undefined) return <main className="session-loading"><Sparkles size={24} /> Veera AI</main>

  if (user) {
    const allowedWorkspaceView = (workspaceView === 'admin' && user.role !== 'admin') || (workspaceView === 'profile' && user.role === 'demo') ? 'projects' : workspaceView
    return <main className="workspace-shell">
    <header className="workspace-nav">
      <button className="workspace-brand" onClick={() => openWorkspace('projects')}>
        <span className="workspace-brand-icon"><Sparkles size={18} /></span>
        <span className="workspace-brand-copy"><strong>Veera AI</strong><small>Workspace</small></span>
      </button>
      <button className="mobile-menu-toggle" aria-label="Open navigation" aria-expanded={mobileNavOpen} aria-controls="workspace-navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
      <nav id="workspace-navigation" className={mobileNavOpen ? 'mobile-open' : ''} aria-label="Workspace">
        <div className="mobile-nav-head"><span><Sparkles size={18} /> Navigation</span><button aria-label="Close navigation" title="Close sidebar" onClick={() => setMobileNavOpen(false)}><X size={20} strokeWidth={2.5} /></button></div>
        <button aria-current={allowedWorkspaceView === 'projects' ? 'page' : undefined} className={allowedWorkspaceView === 'projects' ? 'active' : ''} onClick={() => openWorkspace('projects')}><FolderKanban size={17} /> Projects</button>
        <button aria-current={allowedWorkspaceView === 'blog' ? 'page' : undefined} className={allowedWorkspaceView === 'blog' ? 'active' : ''} onClick={() => openWorkspace('blog')}><BookOpen size={17} /> Blog</button>
        {user.role === 'admin' && <button aria-current={allowedWorkspaceView === 'admin' ? 'page' : undefined} className={allowedWorkspaceView === 'admin' ? 'active' : ''} onClick={() => openWorkspace('admin')}><ShieldCheck size={17} /> Admin</button>}
      </nav>
      <details className="nav-account">
        <summary aria-label="Open account menu">
          <span className="nav-avatar">{user.profile_picture_url ? <img src={user.profile_picture_url} alt="" /> : user.name.charAt(0).toUpperCase()}</span>
          <span className="nav-user"><strong>{user.name}</strong><small>{user.role}</small></span>
          <ChevronDown className="account-chevron" size={16} />
        </summary>
        <div className="account-menu">
          <div className="account-menu-user"><strong>{user.name}</strong><span>{user.email}</span></div>
          {user.role !== 'demo' && <button onClick={(event) => { openWorkspace('profile'); event.currentTarget.closest('details').removeAttribute('open') }}><UserRound size={17} /> Profile</button>}
          <button className="account-signout" onClick={logout}><LogOut size={17} /> Sign out</button>
        </div>
      </details>
    </header>
    {mobileNavOpen && <button className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
    <section className={`workspace-content ${allowedWorkspaceView === 'profile' ? 'profile-content' : ''}`}>
      {allowedWorkspaceView === 'projects' && <ProjectsPanel user={user} openProject={workspaceProject} onOpenProject={(projectId) => navigate(`/projects/${projectId}`)} onCloseProject={() => navigate('/projects')} onCreateAccount={createAccountFromDemo} onOpenBlog={(slug) => navigate(`/blog/${slug}`)} />}
      {allowedWorkspaceView === 'blog' && <BlogPanel key={workspaceBlog || 'blog-index'} initialSlug={workspaceBlog} onNavigate={navigate} />}
      {allowedWorkspaceView === 'profile' && <ProfilePanel user={user} onUserChange={setUser} onAccountDeleted={accountDeleted} />}
      {allowedWorkspaceView === 'admin' && <AdminPanel currentUser={user} />}
    </section>
  </main>
  }

  if (publicView === 'landing') return <LandingPage onLogin={() => showAuth('login')} onRegister={() => showAuth('register')} onNavigate={navigate} />

  return (
    <main className="auth-shell">
      <BrandPanel />

      <section className="form-panel">
        <div className="auth-card">
          <button className="text-button public-back" onClick={() => navigate('/')}>Back to home</button>
          <AuthPanel key={authView} initialView={authView} onViewChange={(view) => { if (view === 'login' || view === 'register') showAuth(view) }} onAuthenticated={(authenticatedUser) => { setUser(authenticatedUser); navigate('/projects', { replace: true }) }} />
        </div>
      </section>
    </main>
  )
}

export default App
