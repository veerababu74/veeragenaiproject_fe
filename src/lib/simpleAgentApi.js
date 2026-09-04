import { createAgentsApi } from './agentsApi'

// SimpleAgent is mounted at /simpleagent in the shared agents backend.
const client = createAgentsApi('simpleagent')

export const simpleAgentApi = client.request
export const simpleAgentStream = client.stream
