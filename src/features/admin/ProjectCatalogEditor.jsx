import { useEffect, useState } from 'react'
import { ChevronDown, ImagePlus, Link2, Plus, Save, Search, Trash2, Upload } from 'lucide-react'
import { api } from '../../lib/api'
import Pager from '../../components/Pager'

// Each expanded project is a tall form, so a page of them turns the catalog
// into an endless scroll. Eight keeps the list a picker rather than a page.
const PROJECTS_PER_PAGE = 8

const NEW_PROJECT = {
  id: 'new-project', title: 'New project', summary: 'Describe what you built and why it matters.',
  category: 'Generative AI', tags: ['React'], image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1400&q=85',
  image_alt: 'Project preview', status: 'coming-soon', featured: false, show_public: true,
  show_workspace: true, display_order: 10, project_url: '#signin',
}

function Field({ label, value, onChange, multiline = false }) {
  const Control = multiline ? 'textarea' : 'input'
  return <label>{label}<Control value={value} rows={multiline ? 3 : undefined} onChange={(event) => onChange(event.target.value)} required /></label>
}

export default function ProjectCatalogEditor() {
  const [catalog, setCatalog] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [message, setMessage] = useState('')
  // One project open at a time. Every project expanded is a page of fifteen
  // near-identical forms, which is why nothing in it could be found.
  const [openId, setOpenId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    api('/admin/projects').then(setCatalog).catch((error) => setMessage(error.message))
  }, [])

  function update(field, value) {
    setCatalog((current) => ({ ...current, [field]: value }))
  }

  function updateProject(index, field, value) {
    setCatalog((current) => ({ ...current, projects: current.projects.map((project, projectIndex) => projectIndex === index ? { ...project, [field]: value } : project) }))
  }

  function addProject() {
    const id = `project-${Date.now()}`
    setCatalog((current) => ({ ...current, projects: [...current.projects, { ...NEW_PROJECT, id }] }))
  }

  async function uploadImage(event, project, index) {
    const picture = event.target.files?.[0]
    if (!picture) return
    setUploading(index)
    setMessage('')
    const body = new FormData()
    body.append('picture', picture)
    try {
      const result = await api(`/admin/projects/${encodeURIComponent(project.id)}/image`, { method: 'POST', body })
      updateProject(index, 'image_url', result.image_url)
      setMessage('Image uploaded to Cloudinary. Publish the catalog to save it.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setUploading(null)
      event.target.value = ''
    }
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      setCatalog(await api('/admin/projects', { method: 'PUT', body: JSON.stringify(catalog) }))
      setMessage('Project catalog published successfully.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  if (!catalog) return <p className="editor-loading">Loading project catalog...</p>
  const categories = [...new Set(catalog.projects.map((project) => project.category).filter(Boolean))]
  const term = search.trim().toLowerCase()
  // The original index is carried through the filter: it is what every update
  // writes against, so filtering on the mapped array would edit the wrong row.
  const rows = catalog.projects
    .map((project, index) => ({ project, index }))
    .filter(({ project }) => !term
      || `${project.title} ${project.id} ${project.category}`.toLowerCase().includes(term))
  const pageCount = Math.max(1, Math.ceil(rows.length / PROJECTS_PER_PAGE))
  // Clamped rather than reset, so removing the last row of the last page does
  // not strand the admin on an empty page.
  const currentPage = Math.min(page, pageCount)
  const pagedRows = rows.slice((currentPage - 1) * PROJECTS_PER_PAGE, currentPage * PROJECTS_PER_PAGE)

  function addAndOpen() {
    addProject()
    setOpenId(NEW_PROJECT.id)
    setSearch('')
    setPage(1)
  }

  return <form className="landing-editor project-catalog-editor" onSubmit={save}>
    <div className="editor-intro"><div><span>PROJECT MANAGEMENT</span><h2>Project catalog</h2><p>Create and modify the projects shown after login and in the public portfolio.</p></div><ImagePlus size={30} /></div>
    <section className="editor-section catalog-settings">
      <header><div><span>01</span><h3>Catalog presentation</h3></div></header>
      <div className="editor-grid">
        <Field label="Navigation label" value={catalog.nav_label} onChange={(value) => update('nav_label', value)} />
        <Field label="Section eyebrow" value={catalog.eyebrow} onChange={(value) => update('eyebrow', value)} />
        <Field label="Section title" value={catalog.title} onChange={(value) => update('title', value)} />
        <Field label="Section description" value={catalog.description} multiline onChange={(value) => update('description', value)} />
      </div>
    </section>
    <section className="editor-section">
      <header><div><span>02</span><h3>Projects</h3><p>{catalog.projects.length} configured{term && ` · ${rows.length} matching`}</p></div><button className="editor-add" type="button" onClick={addAndOpen}><Plus size={16} /> Add project</button></header>
      <label className="catalog-search"><Search size={16} /><input value={search} placeholder="Filter by title, id or category" onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label>
      <datalist id="project-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
      <div className="nested-list project-editor-list">{pagedRows.map(({ project, index }) => {
        const open = openId === project.id
        return <article className={`editor-item project-editor-item ${open ? 'open' : ''}`} key={project.id}>
        <div className="editor-item-head">
          <button type="button" className="catalog-row-toggle" aria-expanded={open}
                  onClick={() => setOpenId(open ? '' : project.id)}>
            <ChevronDown size={15} className={open ? 'rotated' : ''} />
            <strong>{project.title}</strong>
            <span className={`catalog-row-status ${project.status}`}>{project.status.replace('-', ' ')}</span>
            {!project.show_workspace && <span className="catalog-row-flag">hidden in workspace</span>}
            {project.featured && <span className="catalog-row-flag featured">featured</span>}
          </button>
          <button type="button" onClick={() => update('projects', catalog.projects.filter((_, projectIndex) => projectIndex !== index))} title="Remove project"><Trash2 size={16} /></button>
        </div>
        {open && <>
        <div className="project-image-editor">
          <img src={project.image_url} alt={project.image_alt} />
          <div><strong>Project cover</strong><span>Upload JPEG, PNG, or WebP up to 8 MB, or paste an HTTPS URL.</span><label className="editor-upload"><Upload size={15} />{uploading === index ? 'Uploading...' : 'Upload from device'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading !== null} onChange={(event) => uploadImage(event, project, index)} /></label></div>
        </div>
        <div className="editor-grid">
          <Field label="Stable project ID" value={project.id} onChange={(value) => updateProject(index, 'id', value)} />
          <Field label="Project title" value={project.title} onChange={(value) => updateProject(index, 'title', value)} />
          <label>Category<input list="project-categories" value={project.category} onChange={(event) => updateProject(index, 'category', event.target.value)} required /></label>
          <label>Status<select value={project.status} onChange={(event) => updateProject(index, 'status', event.target.value)}><option value="available">Available</option><option value="beta">Beta</option><option value="coming-soon">Coming soon</option></select></label>
          <Field label="Summary" value={project.summary} multiline onChange={(value) => updateProject(index, 'summary', value)} />
          <Field label="Tags (comma separated)" value={project.tags.join(', ')} onChange={(value) => updateProject(index, 'tags', value.split(',').map((tag) => tag.trim()).filter(Boolean))} />
          <label>Direct image URL<div className="input-with-icon"><Link2 size={16} /><input type="url" value={project.image_url} onChange={(event) => updateProject(index, 'image_url', event.target.value)} required /></div></label>
          <Field label="Image alt text" value={project.image_alt} onChange={(value) => updateProject(index, 'image_alt', value)} />
          <label>Display order<input type="number" min="0" max="999" value={project.display_order} onChange={(event) => updateProject(index, 'display_order', Number(event.target.value))} /></label>
          <Field label="Project URL, path, or anchor" value={project.project_url} onChange={(value) => updateProject(index, 'project_url', value)} />
          <Field label="Linked blog slug (optional)" value={project.blog_slug || ''} onChange={(value) => updateProject(index, 'blog_slug', value || null)} />
        </div>
        <div className="project-switches">
          <label><input type="checkbox" checked={project.show_workspace} onChange={(event) => updateProject(index, 'show_workspace', event.target.checked)} /><span>Show after login on Projects page</span></label>
          <label><input type="checkbox" checked={project.show_public} onChange={(event) => updateProject(index, 'show_public', event.target.checked)} /><span>Also show in public portfolio</span></label>
          <label><input type="checkbox" checked={project.featured} onChange={(event) => updateProject(index, 'featured', event.target.checked)} /><span>Feature this project</span></label>
        </div>
        </>}
      </article>})}
      {rows.length === 0 && <p className="empty-state">No projects match that filter.</p>}
      </div>
      <Pager page={currentPage} pageCount={pageCount} total={rows.length} noun="projects" onChange={setPage} />
    </section>
    <div className="editor-save-bar">{message && <p className={message.includes('successfully') || message.includes('Cloudinary') ? 'success-text' : 'error-text'}>{message}</p>}<button disabled={saving || uploading !== null}><Save size={17} />{saving ? 'Publishing...' : 'Publish project catalog'}</button></div>
  </form>
}