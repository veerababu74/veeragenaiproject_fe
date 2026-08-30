import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import BlogList from './BlogList'
import BlogReader from './BlogReader'
import './BlogList.css'

export default function BlogPanel({ initialSlug = null, onNavigate }) {
  const [openSlug, setOpenSlug] = useState(initialSlug)

  if (openSlug) {
    return <BlogReader slug={openSlug} onBack={() => { setOpenSlug(null); onNavigate?.('/blog') }} />
  }

  return (
    <section className="projects-panel" style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <header className="projects-heading" style={{ marginBottom: '2.5rem' }}>
        <div>
          <p>KNOWLEDGE BASE</p>
          <h1>Blog &amp; Project Deep-Dives</h1>
          <span>Detailed write-ups explaining the architecture, logic, and technical choices behind each project.</span>
        </div>
        <div className="projects-summary">
          <BookOpen size={28} style={{ opacity: 0.5 }} />
        </div>
      </header>

      <BlogList onOpenPost={(post) => { setOpenSlug(post.slug); onNavigate?.(`/blog/${post.slug}`) }} />
    </section>
  )
}
