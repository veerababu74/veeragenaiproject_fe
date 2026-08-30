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
4. In the backend deployment, keep `FRONTEND_URL=https://veeragenaiproject-fe.vercel.app` and set `FRONTEND_URLS=https://veeragenai.netlify.app`.
5. Add both frontend domains as Google OAuth authorized JavaScript origins. Keep the single backend callback `https://veeragenaiproject-be.vercel.app/workspace-agent/google/callback` as the authorized redirect URI.
6. Confirm `https://veeragenaiproject-be.vercel.app/landing` returns HTTP 200 before testing the site.

The existing `vercel.json` remains available for Vercel deployments. Netlify reads `netlify.toml` instead.

Both frontends use the same backend, users, roles, blogs, and MongoDB data. Login cookies are first-party and domain-scoped, so signing in on Vercel does not automatically sign the same browser into Netlify; users sign in once on each frontend.
