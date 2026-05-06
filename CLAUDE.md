# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

`stlalpha/Palmr` is the canonical home of Palmr. It started as a fork of `kyantech/Palmr` (which the original author archived) but has diverged enough to be its own project. Sole maintainer is Jim McBride. Work happens on `main`. Quality cleanup, refactors, and removing legacy cruft are all on the table — don't preserve existing patterns just because they're there.

The original author Daniel Luiz Alves is credited per Apache-2.0; don't strip attribution. The `upstream` git remote still exists locally for archaeological reference but isn't a source of truth.

## Repository Layout

This is a multi-app monorepo, but **not** a pnpm workspace. Each app has its own `package.json` and `pnpm-lock.yaml` and is installed/built independently:

```
apps/
  server/   Fastify + Prisma + SQLite API
  web/      Next.js 15 (App Router) frontend
  docs/     Next.js + Fumadocs MDX site
infra/      Build, version, MinIO, supervisord, seed scripts
Dockerfile  Multi-stage build that bundles all three apps + MinIO
```

The root `package.json` only manages Husky. Run `pnpm install` inside each app, not at the root.

## Common Commands

### Per-app (run inside `apps/server`, `apps/web`, or `apps/docs`)

```bash
pnpm install           # Install deps for that app
pnpm dev               # Dev server (server: 3333, web: 3000, docs: 3001)
pnpm build             # Production build
pnpm lint              # ESLint
pnpm lint:fix          # ESLint --fix
pnpm format            # Prettier write
pnpm format:check      # Prettier check
pnpm type-check        # tsc --noEmit
pnpm validate          # lint + type-check (this is what the pre-push hook runs)
```

The Husky `pre-push` hook (`.husky/pre-push`) runs `pnpm validate` in web, then docs, then server, sequentially. `validate` = lint + type-check.

`apps/server` has a vitest suite (`pnpm test`, `pnpm test:watch`). Tests use Fastify's `app.inject()` against a temp SQLite DB seeded by `prisma db push` in `test/setup.ts`. The DB is reset between tests via `test/helpers/db.ts`. `test/helpers/factories.ts` has `createUser`/`createFile`/`createShare`/`authHeader` helpers; `test/helpers/test-app.ts` builds a Fastify instance for testing. Type-checking uses `tsconfig.test.json` (extends the main config, adds `test/**`, sets `rootDir: "."`). Test is **not** part of `validate` yet — must be run separately.

`apps/web` and `apps/docs` have no tests.

### Server-only

```bash
pnpm db:seed                          # Seed the SQLite DB (uses prisma/seed.js)
pnpm cleanup:orphan-files             # Dry-run orphan file cleanup
pnpm cleanup:orphan-files:confirm     # Actually delete orphan files
npx prisma db push --schema=./prisma/schema.prisma --skip-generate  # Apply schema
npx prisma generate                   # Regenerate Prisma client
```

The server expects `DATABASE_URL` (defaults to `file:/app/server/prisma/palmr.db`, the container path). For local dev outside the container, set it to a local path before running migrations or `dev`.

### Web translations (Python)

```bash
pnpm translations:check    # Verify translation completeness
pnpm translations:sync     # Sync missing keys across locales
pnpm translations:prune    # Remove orphaned keys
```

Reference locale is `apps/web/messages/en-US.json`. Untranslated values are marked with a `[TO_TRANSLATE]` prefix.

### Docker / release

```bash
make build IMAGE_NAME=stlalpha/palmr   # Multi-platform release build + push to that registry
make build-local                       # Local single-platform build, no push (verification/dev)
make update-version                    # Bump version in all package.json
make start | stop | logs | clean | shell   # docker-compose lifecycle
```

`infra/build-docker.sh` accepts these env vars:
- `IMAGE_NAME` — required for push builds (no default, fails fast)
- `LOCAL=1` — single-platform build to local Docker, no `--push`
- `NO_CACHE=0` — allow Docker layer cache (defaults to `--no-cache` for releases)

## Architecture

### Server (`apps/server`)

Fastify 5 with the Zod type provider (`fastify-type-provider-zod`). All route schemas — body, querystring, response — are Zod and double as the OpenAPI source for Swagger (`/swagger`) and Scalar (`/docs`).

Module convention (every domain folder under `src/modules/` follows this):

```
modules/<domain>/
  routes.ts       Fastify route registration + Zod schemas
  controller.ts   Thin HTTP layer, delegates to service
  service.ts      Business logic
  dto.ts          Zod schemas / inferred types
  repository.ts   (some modules) Prisma access behind an interface
```

All routes are wired in `src/server.ts` via `app.register(...)`. JWT auth lives on Fastify's `request.jwtVerify()` and is applied per-route via `preValidation` (see `modules/file/routes.ts`). The JWT secret is read from the `appConfig` table on boot (`src/app.ts`); on first run, `prisma/seed.js` generates one.

Storage is **always S3-compatible**, with two modes selected by `ENABLE_S3`:

- `ENABLE_S3=false` (default) — internal storage. The Docker image bundles MinIO; the server reads `/app/server/.minio-credentials` written by `infra/start-minio.sh`. `STORAGE_URL` env var is **required** in this mode for presigned URLs to be reachable from outside the container.
- `ENABLE_S3=true` — external S3 (AWS, MinIO, etc.) using `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME`, etc.

`src/config/storage.config.ts` exports two clients: `s3Client` (internal endpoint, used by the server) and `createPublicS3Client()` (uses `STORAGE_URL` for presigned URLs returned to clients). Don't conflate them.

Env parsing is in `src/env.ts` (Zod). Add new env vars there.

The server's "first run" lifecycle (see `infra/server-start.sh`) copies `infra/configs.json` and `infra/providers.json` into `/app/server/prisma/`, runs `prisma db push`, then `seed.js`. On every subsequent start it re-runs `db push` and uses `infra/check-missing.js` to detect new seed-required rows.

### Web (`apps/web`)

Next.js 15 with the App Router, React 19, Tailwind v4, Shadcn/ui (Radix primitives), `next-intl` for i18n, Zustand for client state, `react-hook-form` + `zod` for forms.

The browser **does not call the API directly**. All HTTP goes through Next route handlers in `src/app/api/(proxy)/**/route.ts`, which forward to the API server at `process.env.API_BASE_URL` (defaults to `http://localhost:3333`, set to `http://127.0.0.1:3333` in the container). These handlers also forward cookies and `Set-Cookie`, which is how JWT auth survives the proxy hop. When adding an API endpoint, you typically need both a server route and a matching `(proxy)` route.

Typed client wrappers for every endpoint live in `src/http/endpoints/<domain>/index.ts` and are re-exported from `src/http/endpoints/index.ts`. They use the shared `apiInstance` from `src/config/api.ts` (axios) and call `/api/...`, which hits the Next proxy.

App-level state is in three contexts (`src/contexts/`): `auth-context`, `app-info-context`, `share-context`. The root `app/layout.tsx` wraps everything in `AuthProvider` → `RedirectHandler` → `ShareProvider`. `RedirectHandler` enforces `publicPaths` / `unauthenticatedOnlyPaths` / home-redirect rules; update those lists when adding new pages.

Route groups: `(home)` is the public landing, `(shares)` is the public share viewer, everything else (`dashboard`, `files`, `settings`, `users-management`, `profile`, `customization`) requires auth.

### Docs (`apps/docs`)

Next.js + Fumadocs. Content is MDX under `content/docs/`. `postinstall` runs `fumadocs-mdx` to generate the source. Dev port is 3001.

### Container runtime

`Dockerfile` builds three stages (server, web, base with MinIO + mc) and combines them. `infra/supervisord.conf` runs four programs in order: `minio` (port 9379), `minio-setup` (creates bucket, writes `.minio-credentials`), `server` (port 3333, waits for credentials file), `web` (port 5487, waits for server `/health`). The web app talks to the server via `127.0.0.1:3333` inside the container.

Exposed ports: `3333` (API), `5487` (web), `9379` (MinIO S3), `9378` (MinIO console).

`PALMR_UID`/`PALMR_GID` env vars let you remap container ownership without rebuilding; `/app/start.sh` uses a marker file (`/app/server/.palmr-uidgid`) to skip recursive chown when ownership hasn't changed.

## Conventions

- **Branch**: work on `main`. There is no `next` or other long-running branch.
- **Commit format**: Conventional Commits (`feat(web): ...`, `fix(api): ...`, `docs: ...`, `chore: ...`).
- **TypeScript paths**: server uses `@/*` → `src/*` (see `tsconfig.json`); web uses the same convention.
- **Zod everywhere**: server routes validate via Zod schemas exported from `dto.ts`. Don't bypass — the same schemas drive the OpenAPI spec.
- **No tests to run**: don't claim work is "tested" unless you've manually verified it. `pnpm validate` only catches lint + types.
- **Per-app installs**: a change to `apps/server` requires `pnpm install` in that app. There is no hoisted root `node_modules`.
