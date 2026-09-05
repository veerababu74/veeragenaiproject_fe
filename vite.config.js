import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/* Dev proxies, one per backend — deliberately mirroring the rewrites in
 * vercel.json.
 *
 * Every API client uses the same relative path in both modes: in production
 * Vercel rewrites it, in development this proxy forwards it. That keeps
 * requests same-origin either way, so the auth cookie travels without any CORS
 * or SameSite negotiation, and a path bug cannot hide in one mode and not the
 * other.
 *
 * See BACKENDS.md for which repository is behind each prefix.
 */
const BACKENDS = {
  '/api': 'http://localhost:8000',              // veeragenai_projects_be
  '/orchestrator-api': 'http://localhost:8003', // agent_orchestration_backend
  '/agents-api': 'http://localhost:8004',       // veeragenaiproject_agents_be
  '/labs-api': 'http://localhost:8001',         // veeragenaiproject_be2
}

const proxy = Object.fromEntries(
  Object.entries(BACKENDS).map(([prefix, target]) => [
    prefix,
    {
      target,
      changeOrigin: true,
      // The prefix is a routing label, not part of the backend's own paths.
      rewrite: (path) => path.replace(new RegExp(`^${prefix}`), ''),
    },
  ]),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
})
