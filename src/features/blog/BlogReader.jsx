import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../lib/api'
import './BlogReader.css'

/* ----------------------------------------------------------------
   Inline text renderer — handles **bold**, *italic*, `code`
---------------------------------------------------------------- */
function InlineText({ text }) {
  // Simple tokenizer for bold / italic / code
  const parts = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={last}>{text.slice(last, match.index)}</span>)
    if (match[0].startsWith('**')) parts.push(<strong key={match.index}>{match[2]}</strong>)
    else if (match[0].startsWith('*')) parts.push(<em key={match.index}>{match[3]}</em>)
    else parts.push(<code key={match.index}>{match[4]}</code>)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(<span key={last}>{text.slice(last)}</span>)
  return <>{parts}</>
}

/* ----------------------------------------------------------------
   Mermaid block — lazily initialises mermaid and renders SVG
---------------------------------------------------------------- */
function MermaidDiagram({ content }) {
  const ref = useRef(null)
  const [error, setError] = useState('')
  const diagramId = useId()
  const idRef = useRef(`mermaid-${diagramId.replace(/:/g, '')}`)

  useEffect(() => {
    if (!ref.current) return
    let cancelled = false

    import('mermaid').then((mod) => {
      const mermaid = mod.default
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'strict',
        themeVariables: {
          primaryColor: '#7c6af7',
          primaryTextColor: '#f0f0f0',
          primaryBorderColor: '#5a4fcf',
          lineColor: '#9ca3af',
          sectionBkgColor: 'rgba(124,106,247,0.1)',
          altSectionBkgColor: 'rgba(255,255,255,0.02)',
          gridColor: 'rgba(255,255,255,0.06)',
          fontFamily: 'Inter, system-ui, sans-serif',
        },
      })

      mermaid.render(idRef.current, content).then(({ svg }) => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          setError('')
        }
      }).catch((err) => {
        if (!cancelled) setError(String(err?.message || 'Diagram parse error'))
      })
    })

    return () => { cancelled = true }
  }, [content])

  if (error) return (
    <div className="blog-block-mermaid">
      <p className="blog-mermaid-error">⚠ Diagram error: {error}</p>
      <pre style={{ color: '#9ca3af', fontSize: '0.8rem', textAlign: 'left', marginTop: '1rem' }}>{content}</pre>
    </div>
  )

  return <div className="blog-block-mermaid" ref={ref} />
}

/* ----------------------------------------------------------------
   Block renderer
---------------------------------------------------------------- */
function Block({ block }) {
  switch (block.type) {
    case 'heading1':
      return <h1 className="blog-block blog-block-h1">{block.content}</h1>
    case 'heading2':
      return <h2 className="blog-block blog-block-h2">{block.content}</h2>
    case 'heading3':
      return <h3 className="blog-block blog-block-h3">{block.content}</h3>
    case 'paragraph':
      return (
        <p className="blog-block blog-block-paragraph">
          <InlineText text={block.content} />
        </p>
      )
    case 'image':
      return (
        <div className="blog-block blog-block-image">
          <figure>
            <img src={block.url} alt={block.alt || ''} />
            {block.caption && <figcaption>{block.caption}</figcaption>}
          </figure>
        </div>
      )
    case 'mermaid':
      return (
        <div className="blog-block">
          <MermaidDiagram content={block.content} />
        </div>
      )
    case 'code':
      return (
        <div className="blog-block blog-block-code">
          {block.language && <span className="blog-code-lang">{block.language}</span>}
          <pre><code>{block.content}</code></pre>
        </div>
      )
    case 'table':
      return (
        <div className="blog-block blog-block-table">
          <table>
            <thead>
              <tr>{block.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows?.map((row, ri) => (
                <tr key={ri}>{row.cells.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'bullet-list':
      return (
        <div className="blog-block blog-block-list">
          <ul>{block.items.map((item, i) => <li key={i}><InlineText text={item} /></li>)}</ul>
        </div>
      )
    case 'numbered-list':
      return (
        <div className="blog-block blog-block-list">
          <ol>{block.items.map((item, i) => <li key={i}><InlineText text={item} /></li>)}</ol>
        </div>
      )
    case 'divider':
      return <hr className="blog-block blog-block-divider" />
    default:
      return null
  }
}

/* ----------------------------------------------------------------
   Main BlogReader component
---------------------------------------------------------------- */
export default function BlogReader({ slug, onBack }) {
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Scroll overlay to top whenever slug changes
    window.scrollTo(0, 0)
    setLoading(true)
    setError('')
    setPost(null)

    const endpoint = `/blogs/${slug}`
    api(endpoint)
      .then(setPost)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  function formatDate(dateStr) {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    } catch { return '' }
  }

  return (
    <div className="blog-reader-overlay">
      {/* Topbar */}
      <div className="blog-reader-topbar">
        <button className="blog-reader-back" onClick={onBack}>
          <ArrowLeft size={15} /> Back
        </button>
        <span className="blog-reader-topbar-title">{post?.title || 'Blog'}</span>
      </div>

      {loading && (
        <div className="blog-reader-loading">
          <div className="blog-reader-spinner" />
          <span>Loading post…</span>
        </div>
      )}

      {error && (
        <div className="blog-reader-loading">
          <p style={{ color: '#f87171' }}>Could not load post: {error}</p>
          <button onClick={onBack} style={{ color: '#7c6af7', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>← Go back</button>
        </div>
      )}

      {post && (
        <>
          {post.cover_image_url && (
            <img
              className="blog-reader-cover"
              src={post.cover_image_url}
              alt={post.cover_image_alt || post.title}
            />
          )}

          <article className="blog-reader-content">
            {post.tags?.length > 0 && (
              <div className="blog-reader-meta">
                {post.tags.map((tag) => <span className="blog-reader-tag" key={tag}>{tag}</span>)}
              </div>
            )}

            <h1 className="blog-reader-title">{post.title}</h1>
            {post.description && <p className="blog-reader-description">{post.description}</p>}
            {post.created_at && (
              <p className="blog-reader-dateline">Published {formatDate(post.created_at)}</p>
            )}

            {post.blocks?.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </article>
        </>
      )}
    </div>
  )
}
