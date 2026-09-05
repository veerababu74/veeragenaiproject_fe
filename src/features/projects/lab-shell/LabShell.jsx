import { ArrowLeft } from 'lucide-react'
import './labs.css'

/* Chrome shared by the labs in veeragenaiproject_be2.
 *
 * They differ in what they show and not in how they are framed, so the header,
 * tab strip and body scroll live here once. */
export default function LabShell({
  onBack, eyebrow, title, icon: Icon, meta = [], tabs = [], view, onView,
  banner, footer, children,
}) {
  return (
    <section className="lab-app">
      <header className="lab-header">
        <button className="lab-back" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <div className="lab-brand">
          <span className="lab-brand-icon">{Icon && <Icon size={17} />}</span>
          <div>
            <span>{eyebrow}</span>
            <h1>{title}</h1>
          </div>
        </div>
        <div className="lab-header-meta">
          {meta.map((item, index) => (
            <span className={`lab-pill ${item.ghost ? 'ghost' : ''}`} key={index}>{item.label}</span>
          ))}
        </div>
      </header>

      {tabs.length > 0 && (
        <nav className="lab-tabs">
          {tabs.map((tab) => (
            <button key={tab.id} className={view === tab.id ? 'active' : ''}
                    onClick={() => onView(tab.id)}>
              {tab.icon && <tab.icon size={14} />} {tab.label}
            </button>
          ))}
        </nav>
      )}

      {banner}

      <div className="lab-body">{children}</div>

      {footer && <footer className="lab-footer">{footer}</footer>}
    </section>
  )
}
