# OpenQuester Web

The hosted OpenQuester client. It is separate from the Flutter native application and builds to `dist/` for the existing Cloudflare Pages project.

## Local development

Use Node 24, copy `.env.example` to `.env`, and set `VITE_API_URL` when the API is not on the same origin.

```bash
npm ci
npm run dev
```

Useful checks are `npm run generate:api:check`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

## Deployment and rollback

The client workflow uploads `client-web/dist` and deploys it to the existing `openquester-dev` Cloudflare Pages project. Validate the preview branch first, then promote that exact artifact through the existing production workflow input. Keep the final successful Flutter Web artifact until validation is complete; rollback redeploys that retained artifact without changing Android, Windows, or Linux jobs.
