// Live AI Interview is mounted at /interviewagent in the shared agents backend.
import { createAgentsApi } from '../../../lib/agentsApi'

export const interviewApi = createAgentsApi('interviewagent').request

// Planning twenty questions is three model calls, grading is one, and the final
// report is one over the whole transcript. All three are far past the shared
// client's 30-second default, so the slow calls pass their own signal.
export const patientSignal = () => AbortSignal.timeout(300000)

// The shared client parses JSON, and audio is not JSON — so the voice endpoint
// gets its own fetch rather than a `responseType` option nothing else would use.
const ROOT = `${(import.meta.env.VITE_AGENTS_API_URL || '/agents-api').replace(/\/+$/, '')}/interviewagent`

export async function fetchSpokenAudio(text, signal) {
  const response = await fetch(`${ROOT}/speech/speak`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: signal ?? AbortSignal.timeout(90000),
  })
  if (!response.ok) {
    let detail = ''
    try { detail = (await response.json())?.detail } catch { /* audio error bodies are not always JSON */ }
    throw new Error(detail || `The voice provider returned ${response.status}.`)
  }
  return response.blob()
}

export async function uploadRecording(blob, filename) {
  const body = new FormData()
  body.append('file', blob, filename)
  body.append('language', 'en')
  return interviewApi('/speech/transcribe', { method: 'POST', body })
}
