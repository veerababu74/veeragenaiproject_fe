import { agentApi } from '../../../lib/agentApi'

export const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o3-mini'] },
  { id: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'] },
  { id: 'google_genai', name: 'Google GenAI', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'openrouter', name: 'OpenRouter', models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4', 'meta-llama/llama-3.3-70b-instruct'] },
  { id: 'mistral', name: 'Mistral', models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'] },
]

export const PROVIDER_DOT = {
  openai: 'dot-emerald', groq: 'dot-orange', anthropic: 'dot-amber',
  google_genai: 'dot-blue', openrouter: 'dot-purple', mistral: 'dot-rose',
}

/** How an agent uses the agents connected to it. In every mode except
 *  supervisor, the agent you chat with still writes the final answer - the mode
 *  only decides how its connected agents contribute first, so the direction you
 *  drew the arrow in never changes the outcome. */
export const ORCHESTRATION_MODES = [
  { id: 'supervisor', name: 'Supervisor (model decides)',
    hint: 'The model is offered each connected agent as a tool and picks which to ask, if any. Flexible, but not repeatable.' },
  { id: 'sequential', name: 'Sequential',
    hint: 'Every connected agent runs in turn, each seeing what the previous ones said, then this agent answers. Deterministic.' },
  { id: 'parallel', name: 'Parallel',
    hint: 'All connected agents are asked at the same time, then this agent merges their answers. Fastest for independent questions.' },
  { id: 'conditional', name: 'Conditional',
    hint: 'Only the connected agents whose condition matches the question run. Set a condition by clicking a connection.' },
]
export const modeName = (id) => ORCHESTRATION_MODES.find((m) => m.id === id)?.name || 'Supervisor (model decides)'
export const modeHint = (id) => ORCHESTRATION_MODES.find((m) => m.id === id)?.hint || ''

export const providerName = (id) => PROVIDERS.find((p) => p.id === id)?.name || id

/** Suggestions only. Model names change constantly, so the model field is free
 *  text and any name the provider accepts can be typed in - this list just
 *  saves typing for the common ones. */
export const modelsFor = (id) => PROVIDERS.find((p) => p.id === id)?.models || []

/** Provider ids the user has already saved a key for. Keys are stored per
 *  provider, so every agent on that provider is covered by one key. */
export async function loadKeyedProviders() {
  try {
    const configs = await agentApi('/settings/llm-configs')
    return configs.map((config) => config.provider)
  } catch {
    return []
  }
}
