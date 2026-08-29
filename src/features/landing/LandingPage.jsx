import { useDeferredValue, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BrainCircuit,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircuitBoard,
  Cpu,
  Eye,
  ExternalLink,
  Layers3,
  Search,
  Sparkles,
  Star,
  Workflow,
} from 'lucide-react'
import { api } from '../../lib/api'
import './LandingPage.css'

const ICONS = {
  robot: Bot,
  brain: BrainCircuit,
  cpu: Cpu,
  vision: Eye,
  chart: ChartNoAxesCombined,
  workflow: Workflow,
}
const PAGE_SIZE = 4

export default function LandingPage({ onLogin, onRegister, onNavigate }) {
  const [content, setContent] = useState(null)
  const [slide, setSlide] = useState(0)
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const deferredCategory = useDeferredValue(category)
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    Promise.all([api('/landing'), api('/portfolio')]).then(([landing, catalog]) => setContent({
      ...landing,
      portfolio_nav_label: catalog.nav_label,
      portfolio_eyebrow: catalog.eyebrow,
      portfolio_title: catalog.title,
      portfolio_description: catalog.description,
      portfolio_projects: catalog.projects,
    })).catch(() => {})
  }, [])

  useEffect(() => {
    if (!content || content.hero_slides.length < 2) return undefined
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % content.hero_slides.length), 7000)
    return () => window.clearInterval(timer)
  }, [content])

  if (!content) return <main className="landing-loading"><Sparkles size={26} /> Veera AI</main>

  const activeSlide = content.hero_slides[slide]
  const moveSlide = (direction) => setSlide((slide + direction + content.hero_slides.length) % content.hero_slides.length)
  const categories = ['All', ...new Set(content.portfolio_projects.map((project) => project.category))]
  const normalizedQuery = deferredQuery.trim().toLowerCase()
  const projects = content.portfolio_projects.filter((project) => {
    if (deferredCategory !== 'All' && project.category !== deferredCategory) return false
    if (!normalizedQuery) return true
    return [project.title, project.summary, project.category, ...project.tags].some((value) => value.toLowerCase().includes(normalizedQuery))
  })
  const pageCount = Math.max(1, Math.ceil(projects.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleProjects = projects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function internalAction(url) {
    if (url === '#signin' || url === '/login') return onLogin
    if (url === '/register') return onRegister
    if (url.startsWith('/') && !url.startsWith('//')) return () => onNavigate(url)
    return null
  }

  function linkedControl(url, label) {
    const action = internalAction(url)
    if (action) return <button onClick={action}>{label} <ArrowRight size={17} /></button>
    const external = url.startsWith('https://')
    return <a href={url} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{label} {external && <ExternalLink size={16} />}</a>
  }

  return <main className="landing-page">
    <nav className="landing-nav" aria-label="Public navigation">
      <a className="landing-brand" href="#top"><span><CircuitBoard size={21} /></span>{content.brand_name}</a>
      <div className="landing-nav-links">
        <a href="#projects">{content.portfolio_nav_label}</a>
        <a href="#capabilities">{content.capabilities_nav_label}</a>
        <a href="#roadmap">{content.roadmap_nav_label}</a>
      </div>
      <div className="landing-auth-actions">
        <button onClick={onLogin}>{content.login_label}</button>
        <button className="landing-register" onClick={onRegister}>{content.register_label}<ArrowRight size={16} /></button>
      </div>
    </nav>

    <section className="landing-hero" id="top">
      <img className="landing-hero-image" key={activeSlide.image_url} src={activeSlide.image_url} alt="" aria-hidden="true" />
      <div className="landing-hero-shade" />
      <div className="landing-hero-content" key={`${activeSlide.title}-${slide}`}>
        <p className="landing-announcement"><Sparkles size={15} />{content.announcement}</p>
        <p className="landing-kicker">{activeSlide.eyebrow}</p>
        <h1>{activeSlide.title}</h1>
        <p className="landing-lead">{activeSlide.description}</p>
        <div className="landing-hero-actions">
          <button onClick={onRegister}>{content.primary_cta_label}<ArrowRight size={18} /></button>
          <a href="#roadmap">{content.secondary_cta_label}</a>
        </div>
      </div>
      <div className="carousel-controls" aria-label="Hero carousel">
        <button onClick={() => moveSlide(-1)} title="Previous slide"><ChevronLeft size={20} /></button>
        <div>{content.hero_slides.map((item, index) => <button key={item.title} className={index === slide ? 'active' : ''} aria-label={`Show slide ${index + 1}`} onClick={() => setSlide(index)} />)}</div>
        <button onClick={() => moveSlide(1)} title="Next slide"><ChevronRight size={20} /></button>
      </div>
      <p className="slide-count"><strong>{String(slide + 1).padStart(2, '0')}</strong> / {String(content.hero_slides.length).padStart(2, '0')}</p>
    </section>

    <section className="landing-metrics" aria-label="Platform highlights">
      {content.metrics.map((metric) => <div key={`${metric.value}-${metric.label}`}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}
    </section>

    <section className="landing-section portfolio-section" id="projects">
      <header className="portfolio-heading">
        <div><p>{content.portfolio_eyebrow}</p><h2>{content.portfolio_title}</h2></div>
        <span>{content.portfolio_description}</span>
      </header>
      <div className="portfolio-browse-tools">
        <div className="portfolio-filters" aria-label="Filter projects by category">
          {categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => { setCategory(item); setPage(1) }}>{item === 'All' && <Layers3 size={15} />}{item}</button>)}
        </div>
        <label className="portfolio-search"><Search size={17} /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search projects" aria-label="Search projects" /></label>
      </div>
      <div className="portfolio-grid" key={`${deferredCategory}-${currentPage}`}>
        {visibleProjects.map((project) => <article className={`portfolio-card ${project.featured ? 'featured' : ''}`} key={project.id}>
          <div className="portfolio-media"><img src={project.image_url} alt={project.image_alt} loading="lazy" />{project.featured && <span className="featured-label"><Star size={13} /> Featured</span>}</div>
          <div className="portfolio-copy">
            <div className="portfolio-meta"><span>{project.category}</span><small className={project.status}>{project.status.replace('-', ' ')}</small></div>
            <h3>{project.title}</h3>
            <p>{project.summary}</p>
            <div className="portfolio-tags">{project.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            {linkedControl(project.project_url, 'View project')}
          </div>
        </article>)}
      </div>
      {projects.length > 0 && <nav className="portfolio-pagination" aria-label="Project pages">
        <button onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} title="Previous page"><ArrowLeft size={16} /> Previous</button>
        <span>Page <strong>{currentPage}</strong> of {pageCount} · {projects.length} projects</span>
        <button onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount} title="Next page">Next <ArrowRight size={16} /></button>
      </nav>}
      {projects.length === 0 && <div className="portfolio-empty"><Search size={26} /><h3>No matching projects</h3><p>Try another search or category.</p></div>}
    </section>

    <section className="landing-section capabilities-section" id="capabilities">
      <header className="landing-section-heading">
        <div><p>{content.features_eyebrow}</p><h2>{content.features_title}</h2></div>
        <span>{content.features_description}</span>
      </header>
      <div className="capability-grid">
        {content.features.map((feature, index) => {
          const Icon = ICONS[feature.icon] || Cpu
          return <article className="capability-card" key={`${feature.title}-${index}`}>
            <div className="capability-icon"><Icon size={24} /></div>
            <p>{feature.eyebrow}</p>
            <h3>{feature.title}</h3>
            <span>{feature.description}</span>
            <small>{String(index + 1).padStart(2, '0')}</small>
          </article>
        })}
      </div>
    </section>

    <section className="roadmap-section" id="roadmap">
      <div className="landing-section roadmap-inner">
        <header className="roadmap-heading"><p>{content.roadmap_eyebrow}</p><h2>{content.roadmap_title}</h2><span>{content.roadmap_description}</span></header>
        <div className="roadmap-track">
          {content.roadmap.map((item, index) => <article key={`${item.phase}-${index}`}>
            <div className={`roadmap-node ${item.status}`}><span>{index + 1}</span></div>
            <p>{item.phase}</p><h3>{item.title}</h3><span>{item.description}</span><small className={item.status}>{item.status}</small>
          </article>)}
        </div>
      </div>
    </section>

    <section className="landing-cta">
      <div><Sparkles size={25} /><h2>{content.cta_title}</h2><p>{content.cta_description}</p></div>
      <button onClick={onRegister}>{content.cta_button_label}<ArrowRight size={18} /></button>
    </section>

    <footer className="landing-footer">
      <div className="footer-brand"><span><CircuitBoard size={22} /></span><div><strong>{content.brand_name}</strong><p>{content.footer_description}</p></div></div>
      <div className="footer-links">{content.footer_links.map((link) => <span key={link.label}>{linkedControl(link.href, link.label)}</span>)}</div>
      <p className="footer-copyright">{content.footer_copyright}</p>
    </footer>
  </main>
}