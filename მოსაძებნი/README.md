## Overview

This repository hosts the **Bakhmaro AI** workspace. It contains a React/Vite frontend, an Express-based backend gateway, and supporting automation scripts used to manage the AI assistant, memory synchronisation, and observability pipelines.

The project is optimised for iterative development inside Replit, but all scripts are standard `npm` commands so the stack can run locally with Node.js 18+ as well.

## Prerequisites

Before running the project make sure you have:

- Node.js `>=18 <=22` (matches the engines requirement in `package.json`).
- `npm` (ships with Node.js) for installing dependencies and running scripts.
- Optional: Docker and Prometheus/Jaeger if you want to forward telemetry externally.

### Binary assets & Git LFS

Large binaries (images, videos, archives, PDFs) are tracked with Git LFS to avoid inflating the repository. Before committing new assets ensure Git LFS is installed and tracking the configured patterns:

```bash
git lfs install
git lfs track "*.png" "*.jpg" "*.jpeg" "*.webp" "*.gif" "*.pdf" "*.zip" "*.mp4"
```

The matching `.gitattributes` entries are checked into the repository so the tracking rules persist across clones.

### Security & secrets management

- Never commit real API keys, service accounts, or other credentials to the repository.
- Populate environment variables using the `.env.example` files as templates and store real values in your secret manager (Replit Secrets, local `.env` files ignored by git, etc.).
- If you spot sensitive data checked into history, rotate the credential immediately and replace it with a placeholder before pushing.

### Port diagnostics & recovery

```bash
npm install
```

## Quick start

The workspace exposes scripts for running the frontend and backend either together or independently.

### Start the full stack

```bash
npm run dev
```

This command:

1. Runs `scripts/port-cleanup.sh` to free the core development ports (`3000`, `5000`, `5001`, `5002`).
2. Launches the backend on port `5002` and the Vite dev server on port `3000` using `concurrently`.

### Run services individually

```bash
# Backend only (Express API + proxy)
npm run dev:backend

# Frontend only (Vite dev server)
npm run dev:frontend
```

### Build and type-check

```bash
npm run lint
npm run type-check
npm run build
```

The `build` command performs a TypeScript project build followed by a production Vite bundle.

## Download all referenced backend endpoint sources

Download the generated ZIP archive that aggregates every referenced backend endpoint (including TODO stubs) via:

```
https://aispace.bakhmaro.co/api/attachments/backend-missing-endpoints.zip
```

## AI service integration

Cloud Functions under `functions/index.js` expose a thin proxy over the upstream AI control plane. The following endpoints are
available once the functions are deployed to `us-central1`:

- `GET /api/ai/health` — returns the upstream health payload verbatim and is polled by the frontend status bar.
- `GET /api/ai/models` — returns the list of enabled models along with their metadata.
- `GET /api/ai/events` — Server-Sent Events stream that relays live health/model updates. The proxy keeps the connection alive
  with periodic heartbeats and auto-retries against the upstream service when necessary.

Set the environment variables below to ensure the proxy can reach the AI service:

- `AI_SERVICE_URL` — base URL for the upstream AI service (defaults to `http://127.0.0.1:5001` during local development).
- `AI_SERVICE_TOKEN` — optional bearer shared between the backend/functions and the AI service for authentication.
- `AI_EVENTS_HEARTBEAT_MS` — optional heartbeat override for long-lived SSE connections (defaults to 25s).

On the client side, `src/hooks/useAIServiceState.ts` handles polling and SSE subscriptions through a shared
`EventSourceManager` (`src/lib/sse/eventSourceManager.ts`). The Dev Console status bar consumes this hook to display live AI
health, selected model, and stream connectivity badges.

## Logging & observability

The backend ships with an OpenTelemetry-powered middleware located at `backend/middleware/telemetry_middleware.js`. A structured logger is attached to each request and now supports both JSON and human-friendly output formats.

- Set `LOG_FORMAT=json` to emit strict JSON (useful for log shippers).
- The default `pretty` mode prints entries as single-line messages while still masking sensitive fields such as tokens, secrets, and session identifiers.
- Sensitive keys are automatically masked, so application code no longer needs to emit manual `[redacted]` placeholders.

Prometheus metrics are exposed on port `9092` by default, and traces are exported to Jaeger using the endpoint from `JAEGER_ENDPOINT`.

## Port diagnostics & recovery

Use the dedicated helper to inspect local development ports and gracefully stop conflicting processes before starting the dev stack:

```bash
npm run diagnose:ports
```

The script checks ports `3000`, `5000`, `5001`, and `5002` using Linux `/proc` socket metadata, reports conflicting PIDs/commands, and attempts a graceful shutdown (SIGTERM/SIGKILL) before revalidating that the ports are free.

## Troubleshooting Git workflows

If `git pull` stops with the message `You have divergent branches and need to specify how to reconcile them`, follow [docs/git-pull-divergent-branches.md](docs/git-pull-divergent-branches.md) for resolution steps tailored to this repository.
