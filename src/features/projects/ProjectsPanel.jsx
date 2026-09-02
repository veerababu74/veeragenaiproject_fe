import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, FolderKanban, Layers3, LockKeyhole, Search, Sparkles, UserPlus } from 'lucide-react'
import { api } from '../../lib/api'
import AdvancedRag from './AdvancedRag'
import AgentOrchestration from './agent-orchestration/AgentOrchestration'
import BasicChat from './BasicChat'
import BasicRag from './BasicRag'
import ChunkingLab from './ChunkingLab'
import GraphRag from './GraphRag'
import WorkspaceAgent from './WorkspaceAgent'
import './ProjectsPanel.css'

const PROJECT_COMPONENTS = { 'basic-chat': BasicChat, 'basic-rag': BasicRag, 'advanced-rag': AdvancedRag, 'google-workspace-agent': WorkspaceAgent, 'chunking-lab': ChunkingLab, 'graph-rag': GraphRag, 'agent-orchestration': AgentOrchestration }
const PAGE_SIZE = 8

export default function ProjectsPanel({ user, openProject, onOpenProject, onCloseProject, onCreateAccount, onOpenBlog }) {
  const [projects, setProjects] = useState([])
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/projects/catalog').then(setProjects).catch((requestError) => setError(requestError.message))
  }, [])

  const ProjectComponent = user.role === 'demo' ? null : PROJECT_COMPONENTS[openProject]
  if (ProjectComponent) {
    return <ProjectComponent onBack={onCloseProject} />
  }

  const categories = ['All', ...new Set(projects.map((project) => project.category))]
  const normalizedQuery = query.trim().toLowerCase()
  const filteredProjects = projects.filter((project) => {
    if (category !== 'All' && project.category !== category) return false
    if (!normalizedQuery) return true
    return [project.title, project.summary, project.category, ...project.tags].some((value) => value.toLowerCase().includes(normalizedQuery))
  })
  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const availableProjects = projects.filter((project) => project.status !== 'coming-soon').length

  return <section className="projects-panel">
    <header className="projects-heading">
      <div><p>YOUR WORKSPACE</p><h1>Projects built to explore and use</h1><span>Browse practical AI, machine-learning, and engineering work managed from the project catalog.</span></div>
      <div className="projects-summary"><strong>{projects.length}</strong><span>Projects</span><strong>{availableProjects}</strong><span>Available</span></div>
    </header>
    <div className="project-browse-tools">
      <div className="workspace-filters" aria-label="Filter workspace projects by category">
        {categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => { setCategory(item); setPage(1) }}>{item === 'All' && <Layers3 size={15} />}{item}</button>)}
      </div>
      <label className="project-search"><Search size={17} /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search projects" aria-label="Search projects" /></label>
    </div>
    {error && <p className="projects-error">{error}</p>}
    <div className="project-grid">
      {visibleProjects.map((project) => {
        const hasAccess = user.role === 'admin' || !user.blocked_projects?.includes(project.id)
        const runnable = Boolean(PROJECT_COMPONENTS[project.id])
        const external = project.project_url.startsWith('https://')
        const canOpen = user.role !== 'demo' && hasAccess && project.status !== 'coming-soon' && (runnable || external)
        return <article className={`project-card ${project.featured ? 'featured' : ''} ${hasAccess ? '' : 'locked'}`} key={project.id}>
          <div className="project-image"><img src={project.image_url} alt={project.image_alt} />{project.featured && <span><Sparkles size={13} /> Featured</span>}</div>
          <div className="project-card-body">
            <div className="project-card-topline"><small>{project.category}</small><span className={project.status}>{project.status.replace('-', ' ')}</span></div>
            <h2>{project.title}</h2>
            <p>{project.summary}</p>
            <div className="project-tags">{project.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <div className="project-card-actions">
              {project.blog_slug && <button className="project-blog-btn" onClick={() => onOpenBlog && onOpenBlog(project.blog_slug)}><BookOpen size={15} /> Read about this project</button>}
              {canOpen && runnable && <button onClick={() => onOpenProject(project.id)}>Open project <ArrowRight size={17} /></button>}
              {canOpen && external && <a href={project.project_url} target="_blank" rel="noreferrer">Open project <ExternalLink size={16} /></a>}
              {project.status === 'coming-soon' && <button disabled><FolderKanban size={16} /> Coming soon</button>}
              {user.role === 'demo' && project.status !== 'coming-soon' && <button onClick={onCreateAccount}><UserPlus size={16} /> Create account to interact</button>}
              {project.status !== 'coming-soon' && !hasAccess && <button disabled><LockKeyhole size={16} /> Access required</button>}
              {user.role !== 'demo' && project.status !== 'coming-soon' && hasAccess && !canOpen && <button disabled><FolderKanban size={16} /> Preview only</button>}
            </div>
          </div>
        </article>
      })}
    </div>
    {!error && filteredProjects.length > 0 && <nav className="project-pagination" aria-label="Project pages">
      <button onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} title="Previous page"><ArrowLeft size={16} /> Previous</button>
      <span>Page <strong>{currentPage}</strong> of {pageCount} · {filteredProjects.length} projects</span>
      <button onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount} title="Next page">Next <ArrowRight size={16} /></button>
    </nav>}
    {!error && projects.length === 0 && <div className="projects-empty"><FolderKanban size={28} /><h2>No projects published</h2><p>An administrator can add projects from the project catalog.</p></div>}
    {!error && projects.length > 0 && filteredProjects.length === 0 && <div className="projects-empty"><Search size={28} /><h2>No matching projects</h2><p>Try another search or category.</p></div>}
  </section>
}