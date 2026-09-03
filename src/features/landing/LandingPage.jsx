import { useDeferredValue, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
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
// Kept below the number of published projects so the catalogue actually
// pages. At 8 it matched the project count exactly and every project
// landed on a single page with the pager stuck at "Page 1 of 1".
const PAGE_SIZE = 6

/* Simple inline block renderer for the landing page blog overlay */
function LandingBlogBlock({ block }) {
  const mermaidRef = useRef(null)
  useEffect(() => {
    if (block.type !== 'mermaid' || !mermaidRef.current) return
    let cancelled = false
    import('mermaid').then((mod) => {
      const m = mod.default
      m.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' })
      m.render(`m-${Math.random().toString(36).slice(2)}`, block.content).then(({ svg }) => {
        if (!cancelled && mermaidRef.current) mermaidRef.current.innerHTML = svg
      }).catch(() => {})
    })
    return () => { cancelled = true }
  }, [block])

  switch (block.type) {
    case 'heading1': return <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f0f0f0', margin: '2rem 0 0.5rem' }}>{block.content}</h2>
    case 'heading2': return <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e5e7eb', margin: '1.5rem 0 0.4rem' }}>{block.content}</h3>
    case 'heading3': return <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#d1d5db', margin: '1.2rem 0 0.3rem' }}>{block.content}</h4>
    case 'paragraph': return <p style={{ fontSize: '1rem', lineHeight: 1.75, color: '#c9d0da', marginBottom: '1.25rem' }}>{block.content}</p>
    case 'image': return (
      <figure style={{ margin: '1.5rem 0' }}>
        <img src={block.url} alt={block.alt || ''} style={{ width: '100%', borderRadius: 10, display: 'block' }} />
        {block.caption && <figcaption style={{ textAlign: 'center', fontSize: '0.82rem', color: '#6b7280', marginTop: '0.5rem' }}>{block.caption}</figcaption>}
      </figure>
    )
    case 'mermaid': return (
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '1.5rem', textAlign: 'center', overflowX: 'auto', margin: '1.25rem 0' }}
        ref={mermaidRef} />
    )
    case 'code': return (
      <div style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden', margin: '1.25rem 0' }}>
        {block.language && <span style={{ display: 'block', padding: '0.4rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: '#7c6af7', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{block.language}</span>}
        <pre style={{ margin: 0, padding: '1rem', overflowX: 'auto' }}><code style={{ fontFamily: 'monospace', fontSize: '0.88rem', color: '#e2e8f0' }}>{block.content}</code></pre>
      </div>
    )
    case 'table': return (
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', margin: '1.25rem 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead><tr>{block.headers?.map((h, i) => <th key={i} style={{ background: 'rgba(124,106,247,0.12)', color: '#e2e8f0', fontWeight: 700, padding: '0.65rem 1rem', textAlign: 'left' }}>{h}</th>)}</tr></thead>
          <tbody>{block.rows?.map((row, ri) => <tr key={ri}>{row.cells.map((cell, ci) => <td key={ci} style={{ padding: '0.55rem 1rem', color: '#c9d0da', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    )
    case 'bullet-list': return <ul style={{ color: '#c9d0da', lineHeight: 1.75, paddingLeft: '1.5rem', margin: '0.75rem 0 1.25rem' }}>{block.items?.map((item, i) => <li key={i} style={{ marginBottom: '0.3rem' }}>{item}</li>)}</ul>
    case 'numbered-list': return <ol style={{ color: '#c9d0da', lineHeight: 1.75, paddingLeft: '1.5rem', margin: '0.75rem 0 1.25rem' }}>{block.items?.map((item, i) => <li key={i} style={{ marginBottom: '0.3rem' }}>{item}</li>)}</ol>
    case 'divider': return <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '2rem 0' }} />
    default: return null
  }
}

export default function LandingPage({ authenticated = false, onLogin, onRegister, onOpenWorkspace, onNavigate }) {

  const [content, setContent] = useState(null)
  const [contentError, setContentError] = useState('')
  const [slide, setSlide] = useState(0)
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [blogPosts, setBlogPosts] = useState([])
  const [blogPage, setBlogPage] = useState(1)
  const [blogTotalPages, setBlogTotalPages] = useState(1)
  const [blogQuery, setBlogQuery] = useState('')
  const [openBlogSlug, setOpenBlogSlug] = useState(null)
  const [blogPost, setBlogPost] = useState(null)
  const [blogLoading, setBlogLoading] = useState(false)
  const deferredCategory = useDeferredValue(category)
  const deferredQuery = useDeferredValue(query)
  const deferredBlogQuery = useDeferredValue(blogQuery)

  useEffect(() => {
    Promise.all([api('/landing'), api('/portfolio')])
      .then(([landing, catalog]) => setContent({
        ...landing,
        portfolio_nav_label: catalog.nav_label,
        portfolio_eyebrow: catalog.eyebrow,
        portfolio_title: catalog.title,
        portfolio_description: catalog.description,
        portfolio_projects: catalog.projects,
      }))
      .catch((error) => setContentError(error.message))
  }, [])

  // Fetch public blog posts
  useEffect(() => {
    const search = deferredBlogQuery.trim()
    api(`/blogs?page=${blogPage}&page_size=4${search ? `&search=${encodeURIComponent(search)}` : ''}`)
      .then((data) => { setBlogPosts(data.posts); setBlogTotalPages(data.total_pages) })
      .catch(() => {})
  }, [blogPage, deferredBlogQuery])

  // Load single blog post when slug is set
  useEffect(() => {
    if (!openBlogSlug) { setBlogPost(null); return }
    setBlogLoading(true)
    api(`/blogs/${openBlogSlug}`)
      .then(setBlogPost)
      .catch(() => setOpenBlogSlug(null))
      .finally(() => setBlogLoading(false))
  }, [openBlogSlug])

  useEffect(() => {
    if (!content || content.hero_slides.length < 2) return undefined
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % content.hero_slides.length), 7000)
    return () => window.clearInterval(timer)
  }, [content])


  if (contentError) return (
    <main className="landing-error">
      <Sparkles size={26} />
      <h1>Veera AI is temporarily unavailable</h1>
      <p>{contentError}</p>
      <button onClick={() => window.location.reload()}>Try again</button>
    </main>
  )

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
    {/* Blog reader overlay */}
    {openBlogSlug && (
      <div className="landing-blog-reader-overlay">
        <div className="landing-blog-reader-topbar">
          <button className="landing-blog-back-btn" onClick={() => setOpenBlogSlug(null)}>
            <ArrowLeft size={15} /> Back to site
          </button>
          <span className="landing-blog-reader-title">{blogPost?.title || 'Loading…'}</span>
        </div>
        {blogLoading && <div className="landing-blog-loading"><BookOpen size={28} /><span>Loading…</span></div>}
        {blogPost && (
          <>
            {blogPost.cover_image_url && <img className="landing-blog-cover" src={blogPost.cover_image_url} alt={blogPost.cover_image_alt || blogPost.title} />}
            <article className="landing-blog-content">
              {blogPost.tags?.length > 0 && (
                <div className="landing-blog-meta">
                  {blogPost.tags.map((tag) => <span className="landing-blog-tag" key={tag}>{tag}</span>)}
                </div>
              )}
              <h1 className="landing-blog-post-title">{blogPost.title}</h1>
              {blogPost.description && <p className="landing-blog-post-desc">{blogPost.description}</p>}
              {blogPost.blocks?.map((block, i) => <LandingBlogBlock key={i} block={block} />)}
            </article>
          </>
        )}
      </div>
    )}

    <nav className="landing-nav" aria-label="Public navigation">
      <a className="landing-brand" href="#top"><span><CircuitBoard size={21} /></span>{content.brand_name}</a>
      <div className="landing-nav-links">
        <a href="#projects">{content.portfolio_nav_label}</a>
        <a href="#capabilities">{content.capabilities_nav_label}</a>
        <a href="#roadmap">{content.roadmap_nav_label}</a>
        <a className="landing-blog-nav-link" href="#blog"><BookOpen size={14} /> Blog</a>
      </div>
      <div className="landing-auth-actions">
        {authenticated ? <button className="landing-register" onClick={onOpenWorkspace}>Open workspace<ArrowRight size={16} /></button> : <>
          <button onClick={onLogin}>{content.login_label}</button>
          <button className="landing-register" onClick={onRegister}>{content.register_label}<ArrowRight size={16} /></button>
        </>}
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
          <button onClick={authenticated ? onOpenWorkspace : onRegister}>{authenticated ? 'Open workspace' : content.primary_cta_label}<ArrowRight size={18} /></button>
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
            <div className="portfolio-actions">
              {project.blog_slug && (
                <button className="landing-project-blog-btn" onClick={() => setOpenBlogSlug(project.blog_slug)}>
                  <BookOpen size={14} /> Read about this project
                </button>
              )}
              {linkedControl(project.project_url, 'View project')}
            </div>
          </div>
        </article>)}
      </div>
      {pageCount > 1 && <nav className="portfolio-pagination" aria-label="Project pages">
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

    {/* Blog section */}
    <section className="landing-section landing-blog-section" id="blog">
      <header className="landing-section-heading">
        <div><p>BLOG &amp; INSIGHTS</p><h2>Project deep-dives &amp; technical write-ups</h2></div>
        <span>Detailed breakdowns of the architecture, decisions, and logic inside each project — with diagrams and code.</span>
      </header>
      <label className="landing-blog-search">
        <Search size={18} />
        <input
          type="search"
          value={blogQuery}
          onChange={(event) => { setBlogQuery(event.target.value); setBlogPage(1) }}
          placeholder="Search posts by topic, technology, or title"
          aria-label="Search public blog posts"
        />
      </label>
      {blogPosts.length > 0 ? (
        <>
          <div className="landing-blog-grid">
            {blogPosts.map((post) => (
              <article className="landing-blog-card" key={post.slug} onClick={() => setOpenBlogSlug(post.slug)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenBlogSlug(post.slug)}>
                {post.cover_image_url
                  ? <img className="landing-blog-card-cover" src={post.cover_image_url} alt={post.cover_image_alt || post.title} loading="lazy" />
                  : <div className="landing-blog-card-cover-ph"><BookOpen size={28} /></div>}
                <div className="landing-blog-card-body">
                  {post.tags?.length > 0 && <div className="landing-blog-card-tags">{post.tags.map((t) => <span key={t}>{t}</span>)}</div>}
                  <h3>{post.title}</h3>
                  <p>{post.description}</p>
                  <button className="landing-blog-card-read">Read post <ArrowRight size={13} /></button>
                </div>
              </article>
            ))}
          </div>
          {blogTotalPages > 1 && (
            <nav className="landing-blog-pagination">
              <button onClick={() => setBlogPage(blogPage - 1)} disabled={blogPage === 1}><ArrowLeft size={15} /> Previous</button>
              <span>Page <strong>{blogPage}</strong> of {blogTotalPages}</span>
              <button onClick={() => setBlogPage(blogPage + 1)} disabled={blogPage === blogTotalPages}>Next <ArrowRight size={15} /></button>
            </nav>
          )}
        </>
      ) : (
        <div className="landing-blog-empty"><BookOpen size={28} /><p>{blogQuery.trim() ? 'No posts match your search.' : 'No blog posts yet — check back soon.'}</p></div>
      )}
    </section>

    <section className="landing-cta">
      <div><Sparkles size={25} /><h2>{content.cta_title}</h2><p>{content.cta_description}</p></div>
      <button onClick={authenticated ? onOpenWorkspace : onRegister}>{authenticated ? 'Open workspace' : content.cta_button_label}<ArrowRight size={18} /></button>
    </section>

    <footer className="landing-footer">
      <div className="footer-brand"><span><CircuitBoard size={22} /></span><div><strong>{content.brand_name}</strong><p>{content.footer_description}</p></div></div>
      <div className="footer-links">{content.footer_links.map((link) => <span key={link.label}>{linkedControl(link.href, link.label)}</span>)}</div>
      <p className="footer-copyright">{content.footer_copyright}</p>
    </footer>
  </main>
}