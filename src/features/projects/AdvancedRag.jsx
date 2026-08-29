import BasicRag from './BasicRag'

export default function AdvancedRag({ onBack }) {
  return <BasicRag onBack={onBack} endpoint="/advanced-rag" title="Advanced RAG" advanced />
}
