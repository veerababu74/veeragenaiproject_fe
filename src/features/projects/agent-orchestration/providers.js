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
