import { createAgentsApi } from './agentsApi'

// Inside an LLM is mounted at /insidellm in the shared agents backend.
export const insideLlmApi = createAgentsApi('insidellm').request
