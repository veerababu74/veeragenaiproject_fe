# Veera Generative AI Frontend

React and Vite frontend for the Veera AI project workspace.

```powershell
npm install
npm run dev
```

Copy `.env.example` to `.env`, set `VITE_API_URL` to the FastAPI backend, and configure the Google client ID.

## Deploy to Netlify

The included `netlify.toml` builds the Vite app, proxies `/api/*` to the FastAPI backend, and serves `index.html` for client-side routes.

1. Import this repository in Netlify with the repository root as the base directory.
2. Set `VITE_GOOGLE_CLIENT_ID`, `VITE_DEMO_EMAIL`, and `VITE_DEMO_PASSWORD` in **Site configuration > Environment variables**.
3. Deploy with build command `npm run build` and publish directory `dist` (also declared in `netlify.toml`).
4. In the backend deployment, set `FRONTEND_URL=https://veeragenai.netlify.app`.
5. For Google Workspace OAuth, set `GOOGLE_WORKSPACE_REDIRECT_URI=https://veeragenai.netlify.app/api/workspace-agent/google/callback` and add that exact URI to the Google OAuth client's authorized redirect URIs.
6. Confirm `https://veeragenaiproject-be.vercel.app/landing` returns HTTP 200 before testing the site.

The existing `vercel.json` remains available for Vercel deployments. Netlify reads `netlify.toml` instead.
