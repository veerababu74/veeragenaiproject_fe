import { ArrowLeft, ArrowRight } from 'lucide-react'
import './Pager.css'

/* One pager, for the lists that grow without limit.
 *
 * The workspace and the public portfolio each grew their own copy of this
 * markup before the admin screens needed one too. Rather than write a third,
 * the new ones share this — and it renders nothing at all when there is only
 * one page, so a caller never has to guard it.
 */

export default function Pager({ page, pageCount, total, noun = 'items', onChange }) {
  if (pageCount <= 1) return null
  return (
    <nav className="pager" aria-label={`${noun} pages`}>
      <button onClick={() => onChange(page - 1)} disabled={page === 1}>
        <ArrowLeft size={15} /> Previous
      </button>
      <span>Page <strong>{page}</strong> of {pageCount} · {total} {noun}</span>
      <button onClick={() => onChange(page + 1)} disabled={page === pageCount}>
        Next <ArrowRight size={15} />
      </button>
    </nav>
  )
}
