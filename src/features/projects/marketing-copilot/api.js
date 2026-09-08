// Marketing Copilot is mounted at /marketingcopilot in the shared agents
// backend, alongside SimpleAgent and Inside an LLM.
import { createAgentsApi } from '../../../lib/agentsApi'

export const marketingApi = createAgentsApi('marketingcopilot').request
