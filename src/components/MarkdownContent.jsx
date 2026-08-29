import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './MarkdownContent.css'

export default function MarkdownContent({ children }) {
  return <div className="markdown-content"><Markdown
    remarkPlugins={[remarkGfm]}
    components={{
      a: ({ children: label, ...props }) => <a {...props} target="_blank" rel="noreferrer">{label}</a>,
      table: ({ children: table }) => <div className="markdown-table"><table>{table}</table></div>,
    }}
  >{children}</Markdown></div>
}