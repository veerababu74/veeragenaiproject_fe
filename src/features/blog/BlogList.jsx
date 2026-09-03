import { useDeferredValue, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, FileText, Search } from 'lucide-react'
import { api } from '../../lib/api'
import './BlogList.css'

// Sent explicitly rather than relying on the API default, which is also the
// API maximum — inheriting it meant every post fitted on one page and the
// pager never appeared. Must stay at or below the server's cap.
const PAGE_SIZE = 6

export default function BlogList({ onOpenPost, adminMode = false }) {
  const [posts, setPosts] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    setLoading(true)
    const search = deferredQuery.trim()
    const endpoint = adminMode
      ? `/admin/blogs?page=${page}&page_size=${PAGE_SIZE}`
      : `/blogs?page=${page}&page_size=${PAGE_SIZE}${search ? `&search=${encodeURIComponent(search)}` : ''}`
    api(endpoint)
      .then((data) => {
        setPosts(data.posts)
        setTotal(data.total)
        setTotalPages(data.total_pages)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, adminMode, deferredQuery])

  const searchControl = !adminMode && (
    <label className="blog-search">
      <Search size={18} />
      <input
        type="search"
        value={query}
        onChange={(event) => { setQuery(event.target.value); setPage(1) }}
        placeholder="Search posts by topic, technology, or title"
        aria-label="Search blog posts"
      />
    </label>
  )

  function formatDate(dateStr) {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return ''
    }
  }

  if (loading) return (
    <div className="blog-empty">
      <BookOpen size={30} />
      <h3>Loading posts…</h3>
    </div>
  )

  if (error) return (
    <div className="blog-empty">
      <FileText size={30} />
      <h3>Could not load blog posts</h3>
      <p>{error}</p>
    </div>
  )

  if (!posts.length) return (
    <div>
      {searchControl}
      <div className="blog-empty">
        <BookOpen size={30} />
        <h3>{query.trim() ? 'No matching posts' : 'No blog posts yet'}</h3>
        <p>{query.trim() ? 'Try a different title, technology, or topic.' : adminMode ? 'Create your first blog post from the Blog editor.' : 'Check back soon for new content.'}</p>
      </div>
    </div>
  )

  return (
    <div>
      {searchControl}
      <div className="blog-grid">
        {posts.map((post) => (
          <article
            className="blog-card"
            key={post.slug}
            onClick={() => onOpenPost(post)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onOpenPost(post)}
            aria-label={`Read: ${post.title}`}
          >
            {post.cover_image_url
              ? <img className="blog-card-cover" src={post.cover_image_url} alt={post.cover_image_alt || post.title} loading="lazy" />
              : <div className="blog-card-cover-placeholder"><BookOpen size={36} /></div>
            }
            <div className="blog-card-body">
              {post.tags?.length > 0 && (
                <div className="blog-card-tags">
                  {post.tags.map((tag) => <span className="blog-card-tag" key={tag}>{tag}</span>)}
                </div>
              )}
              {adminMode && !post.published && (
                <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>Draft</span>
              )}
              <h3 className="blog-card-title">{post.title}</h3>
              <p className="blog-card-desc">{post.description}</p>
              {post.created_at && <span className="blog-card-date">{formatDate(post.created_at)}</span>}
              <button className="blog-card-read">
                Read post <ArrowRight size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="blog-pagination" aria-label="Blog pages">
          <button onClick={() => setPage(page - 1)} disabled={page === 1}>
            <ArrowLeft size={15} /> Previous
          </button>
          <span>Page <strong>{page}</strong> of {totalPages} · {total} posts</span>
          <button onClick={() => setPage(page + 1)} disabled={page === totalPages}>
            Next <ArrowRight size={15} />
          </button>
        </nav>
      )}
    </div>
  )
}
