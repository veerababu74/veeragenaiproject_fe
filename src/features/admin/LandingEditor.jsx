import { useEffect, useState } from 'react'
import { Image, Plus, Save, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'

const NEW_SLIDE = { eyebrow: 'NEW STORY', title: 'A new engineering story', description: 'Describe this story.', image_url: '', image_alt: 'Describe the image' }
const NEW_METRIC = { value: '0', label: 'New metric' }
const NEW_FEATURE = { icon: 'cpu', eyebrow: 'AI', title: 'New capability', description: 'Describe this capability.' }
const NEW_ROADMAP = { phase: 'NEXT', title: 'New milestone', description: 'Describe this milestone.', status: 'planned' }
const NEW_LINK = { label: 'New link', href: '#top' }

function Field({ label, value, onChange, multiline = false }) {
  const Control = multiline ? 'textarea' : 'input'
  return <label>{label}<Control value={value} rows={multiline ? 3 : undefined} onChange={(event) => onChange(event.target.value)} required /></label>
}

export default function LandingEditor() {
  const [content, setContent] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api('/admin/landing').then(setContent).catch((error) => setMessage(error.message))
  }, [])

  function update(field, value) {
    setContent((current) => ({ ...current, [field]: value }))
  }

  function updateItem(field, index, key, value) {
    setContent((current) => ({ ...current, [field]: current[field].map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }))
  }

  function addItem(field, template) {
    setContent((current) => ({ ...current, [field]: [...current[field], { ...template }] }))
  }

  function removeItem(field, index) {
    setContent((current) => ({ ...current, [field]: current[field].filter((_, itemIndex) => itemIndex !== index) }))
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      setContent(await api('/admin/landing', { method: 'PUT', body: JSON.stringify(content) }))
      setMessage('Landing page published successfully.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  if (!content) return <p className="editor-loading">Loading landing content...</p>

  return <form className="landing-editor" onSubmit={save}>
    <div className="editor-intro"><div><span>LANDING CONTENT</span><h2>Public experience</h2><p>Edit every public section and publish in one update.</p></div><Image size={30} /></div>

    <section className="editor-section">
      <header><div><span>01</span><h3>Brand and navigation</h3></div></header>
      <div className="editor-grid">
        <Field label="Brand name" value={content.brand_name} onChange={(value) => update('brand_name', value)} />
        <Field label="Announcement" value={content.announcement} onChange={(value) => update('announcement', value)} />
        <Field label="Capabilities nav label" value={content.capabilities_nav_label} onChange={(value) => update('capabilities_nav_label', value)} />
        <Field label="Roadmap nav label" value={content.roadmap_nav_label} onChange={(value) => update('roadmap_nav_label', value)} />
        <Field label="Sign-in label" value={content.login_label} onChange={(value) => update('login_label', value)} />
        <Field label="Register label" value={content.register_label} onChange={(value) => update('register_label', value)} />
        <Field label="Hero primary button" value={content.primary_cta_label} onChange={(value) => update('primary_cta_label', value)} />
        <Field label="Hero secondary button" value={content.secondary_cta_label} onChange={(value) => update('secondary_cta_label', value)} />
      </div>
    </section>

    <EditorList title="Hero carousel" number="02" items={content.hero_slides} onAdd={() => addItem('hero_slides', NEW_SLIDE)} onRemove={(index) => removeItem('hero_slides', index)}>
      {(item, index) => <div className="editor-grid">
        <Field label="Eyebrow" value={item.eyebrow} onChange={(value) => updateItem('hero_slides', index, 'eyebrow', value)} />
        <Field label="Title" value={item.title} onChange={(value) => updateItem('hero_slides', index, 'title', value)} />
        <Field label="Description" value={item.description} multiline onChange={(value) => updateItem('hero_slides', index, 'description', value)} />
        <Field label="Image URL" value={item.image_url} onChange={(value) => updateItem('hero_slides', index, 'image_url', value)} />
        <Field label="Image alt text" value={item.image_alt} onChange={(value) => updateItem('hero_slides', index, 'image_alt', value)} />
      </div>}
    </EditorList>

    <EditorList title="Highlight metrics" number="03" items={content.metrics} onAdd={() => addItem('metrics', NEW_METRIC)} onRemove={(index) => removeItem('metrics', index)} compact>
      {(item, index) => <div className="editor-grid"><Field label="Value" value={item.value} onChange={(value) => updateItem('metrics', index, 'value', value)} /><Field label="Label" value={item.label} onChange={(value) => updateItem('metrics', index, 'label', value)} /></div>}
    </EditorList>

    <section className="editor-section">
      <header><div><span>04</span><h3>Capabilities section</h3></div></header>
      <div className="editor-grid">
        <Field label="Eyebrow" value={content.features_eyebrow} onChange={(value) => update('features_eyebrow', value)} />
        <Field label="Title" value={content.features_title} onChange={(value) => update('features_title', value)} />
        <Field label="Description" value={content.features_description} multiline onChange={(value) => update('features_description', value)} />
      </div>
      <div className="nested-list">{content.features.map((item, index) => <div className="editor-item" key={`${item.title}-${index}`}><div className="editor-item-head"><strong>Card {index + 1}</strong><button type="button" onClick={() => removeItem('features', index)} title="Remove card"><Trash2 size={16} /></button></div><div className="editor-grid">
        <label>Icon<select value={item.icon} onChange={(event) => updateItem('features', index, 'icon', event.target.value)}>{['robot', 'brain', 'cpu', 'vision', 'chart', 'workflow'].map((icon) => <option key={icon}>{icon}</option>)}</select></label>
        <Field label="Eyebrow" value={item.eyebrow} onChange={(value) => updateItem('features', index, 'eyebrow', value)} />
        <Field label="Title" value={item.title} onChange={(value) => updateItem('features', index, 'title', value)} />
        <Field label="Description" value={item.description} multiline onChange={(value) => updateItem('features', index, 'description', value)} />
      </div></div>)}</div>
      <button className="editor-add" type="button" onClick={() => addItem('features', NEW_FEATURE)}><Plus size={16} /> Add capability</button>
    </section>

    <section className="editor-section">
      <header><div><span>05</span><h3>Roadmap</h3></div></header>
      <div className="editor-grid">
        <Field label="Eyebrow" value={content.roadmap_eyebrow} onChange={(value) => update('roadmap_eyebrow', value)} />
        <Field label="Title" value={content.roadmap_title} onChange={(value) => update('roadmap_title', value)} />
        <Field label="Description" value={content.roadmap_description} multiline onChange={(value) => update('roadmap_description', value)} />
      </div>
      <div className="nested-list">{content.roadmap.map((item, index) => <div className="editor-item" key={`${item.title}-${index}`}><div className="editor-item-head"><strong>Milestone {index + 1}</strong><button type="button" onClick={() => removeItem('roadmap', index)} title="Remove milestone"><Trash2 size={16} /></button></div><div className="editor-grid">
        <Field label="Phase" value={item.phase} onChange={(value) => updateItem('roadmap', index, 'phase', value)} />
        <label>Status<select value={item.status} onChange={(event) => updateItem('roadmap', index, 'status', event.target.value)}><option value="available">Available</option><option value="building">Building</option><option value="planned">Planned</option></select></label>
        <Field label="Title" value={item.title} onChange={(value) => updateItem('roadmap', index, 'title', value)} />
        <Field label="Description" value={item.description} multiline onChange={(value) => updateItem('roadmap', index, 'description', value)} />
      </div></div>)}</div>
      <button className="editor-add" type="button" onClick={() => addItem('roadmap', NEW_ROADMAP)}><Plus size={16} /> Add milestone</button>
    </section>

    <section className="editor-section">
      <header><div><span>06</span><h3>Call to action and footer</h3></div></header>
      <div className="editor-grid">
        <Field label="CTA title" value={content.cta_title} onChange={(value) => update('cta_title', value)} />
        <Field label="CTA description" value={content.cta_description} multiline onChange={(value) => update('cta_description', value)} />
        <Field label="CTA button" value={content.cta_button_label} onChange={(value) => update('cta_button_label', value)} />
        <Field label="Footer description" value={content.footer_description} multiline onChange={(value) => update('footer_description', value)} />
        <Field label="Copyright" value={content.footer_copyright} onChange={(value) => update('footer_copyright', value)} />
      </div>
      <div className="nested-list">{content.footer_links.map((item, index) => <div className="editor-item compact" key={`${item.label}-${index}`}><div className="editor-item-head"><strong>Footer link {index + 1}</strong><button type="button" onClick={() => removeItem('footer_links', index)} title="Remove link"><Trash2 size={16} /></button></div><div className="editor-grid"><Field label="Label" value={item.label} onChange={(value) => updateItem('footer_links', index, 'label', value)} /><Field label="URL or anchor" value={item.href} onChange={(value) => updateItem('footer_links', index, 'href', value)} /></div></div>)}</div>
      <button className="editor-add" type="button" onClick={() => addItem('footer_links', NEW_LINK)}><Plus size={16} /> Add footer link</button>
    </section>

    <div className="editor-save-bar">{message && <p className={message.includes('successfully') ? 'success-text' : 'error-text'}>{message}</p>}<button disabled={saving}><Save size={17} />{saving ? 'Publishing...' : 'Publish landing page'}</button></div>
  </form>
}

function EditorList({ title, number, items, onAdd, onRemove, children, compact = false }) {
  return <section className="editor-section"><header><div><span>{number}</span><h3>{title}</h3></div><button className="editor-add" type="button" onClick={onAdd}><Plus size={16} /> Add</button></header><div className="nested-list">{items.map((item, index) => <div className={`editor-item ${compact ? 'compact' : ''}`} key={`${item.title || item.label}-${index}`}><div className="editor-item-head"><strong>{title.replace(/s$/, '')} {index + 1}</strong><button type="button" onClick={() => onRemove(index)} title={`Remove ${title}`}><Trash2 size={16} /></button></div>{children(item, index)}</div>)}</div></section>
}