# Discord Activity art assets

Upload these in the Discord Developer Portal (see `docs/specs/discord-activity.md`):

- `cover.png` (1920×1080, 16:9): Activities → Art Assets → cover image, shown in the
  Activity shelf when people pick something to play in a voice channel.
- `icon.png` (1024×1024): General Information → App Icon, if the application doesn't
  already use the OpenQuester logo.

Both come from `cover.html` (midnight theme colours, the logo from `web/public/favicon.svg`).
Edit it, then re-render from `web/`:

```bash
node scripts/render-activity-assets.mjs
```
