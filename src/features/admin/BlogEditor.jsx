import { useEffect, useId, useRef, useState } from 'react'
import {
  AlignLeft, BookOpen, ChevronDown, ChevronUp, Code2, Columns2,
  Heading1, Heading2, Heading3, Image, List, ListOrdered,
  Minus, Plus, Save, Send, Trash2, Upload, X,
} from 'lucide-react'
import { api } from '../../lib/api'
import './BlogEditor.css'

/* ----------------------------------------------------------------
   Mermaid live preview (inside admin editor)
---------------------------------------------------------------- */
function MermaidPreview({ content }) {
  const ref = useRef(null)
  const diagramId = useId()
  const idRef = useRef(`mermaid-prev-${diagramId.replace(/:/g, '')}`)

  useEffect(() => {
    if (!ref.current || !content.trim()) return
    let cancelled = false
    import('mermaid').then((mod) => {
      const mermaid = mod.default
      mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' })
      mermaid.render(idRef.current, content).then(({ svg }) => {
        if (!cancelled && ref.current) ref.current.innerHTML = svg
      }).catch(() => {
        if (!cancelled && ref.current) ref.current.innerHTML = '<span style="color:#f87171;font-size:0.8rem">⚠ Diagram syntax error</span>'
      })
    })
    return () => { cancelled = true }
  }, [content])

  if (!content.trim()) return null
  return <div className="blog-mermaid-preview" ref={ref} />
}

/* ----------------------------------------------------------------
   Block editors
---------------------------------------------------------------- */
function HeadingBlockEditor({ block, onChange }) {
  return (
    <div className="blog-block-item-body">
      <input
        value={block.content}
        onChange={(e) => onChange({ ...block, content: e.target.value })}
        placeholder={`${block.type === 'heading1' ? 'H1' : block.type === 'heading2' ? 'H2' : 'H3'} Heading text…`}
      />
    </div>
  )
}

function ParagraphBlockEditor({ block, onChange }) {
  return (
    <div className="blog-block-item-body">
      <textarea
        value={block.content}
        onChange={(e) => onChange({ ...block, content: e.target.value })}
        placeholder="Paragraph text… Use **bold**, *italic*, `code`"
        style={{ minHeight: 90 }}
      />
    </div>
  )
}

function ImageBlockEditor({ block, onChange, onUpload }) {
  return (
    <div className="blog-block-item-body blog-image-block-editor">
      {block.url && <img src={block.url} alt={block.alt || ''} />}
      <label className="blog-cover-upload-btn">
        <Upload size={14} /> Upload image to HuggingFace
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            onUpload(file, (url) => onChange({ ...block, url }))
            e.target.value = ''
          }}
        />
      </label>
      <input
        value={block.url}
        onChange={(e) => onChange({ ...block, url: e.target.value })}
        placeholder="…or paste HTTPS image URL"
      />
      <input
        value={block.alt || ''}
        onChange={(e) => onChange({ ...block, alt: e.target.value })}
        placeholder="Alt text (accessibility)"
      />
      <input
        value={block.caption || ''}
        onChange={(e) => onChange({ ...block, caption: e.target.value })}
        placeholder="Caption (optional)"
      />
    </div>
  )
}

function MermaidBlockEditor({ block, onChange }) {
  return (
    <div className="blog-block-item-body blog-block-code-editor">
      <textarea
        value={block.content}
        onChange={(e) => onChange({ ...block, content: e.target.value })}
        placeholder={`graph TD\n  A[Start] --> B[Process]\n  B --> C[End]`}
        style={{ fontFamily: 'monospace', minHeight: 120 }}
      />
      <MermaidPreview content={block.content} />
    </div>
  )
}

function CodeBlockEditor({ block, onChange }) {
  return (
    <div className="blog-block-item-body blog-block-code-editor">
      <input
        value={block.language || ''}
        onChange={(e) => onChange({ ...block, language: e.target.value })}
        placeholder="Language (e.g. python, javascript, bash)"
        style={{ marginBottom: '0.4rem' }}
      />
      <textarea
        value={block.content}
        onChange={(e) => onChange({ ...block, content: e.target.value })}
        placeholder="Paste your code here…"
        style={{ fontFamily: 'monospace', minHeight: 160 }}
      />
    </div>
  )
}

function TableBlockEditor({ block, onChange }) {
  const addHeader = () => onChange({ ...block, headers: [...block.headers, ''] })
  const updateHeader = (i, v) => onChange({ ...block, headers: block.headers.map((h, idx) => idx === i ? v : h) })
  const removeHeader = (i) => {
    const headers = block.headers.filter((_, idx) => idx !== i)
    const rows = (block.rows || []).map((row) => ({ cells: row.cells.filter((_, idx) => idx !== i) }))
    onChange({ ...block, headers, rows })
  }
  const addRow = () => onChange({ ...block, rows: [...(block.rows || []), { cells: block.headers.map(() => '') }] })
  const updateCell = (ri, ci, v) => {
    const rows = (block.rows || []).map((row, rIdx) =>
      rIdx === ri ? { cells: row.cells.map((c, cIdx) => cIdx === ci ? v : c) } : row
    )
    onChange({ ...block, rows })
  }
  const removeRow = (ri) => onChange({ ...block, rows: (block.rows || []).filter((_, i) => i !== ri) })

  return (
    <div className="blog-block-item-body blog-table-editor">
      <div>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Headers</p>
        <div className="blog-table-headers">
          {block.headers.map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <input value={h} onChange={(e) => updateHeader(i, e.target.value)} placeholder={`Col ${i + 1}`} style={{ width: 100 }} />
              <button className="blog-block-delete-btn" onClick={() => removeHeader(i)} type="button"><X size={12} /></button>
            </div>
          ))}
          <button className="blog-table-add-btn" type="button" onClick={addHeader}><Plus size={13} /> Column</button>
        </div>
      </div>
      <div>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rows</p>
        {(block.rows || []).map((row, ri) => (
          <div key={ri} className="blog-table-row" style={{ marginBottom: '0.35rem' }}>
            {row.cells.map((cell, ci) => (
              <input key={ci} value={cell} onChange={(e) => updateCell(ri, ci, e.target.value)} placeholder={block.headers[ci] || `Cell`} />
            ))}
            <button className="blog-block-delete-btn" onClick={() => removeRow(ri)} type="button"><Trash2 size={13} /></button>
          </div>
        ))}
        <button className="blog-table-add-btn" type="button" onClick={addRow}><Plus size={13} /> Row</button>
      </div>
    </div>
  )
}

function ListBlockEditor({ block, onChange }) {
  const updateItem = (i, v) => onChange({ ...block, items: block.items.map((item, idx) => idx === i ? v : item) })
  const addItem = () => onChange({ ...block, items: [...block.items, ''] })
  const removeItem = (i) => onChange({ ...block, items: block.items.filter((_, idx) => idx !== i) })

  return (
    <div className="blog-block-item-body blog-list-editor">
      {block.items.map((item, i) => (
        <div key={i} className="blog-list-item-row">
          <span style={{ fontSize: '0.75rem', color: 'var(--royal)', minWidth: 20 }}>
            {block.type === 'numbered-list' ? `${i + 1}.` : '•'}
          </span>
          <input value={item} onChange={(e) => updateItem(i, e.target.value)} placeholder={`Item ${i + 1}`} />
          <button className="blog-block-delete-btn" onClick={() => removeItem(i)} type="button"><X size={12} /></button>
        </div>
      ))}
      <button className="blog-table-add-btn" type="button" onClick={addItem}><Plus size={13} /> Item</button>
    </div>
  )
}

/* ----------------------------------------------------------------
   Block item wrapper with move/delete controls
---------------------------------------------------------------- */
const BLOCK_LABELS = {
  heading1: 'Heading 1', heading2: 'Heading 2', heading3: 'Heading 3',
  paragraph: 'Paragraph', image: 'Image', mermaid: 'Mermaid Diagram',
  code: 'Code Block', table: 'Table', 'bullet-list': 'Bullet List',
  'numbered-list': 'Numbered List', divider: 'Divider',
}

function BlockItem({ block, index, total, onChange, onMove, onDelete, onUploadImage }) {
  function renderEditor() {
    if (block.type === 'heading1' || block.type === 'heading2' || block.type === 'heading3')
      return <HeadingBlockEditor block={block} onChange={onChange} />
    if (block.type === 'paragraph')
      return <ParagraphBlockEditor block={block} onChange={onChange} />
    if (block.type === 'image')
      return <ImageBlockEditor block={block} onChange={onChange} onUpload={onUploadImage} />
    if (block.type === 'mermaid')
      return <MermaidBlockEditor block={block} onChange={onChange} />
    if (block.type === 'code')
      return <CodeBlockEditor block={block} onChange={onChange} />
    if (block.type === 'table')
      return <TableBlockEditor block={block} onChange={onChange} />
    if (block.type === 'bullet-list' || block.type === 'numbered-list')
      return <ListBlockEditor block={block} onChange={onChange} />
    if (block.type === 'divider')
      return <div className="blog-block-item-body" style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)', fontSize: '0.8rem' }}>— Horizontal rule —</div>
    return null
  }

  return (
    <div className="blog-block-item">
      <div className="blog-block-item-head">
        <span className="blog-block-type-label">{BLOCK_LABELS[block.type] || block.type}</span>
        <button className="blog-block-move-btn" type="button" onClick={() => onMove(index, -1)} disabled={index === 0} title="Move up"><ChevronUp size={14} /></button>
        <button className="blog-block-move-btn" type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1} title="Move down"><ChevronDown size={14} /></button>
        <button className="blog-block-delete-btn" type="button" onClick={() => onDelete(index)} title="Delete block"><Trash2 size={14} /></button>
      </div>
      {renderEditor()}
    </div>
  )
}

/* ----------------------------------------------------------------
   Default blocks per type
---------------------------------------------------------------- */
function defaultBlock(type) {
  if (type === 'heading1' || type === 'heading2' || type === 'heading3') return { type, content: '' }
  if (type === 'paragraph') return { type, content: '' }
  if (type === 'image') return { type, url: '', alt: '', caption: '' }
  if (type === 'mermaid') return { type, content: 'graph TD\n  A[Start] --> B[End]' }
  if (type === 'code') return { type, language: '', content: '' }
  if (type === 'table') return { type, headers: ['Column 1', 'Column 2'], rows: [{ cells: ['', ''] }] }
  if (type === 'bullet-list') return { type, items: [''] }
  if (type === 'numbered-list') return { type, items: [''] }
  if (type === 'divider') return { type }
  return { type }
}

/* ----------------------------------------------------------------
   Default new post template
---------------------------------------------------------------- */
const NEW_POST_TEMPLATE = {
  slug: `post-${Date.now()}`,
  title: 'New blog post',
  description: 'A brief description of this post.',
  cover_image_url: '',
  cover_image_alt: '',
  tags: [],
  project_id: null,
  published: false,
  blocks: [],
}

/* ----------------------------------------------------------------
   Main BlogEditor component
---------------------------------------------------------------- */
export default function BlogEditor() {
  const [posts, setPosts] = useState([])
  const [selectedSlug, setSelectedSlug] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [isNewPost, setIsNewPost] = useState(false)

  // Load post list
  useEffect(() => {
    api('/admin/blogs?page=1')
      .then(async (data) => {
        const remainingPages = await Promise.all(
          Array.from({ length: data.total_pages - 1 }, (_, index) => api(`/admin/blogs?page=${index + 2}`)),
        )
        setPosts([data, ...remainingPages].flatMap((page) => page.posts))
      })
      .catch((err) => setMessage({ text: err.message, type: 'error' }))
  }, [])

  // Load selected post
  useEffect(() => {
    if (!selectedSlug || isNewPost) return
    api(`/admin/blogs/${selectedSlug}`)
      .then(setDraft)
      .catch((err) => setMessage({ text: err.message, type: 'error' }))
  }, [selectedSlug, isNewPost])

  function showMessage(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 4000)
  }

  function startNew() {
    setIsNewPost(true)
    setSelectedSlug('__new__')
    setDraft({ ...NEW_POST_TEMPLATE, slug: `post-${Date.now()}` })
    setMessage({ text: '', type: '' })
  }

  function selectPost(post) {
    setIsNewPost(false)
    setSelectedSlug(post.slug)
    setDraft(null)
    setMessage({ text: '', type: '' })
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    try {
      if (isNewPost) {
        const created = await api('/admin/blogs', { method: 'POST', body: JSON.stringify(draft) })
        setIsNewPost(false)
        setSelectedSlug(created.slug)
        setDraft(created)
        setPosts((prev) => [created, ...prev])
        showMessage('Post created! Continue editing.')
      } else {
        const updated = await api(`/admin/blogs/${draft.slug}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: draft.title,
            description: draft.description,
            cover_image_url: draft.cover_image_url,
            cover_image_alt: draft.cover_image_alt,
            tags: draft.tags,
            project_id: draft.project_id || null,
            published: draft.published,
            blocks: draft.blocks,
          }),
        })
        setDraft(updated)
        setPosts((prev) => prev.map((p) => p.slug === updated.slug ? updated : p))
        showMessage('Saved successfully.')
      }
    } catch (err) {
      showMessage(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function togglePublish() {
    if (!draft) return
    const newPublished = !draft.published
    const updated = { ...draft, published: newPublished }
    setDraft(updated)
    try {
      await api(`/admin/blogs/${draft.slug}`, {
        method: 'PUT',
        body: JSON.stringify({ published: newPublished }),
      })
      setPosts((prev) => prev.map((p) => p.slug === draft.slug ? { ...p, published: newPublished } : p))
      showMessage(newPublished ? 'Post published!' : 'Post set to draft.')
    } catch (err) {
      setDraft(draft) // revert
      showMessage(err.message, 'error')
    }
  }

  async function deletePost() {
    if (!draft || !window.confirm(`Delete "${draft.title}"? This cannot be undone.`)) return
    try {
      await api(`/admin/blogs/${draft.slug}`, { method: 'DELETE' })
      setPosts((prev) => prev.filter((p) => p.slug !== draft.slug))
      setSelectedSlug(null)
      setDraft(null)
      setIsNewPost(false)
      showMessage('Post deleted.')
    } catch (err) {
      showMessage(err.message, 'error')
    }
  }

  async function uploadCoverImage(file) {
    if (!draft?.slug || isNewPost) {
      showMessage('Save the post first, then upload images.', 'error')
      return
    }
    setUploading(true)
    const body = new FormData()
    body.append('image', file)
    try {
      const result = await api(`/admin/blogs/${draft.slug}/images`, { method: 'POST', body })
      setDraft((d) => ({ ...d, cover_image_url: result.image_url }))
      showMessage('Cover image uploaded to HuggingFace.')
    } catch (err) {
      showMessage(err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  async function uploadBlockImage(file, callback) {
    if (!draft?.slug || isNewPost) {
      showMessage('Save the post first, then upload images.', 'error')
      return
    }
    setUploading(true)
    const body = new FormData()
    body.append('image', file)
    try {
      const result = await api(`/admin/blogs/${draft.slug}/images`, { method: 'POST', body })
      callback(result.image_url)
    } catch (err) {
      showMessage(err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  function updateBlock(index, newBlock) {
    setDraft((d) => ({ ...d, blocks: d.blocks.map((b, i) => i === index ? newBlock : b) }))
  }

  function addBlock(type) {
    setDraft((d) => ({ ...d, blocks: [...d.blocks, defaultBlock(type)] }))
  }

  function moveBlock(index, direction) {
    setDraft((d) => {
      const blocks = [...d.blocks]
      const target = index + direction
      if (target < 0 || target >= blocks.length) return d
      ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
      return { ...d, blocks }
    })
  }

  function deleteBlock(index) {
    setDraft((d) => ({ ...d, blocks: d.blocks.filter((_, i) => i !== index) }))
  }

  const ADD_BLOCKS = [
    { type: 'heading1', icon: <Heading1 size={13} />, label: 'H1' },
    { type: 'heading2', icon: <Heading2 size={13} />, label: 'H2' },
    { type: 'heading3', icon: <Heading3 size={13} />, label: 'H3' },
    { type: 'paragraph', icon: <AlignLeft size={13} />, label: 'Paragraph' },
    { type: 'image', icon: <Image size={13} />, label: 'Image' },
    { type: 'mermaid', icon: <Columns2 size={13} />, label: 'Mermaid' },
    { type: 'code', icon: <Code2 size={13} />, label: 'Code' },
    { type: 'table', icon: <Columns2 size={13} />, label: 'Table' },
    { type: 'bullet-list', icon: <List size={13} />, label: 'Bullet List' },
    { type: 'numbered-list', icon: <ListOrdered size={13} />, label: 'Numbered List' },
    { type: 'divider', icon: <Minus size={13} />, label: 'Divider' },
  ]

  return (
    <div className="blog-editor-shell">
      {/* Sidebar */}
      <aside className="blog-editor-sidebar">
        <div className="blog-editor-sidebar-head">
          <h3>Blog Posts</h3>
          <button className="blog-editor-new-btn" onClick={startNew}>
            <Plus size={13} /> New post
          </button>
        </div>
        <div className="blog-editor-post-list">
          {posts.map((post) => (
            <button
              key={post.slug}
              className={`blog-editor-post-item ${selectedSlug === post.slug ? 'active' : ''}`}
              onClick={() => selectPost(post)}
            >
              <p className="blog-editor-post-title">{post.title}</p>
              <div className="blog-editor-post-meta">
                <span className={`blog-status-badge ${post.published ? 'published' : 'draft'}`}>
                  {post.published ? 'Published' : 'Draft'}
                </span>
                <span>{post.tags?.slice(0, 2).join(', ')}</span>
              </div>
            </button>
          ))}
          {!posts.length && (
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', padding: '1rem', textAlign: 'center' }}>
              No posts yet. Create one →
            </p>
          )}
        </div>
      </aside>

      {/* Main editor */}
      <div className="blog-editor-main">
        {/* Toolbar */}
        <div className="blog-editor-toolbar">
          <div className="blog-editor-toolbar-left">
            <BookOpen size={18} style={{ color: 'var(--royal)' }} />
            <strong style={{ fontSize: '0.9rem', color: 'var(--navy)' }}>
              {draft ? draft.title : 'Select or create a post'}
            </strong>
          </div>

          {draft && (
            <div className="blog-editor-toolbar-right">
              {message.text && (
                <span className={`blog-editor-message ${message.type}`}>{message.text}</span>
              )}
              <button
                className="blog-toolbar-action blog-toolbar-save"
                onClick={save}
                disabled={saving || uploading}
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
              {!isNewPost && (
                <>
                  <button
                    className={`blog-toolbar-action ${draft.published ? 'blog-toolbar-unpublish' : 'blog-toolbar-publish'}`}
                    onClick={togglePublish}
                  >
                    <Send size={14} /> {draft.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button className="blog-toolbar-action blog-toolbar-delete" onClick={deletePost}>
                    <Trash2 size={14} /> Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="blog-editor-body">
          {!draft ? (
            <div className="blog-editor-empty">
              <BookOpen size={40} />
              <p>Select a post from the sidebar or create a new one</p>
            </div>
          ) : (
            <>
              {/* Metadata */}
              <div className="blog-meta-card">
                <label>
                  Slug (URL identifier)
                  <input
                    value={draft.slug}
                    onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                    placeholder="my-project-blog"
                    disabled={!isNewPost}
                    style={{ opacity: isNewPost ? 1 : 0.5 }}
                  />
                </label>

                <label>
                  Title
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    placeholder="Post title"
                  />
                </label>

                <label className="full-width">
                  Short description (shown on blog cards)
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    placeholder="Brief summary shown in the blog card grid…"
                    rows={2}
                  />
                </label>

                <label>
                  Tags (comma separated)
                  <input
                    value={(draft.tags || []).join(', ')}
                    onChange={(e) => setDraft((d) => ({
                      ...d,
                      tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                    }))}
                    placeholder="FastAPI, React, RAG"
                  />
                </label>

                <label>
                  Linked project ID (optional)
                  <input
                    value={draft.project_id || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, project_id: e.target.value || null }))}
                    placeholder="e.g. basic-rag"
                  />
                </label>

                {/* Cover image */}
                <div className="full-width blog-cover-section">
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                    Cover image
                    <input
                      value={draft.cover_image_url || ''}
                      onChange={(e) => setDraft((d) => ({ ...d, cover_image_url: e.target.value }))}
                      placeholder="https://… or upload below"
                    />
                  </label>
                  {draft.cover_image_url && (
                    <img className="blog-cover-preview" src={draft.cover_image_url} alt="Cover preview" />
                  )}
                  <label className="blog-cover-upload-btn">
                    <Upload size={14} />
                    {uploading ? 'Uploading…' : 'Upload cover'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCoverImage(f); e.target.value = '' }}
                    />
                  </label>
                </div>

                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  Cover image alt text
                  <input
                    value={draft.cover_image_alt || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, cover_image_alt: e.target.value }))}
                    placeholder="Describe the cover image"
                  />
                </label>
              </div>

              {/* Blocks */}
              <div className="blog-blocks-section">
                <div className="blog-blocks-header">
                  <h3>Content blocks ({draft.blocks.length})</h3>
                </div>

                {/* Add block toolbar */}
                <div className="blog-add-block-bar">
                  {ADD_BLOCKS.map(({ type, icon, label }) => (
                    <button
                      key={type}
                      className="blog-add-block-btn"
                      type="button"
                      onClick={() => addBlock(type)}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>

                {/* Block list */}
                {draft.blocks.map((block, index) => (
                  <BlockItem
                    key={index}
                    block={block}
                    index={index}
                    total={draft.blocks.length}
                    onChange={(newBlock) => updateBlock(index, newBlock)}
                    onMove={moveBlock}
                    onDelete={deleteBlock}
                    onUploadImage={uploadBlockImage}
                  />
                ))}

                {draft.blocks.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem', border: '1px dashed var(--line)', borderRadius: 8 }}>
                    Use the toolbar above to add content blocks
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
