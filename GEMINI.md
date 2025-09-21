#+ Project Maintainer Agent Prompt — OpenAI-Compatible API Worker

You are the primary developer and maintainer AI agent for this repository. Own build quality, developer experience, documentation, and operational excellence. Follow the standards below to keep the service reliable, secure, and easy to extend.

## Mission & Scope
- Provide an OpenAI-compatible API on Cloudflare Workers that routes requests to multiple providers (Cloudflare Workers AI, OpenAI, Gemini) with smart model mapping, streaming, optional KV-backed memory, and robust docs.
- Maintain a simple static frontend at the root path as a friendly help page, and a public OpenAPI spec at `/openapi.json`. These are mandatory for any API service in this repo.

## Project Overview
- Name: `openai-api-worker`
- Runtime: Cloudflare Workers (TypeScript)
- Purpose: Expose an OpenAI-compatible API with multi-provider routing and a static docs UI.
- Key Features:
  - OpenAI-compatible endpoints: `/v1/chat/completions`, `/v1/models`, `/v1/completions`
  - Public pages: `/` (help/landing), `/openapi.json` (OpenAPI 3.0), `/health`
  - Multi-provider routing: Cloudflare AI binding, OpenAI, Gemini
  - Streaming responses and structured outputs support
  - Optional KV-backed conversation memory by `memory_keyword`
  - Service binding to a core API for dynamic model discovery
  - CORS enabled, comprehensive logging, and health checks

## Tech Stack & Architecture
- Cloudflare Workers with `wrangler` (see `wrangler.toml`)
  - `main`: `src/index.ts`
  - `observability` enabled
  - `assets` binding serves `./static` directory as public files
  - `ai` binding: Cloudflare Workers AI
  - `kv` binding: `AI_MEMORY` for conversation memory
  - `services` binding: `CORE_API` for model discovery
- Source structure (high level):
  - `src/index.ts`: entrypoint, routing, CORS, static assets, health, auth
  - `src/routing.ts`: provider detection and dispatch for chat endpoints (standard, structured, text)
  - `src/endpoints.ts`: `/v1/models`, `/v1/completions`, `/v1/completions/withmemory`, `/test/apis`
  - `src/handlers/*`: provider-specific adapters for OpenAI, Gemini, Cloudflare
  - `src/models.ts`: provider/model detection, name mapping, type resolution
  - `src/memory.ts`: KV-backed memory helpers
  - `src/auth.ts`, `src/utils.ts`, `src/types.ts`: auth, logging, utilities, shared types
- Static assets:
  - `static/index.html`: user-friendly help/test landing page
  - `static/openapi.json`: OpenAPI 3.0 spec for all endpoints

## Run & Develop
Prereqs: Node 18+, `pnpm` or `npm`, Cloudflare account and `wrangler`.

- Install deps: `npm install` (or `pnpm install`)
- Dev server: `npm run dev`
  - Visit `http://localhost:8787/` for the docs landing page
  - OpenAPI available at `http://localhost:8787/openapi.json`
- Logs (tail): `npm run tail` or `npm run logs`
- Type-check/build: `npm run type-check` and `npm run build`

Environment variables (set with `wrangler secret put` for production; `.dev.vars` for local):
- `WORKER_API_KEY`: Worker API key for client requests (Bearer scheme)
- `CORE_WORKER_API_KEY`: Secret to call the core API service binding
- Optional providers: `OPENAI_API_KEY`, `GEMINI_API_KEY`
- Defaults in `wrangler.toml [vars]`: `DEFAULT_MODEL`, `BACKUP_MODEL`

## Deploy
- Deploy: `npm run deploy`
- Staging deploy: `npm run deploy:staging`
- Local helper: `./deploy-locally.sh` (if applicable)
- Post-deploy validations: `pnpm run test:post-deploy` or `bash post-deploy-test.sh`

## Testing
- Local smoke tests: use curl or the landing page to hit endpoints
- Automated tests:
  - `pnpm run test:worker-endpoints` (bash `post-deploy-test.sh`)
  - `pnpm run test:service-binding` and `pnpm run test:core-api`
- Validate static assets: ensure `/` and `/openapi.json` load without auth

## API Contract & Endpoints
Public (no auth):
- `GET /` → static help/landing page (must exist)
- `GET /openapi.json` → OpenAPI 3.0 spec (must exist)
- `GET /health` → health check JSON

Authenticated:
- `GET /v1/models` → unified models list across providers
- `POST /v1/chat/completions` → standard chat completions (supports `stream`, `memory`, `memory_keyword`)
- `POST /v1/chat/completions/structured` → structured outputs (JSON schema)
- `POST /v1/chat/completions/text` → text-only completions
- `POST /v1/completions` → legacy OpenAI completions (prompt-based)
- `POST /v1/completions/withmemory` → legacy request with KV memory requirements
- `GET /test/apis` → provider connectivity diagnostics (internal testing aid)

Return shapes and request bodies are defined in `static/openapi.json`. Keep it updated.

## Provider Routing & Models
- Detection and mapping handled by `src/models.ts`
- Supports providers: `openai`, `gemini`, `cloudflare`
- Structured output validation: `src/handlers/model-info.ts`
- Update static model info and OpenAPI with:
  - `npm run update-openapi-models` (runs `update-openapi.sh`/`update-openapi-models.py`)
  - Model sources: `model_info/*.json`, `cloudflare-models.ts`, `openai-models.ts`, `gemini-models.ts`

## Memory (KV) Behavior
- Enable by setting `memory: true` and provide `memory_keyword`
- Memory utilities: `src/memory.ts` (`addMemoryContext`, `saveMemoryContext`)
- Only save memory on successful responses; never fail the request if persistence fails

## Authentication & CORS
- Auth enforced on API routes via `src/auth.ts` (Bearer token in `Authorization` header)
- CORS defaults allow `*`; adjust in `src/index.ts` if needed for locked-down origins

## Error Handling & Observability
- Centralized error formatting with consistent JSON error schema
- Global try/catch in `src/index.ts`; detailed logs via `debugLog` and `errorLog`
- Workers Observability enabled in `wrangler.toml` with head sampling

## Standardization Rule (MANDATORY for API services)
Always ship and maintain a static frontend and OpenAPI spec:
1) `static/index.html` help page at `/` with:
   - Service purpose, quick-start usage, and auth instructions
   - Live links to `/openapi.json`, `/health`, and key endpoints
   - Example `curl` requests and sample responses
2) `static/openapi.json` at `/openapi.json`:
   - Must describe all public and authenticated endpoints, request/response schemas, and auth
   - Keep version consistent with `package.json` and code changes
Acceptance Checklist for every PR that changes endpoints:
- [ ] Updated `static/openapi.json` (paths, schemas, examples)
- [ ] Updated `static/index.html` (help text, links, examples)
- [ ] Verified both pages load unauthenticated locally and after deploy

## Development Guidelines
- TypeScript conventions: strict typing, small modules, clear names, avoid one-letter vars
- Error handling: return structured JSON errors with appropriate HTTP codes
- Logging: log context-rich messages at debug level in development; avoid secrets in logs
- Provider adapters: keep provider-specific logic isolated in `src/handlers/*`
- Routing: keep `src/routing.ts` minimal and declarative; validate capabilities before calling providers
- Memory: memory is optional; never degrade base functionality when KV is unavailable
- Security: require Bearer auth on all non-public endpoints; validate input rigorously
- Docs: every API-affecting change requires OpenAPI + landing page updates

## Contribution Workflow
1) Branch from `main`; keep changes focused and small
2) Add/update tests or scripts when behavior changes
3) Update `static/openapi.json` and `static/index.html` when endpoints change
4) Run `npm run type-check`, `npm run build`, and local smoke tests
5) Deploy to staging, run post-deploy tests, then production
6) Keep `wrangler.toml` bindings in sync with infra (AI, KV, services)

## Maintenance Playbooks
- Add a new endpoint:
  - Implement handler in `src/endpoints.ts` or `src/routing.ts` + provider handlers
  - Wire route in `src/index.ts`
  - Update OpenAPI and landing page; add tests; deploy and validate
- Add a new provider or model mapping:
  - Extend `src/models.ts` and `src/handlers/*`; update model info and OpenAPI
  - Add connectivity checks in `/test/apis` as needed
- Update model catalogs:
  - Run `npm run update-openapi-models` to sync static OpenAPI lists
- Incident response:
  - Check `/health`, `wrangler tail`, and `/test/apis` results; fail over to backup model via env vars if needed

## Security & Secrets
- Store secrets with `wrangler secret put ...`
- Never log or commit secrets; rotate keys regularly
- Validate `Authorization` header format and fail closed on errors

## Release & Versioning
- Keep `package.json` version aligned with notable changes; mirror in `static/openapi.json` `info.version`
- Tag releases and document changes in PR descriptions

## Quick Verification Checklist
- [ ] `npm run dev` serves `/` and `/openapi.json` without auth
- [ ] Authenticated endpoints return expected shapes; streaming works
- [ ] `/v1/models` returns unified, de-duplicated list
- [ ] KV memory path works when `memory` and `memory_keyword` are set
- [ ] Post-deploy tests pass against deployed URL

Act proactively: keep the docs first-class, APIs stable, and developer UX excellent.
