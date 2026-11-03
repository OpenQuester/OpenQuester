---
title: Media Download Sync
weight: 20
---

# Media Download Synchronization Feature

## Overview

The server coordinates readiness for regular questions. File transfer, browser
decoding, and visible playback happen separately from socket delivery.

## Event sequence

1. The showman sends `question-pick`. The server enters `MEDIA_DOWNLOADING`,
   starts the media timer, and sends role-filtered `question-data` with file links.
2. Eligible players prepare the media and send `media-downloaded`. A question
   without files can be acknowledged immediately. Partial
   `media-download-status` events have `allPlayersReady: false` and a null
   replacement timer.
3. The last required acknowledgement advances the game to `SHOWING`. The server
   broadcasts completion, a question timer, and the content plan in
   `media-download-status`. It sends no second `question-data` event.
4. If the media timer expires, the server advances with system-reported
   readiness (`playerId: -1`). This status does not establish that a file loaded.

Only eligible, connected players in the roster captured at the question pick
can block readiness. An acknowledgement outside the media phase does not
change readiness or broadcast status.

## Verification

Backend transport tests simulate readiness acknowledgements and verify phase,
timers, and event order. Downloaded bytes, decoded images, reveal, and playback
require separate browser verification.

See the [implementation reference](https://github.com/OpenQuester/OpenQuester/blob/main/server/docs/media-download-sync.md)
for phase guards, reconnect behavior, and content timing.
