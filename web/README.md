# OpenQuester web

Play OpenQuester in the browser on a phone, tablet or laptop. See `AGENTS.md`
for the stack, commands and rules.

```bash
cd web
npm ci
npm run e2e:stack -- up               # local backend on :53000 (needs Docker)
OQ_API_PROXY=http://localhost:53000 npm run dev
node e2e/support/seed.mjs             # add a demo package with every question type
```

Open http://localhost:5173, continue as a guest, pick the demo package and host
a game. Open the invite link in another browser profile to join as a player.
