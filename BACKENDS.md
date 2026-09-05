# Backends map

Which backend serves what, where it lives, and how the frontend reaches it.

This frontend talks to **four separate backends**. Each is its own repository and
its own deployment. Nothing here is shared at runtime except the platform's
`JWT_SECRET` — every backend verifies the same auth cookie, so signing in once
signs you in everywhere.

---

## The map

```
                        veeragenai_projects_fe  (this repo, Vercel)
                                     │
        ┌────────────────┬───────────┴────────────┬──────────────────┐
        │                │                        │                  │
   /api            /orchestrator-api        /agents-api          /labs-api
        │                │                        │                  │
        ▼                ▼                        ▼                  ▼
veeragenai_      agent_orchestration_    veeragenaiproject_   veeragenaiproject_
projects_be          backend                agents_be              be2
  (Vercel)        (FastAPI Cloud)         (FastAPI Cloud)        (Vercel)
        │                │                        │                  │
  auth            Agent Orchestrator      /simpleagent        /chunking
  blogs                                   /insidellm          /embedlab
  admin                                                       /decodelab
  catalogue                                                   /guardlab
  basic chat
  basic RAG
  advanced RAG
  graph RAG
```

---

## Reference table

| Repository | Deployed URL | Path prefix | Local port | Override variable |
|---|---|---|---|---|
| `veeragenai_projects_be` | `https://veeragenaiproject-be.vercel.app` | `/api` | 8000 | `VITE_CORE_API_URL` |
| `agent_orchestration_backend` | `https://veeragenaiproject-agent-orchestation.fastapicloud.dev` | `/orchestrator-api` | 8003 | `VITE_ORCHESTRATOR_API_URL` |
| `veeragenaiproject_agents_be` | `https://veeragenaiproject-agents-be.fastapicloud.dev` | `/agents-api` | 8004 | `VITE_AGENTS_API_URL` |
| `veeragenaiproject_be2` | `https://veeragenaiproject-be2.vercel.app` | `/labs-api` | 8001 | `VITE_LABS_API_URL` |

**Naming convention:** one path prefix, one variable and one local port per
*backend* — never per feature. The prefix is `/<backend>-api`, the variable is
`VITE_<BACKEND>_API_URL`. Adding a project to an existing backend adds none of
them.

The prefix is the single identifier: it names the rewrite in `vercel.json`, the
proxy entry in `vite.config.js`, and the client's default in `src/lib/`. Those
three lists should always agree.

---

## 1. `veeragenai_projects_be` — the core platform

`https://veeragenaiproject-be.vercel.app` · rewrite `/api` · client `src/lib/api.js`

The only backend that owns durable data. Everything else borrows its auth.

| Service | Notes |
|---|---|
| Authentication | Issues the HS256 cookie every other backend verifies |
| Blog | Posts and the project guides |
| Admin | User management, landing page and project catalogue |
| Project catalogue | `/projects/catalog` — what the workspace renders |
| Basic Chat | Multi-provider chat |
| Basic RAG | Document-grounded retrieval |
| Advanced RAG | Query rewriting, multi-query, traces |
| Graph RAG | Neo4j knowledge graph |

**Startup migrations are skipped when `VERCEL` is set.** A new catalogue entry or
blog guide therefore does *not* reach production on deploy alone — the `ensure_*`
functions must be run manually against the production database, or the card and
its write-up silently fail to appear.

## 2. `agent_orchestration_backend` — Agent Orchestrator

`https://veeragenaiproject-agent-orchestation.fastapicloud.dev` · rewrite
`/orchestrator-api` · client `src/lib/agentApi.js`

One project, its own deployment, predating the multi-project repos. Multi-agent
graphs with delegation, tools and run traces. Routes are served at the root
(`/agents`, `/execute`, `/tools`, …).

## 3. `veeragenaiproject_agents_be` — agent projects

`https://veeragenaiproject-agents-be.fastapicloud.dev` · rewrite `/agents-api` ·
client `src/lib/agentsApi.js`

One app, many projects, each mounted at `/<slug>`.

| Slug | Project | Frontend |
|---|---|---|
| `simpleagent` | SimpleAgent — one agent, ten tools, live tool-call trace | `src/features/projects/simple-agent/` |
| `insidellm` | Inside an LLM — a real GPT-2 forward pass, component by component | `src/features/projects/inside-llm/` |

`GET /health` lists what is mounted. The client is a factory:
`createAgentsApi('simpleagent')`.

## 4. `veeragenaiproject_be2` — labs

`https://veeragenaiproject-be2.vercel.app` · rewrite `/labs-api` · client
`src/lib/labsApi.js`

Same shape: one app, each lab at `/<slug>`.

| Slug | Lab | Frontend |
|---|---|---|
| `/chunking` | Chunking Lab — eight strategies compared | `src/features/projects/ChunkingLab.jsx` |
| `embedlab` | Embedding & Retrieval Lab | `src/features/projects/embed-lab/` |
| `decodelab` | Decoding & Sampling Lab | `src/features/projects/decode-lab/` |
| `guardlab` | Guardrails & Injection Lab | `src/features/projects/guard-lab/` |

**Chunking Lab is the one exception to the slug rule.** It predates the split and
its router carries its own `/chunking` prefix, so it is mounted at the root
(`mount_prefix=""`) rather than at `/chunkinglab`. Moving it would have broken
the deployed frontend for no benefit. It shares the `/labs-api` rewrite and the
`VITE_LABS_API_URL` variable with every other lab, but keeps its own client
(`src/lib/chunkingApi.js`) because of that prefix and its upload handling.

---

## How a request is routed

**Every client uses the same relative path in both modes.** Production rewrites
it via `vercel.json`; development forwards it via the proxy in `vite.config.js`.
The two config files list the same four prefixes and exist to be read side by
side.

```
production   /agents-api/simpleagent/agent
           → https://veeragenaiproject-agents-be.fastapicloud.dev/simpleagent/agent

development  /agents-api/simpleagent/agent
           → http://localhost:8004/simpleagent/agent
```

Requests are therefore same-origin in both modes, which matters for one specific
reason: the auth cookie is sent without any CORS or `SameSite` negotiation, and
a path bug cannot hide in one mode and appear in the other.

### The `VITE_*_API_URL` variables are overrides, not configuration

Nothing needs to be set for either mode to work — each client falls back to its
relative path. Set one only to point a client at a *different* host, which is
useful in development when you would rather not run all four backends locally.

Doing so makes that request cross-origin, so it then depends on the target
backend's CORS allowing `http://localhost:5173` with credentials.

**Do not set them for production.** A value there bypasses the rewrite, makes the
request cross-origin, and breaks the auth cookie. Production URLs belong in
`vercel.json`, which is also the only place a deployment URL needs changing.

---

## Legacy rewrites

`vercel.json` keeps two aliases pointing at the same hosts as their replacements:

| Legacy | Replaced by | Why it stays |
|---|---|---|
| `/agent-api` | `/orchestrator-api` | A browser holding an already-loaded bundle still calls the old path until it reloads |
| `/chunking-api` | `/labs-api` | Same |

They can be deleted once you are confident no cached bundle is still calling
them. Nothing in the current source uses either.

---

## Adding a project

**To an existing backend** — nothing in this file changes. Add the router under
its slug in the backend, add the feature directory here, register it in
`PROJECT_COMPONENTS` (`ProjectsPanel.jsx`) and `PROJECT_ROUTES` (`App.jsx`), and
reach it with the existing factory: `createLabsApi('<slug>')` or
`createAgentsApi('<slug>')`.

**A new backend** — add one row to the table above, one variable, one rewrite,
and one client file. Then update this document, because the next person will
read it before they read the code.

---

## Health checks

```bash
curl https://veeragenaiproject-be.vercel.app/health
curl https://veeragenaiproject-agent-orchestation.fastapicloud.dev/health
curl https://veeragenaiproject-agents-be.fastapicloud.dev/health   # lists projects
curl https://veeragenaiproject-be2.vercel.app/health               # lists labs
```

The two multi-project backends list what they have mounted, which is the fastest
way to tell whether a deployment actually shipped the project you expected.

> Use `curl`, not a Python HTTP client: FastAPI Cloud returns 403 to some default
> user-agents, which looks like an outage and is not one.

---

## Running everything locally

```bash
# core            veeragenai_projects_be
python -m uvicorn main:app --port 8000

# labs            veeragenaiproject_be2
python -m uvicorn main:app --port 8001

# orchestrator    agent_orchestration_backend
python -m uvicorn main:app --port 8003

# agent projects  veeragenaiproject_agents_be
python -m uvicorn main:app --port 8004

# frontend
npm run dev        # http://localhost:5173
```

Every backend needs the same `JWT_SECRET` as the core one, or every
authenticated call returns 401.

You do not need all four running. Whichever you skip simply returns a connection
error for its own projects; the rest of the workspace works. To use a deployed
backend instead of a local one, uncomment its line in `.env.development`.
