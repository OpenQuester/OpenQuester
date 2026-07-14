# OpenQuester repository instructions

## Repository map

- `server/` — TypeScript/Node.js backend using Express, Socket.IO, PostgreSQL, and Redis.
- `client/` — Flutter/Dart Melos workspace. The application is under `apps/client/`; reusable packages are under `packages/`.
- `loadtest/` — TypeScript load-testing tool.
- `openapi/` — OpenAPI schema and generated-client inputs.
- `websites/` — Hugo documentation and landing page.

There is no single root build or test command. Work from the affected subproject and keep unrelated subprojects unchanged.

## Scope routing

- For server work, follow `server/AGENTS.md`.
- For client work, follow `client/AGENTS.md`.
- For API-contract changes, inspect the schema, server consumers, generated Dart SDK, and affected client callers.
- When a change crosses subprojects, verify each affected contract separately.
- Do not edit generated files directly when the repository provides a generator.

## Commands

From `server/`:

- `npm run build`
- `npm run lint`
- `npm test`
- `npx jest path/to/test`
- `npm run validate:schema`

From `loadtest/`:

- `npm run build`
- `npm run dev`
- `npm start`

From `client/`:

- Use the SDK pinned by `.puro.json`.
- Use the Melos scripts declared in `pubspec.yaml` for workspace-wide generation, analysis, tests, and formatting.
- Use `./oqhelper` for focused project generation commands.

## Shared expectations

- Preserve public API, Socket.IO, persistence, and generated-client contracts unless the request explicitly changes them.
- Add focused regression coverage for changed behavior when an established test pattern exists.
- When asked to commit, use Conventional Commits.
