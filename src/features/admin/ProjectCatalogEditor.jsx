import { useEffect, useState } from 'react'
import { ImagePlus, Link2, Plus, Save, Trash2, Upload } from 'lucide-react'
import { api } from '../../lib/api'

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
      <header><div><span>02</span><h3>Projects</h3><p>{catalog.projects.length} configured</p></div><button className="editor-add" type="button" onClick={addProject}><Plus size={16} /> Add project</button></header>
      <datalist id="project-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
      <div className="nested-list project-editor-list">{catalog.projects.map((project, index) => <article className="editor-item project-editor-item" key={project.id}>
        <div className="editor-item-head"><strong>{project.title}</strong><button type="button" onClick={() => update('projects', catalog.projects.filter((_, projectIndex) => projectIndex !== index))} title="Remove project"><Trash2 size={16} /></button></div>
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
      </article>)}</div>
    </section>
    <div className="editor-save-bar">{message && <p className={message.includes('successfully') || message.includes('Cloudinary') ? 'success-text' : 'error-text'}>{message}</p>}<button disabled={saving || uploading !== null}><Save size={17} />{saving ? 'Publishing...' : 'Publish project catalog'}</button></div>
  </form>
}