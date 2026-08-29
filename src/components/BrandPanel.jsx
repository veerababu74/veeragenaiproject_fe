import { CheckCircle2, Sparkles } from 'lucide-react'

export default function BrandPanel() {
  return <section className="brand-panel">
    <div className="brand-mark"><Sparkles size={20} /> Veera AI</div>
    <div className="brand-copy">
      <p className="eyebrow">GENERATIVE WORKSPACE</p>
      <h1>Ideas move faster when your tools keep up.</h1>
      <p>One account for every intelligent project you build.</p>
    </div>
    <div className="trust-line"><CheckCircle2 size={17} /> Secure, verified access</div>
  </section>
}