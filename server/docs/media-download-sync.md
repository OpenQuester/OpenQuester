# Media Download Synchronization Feature

## Overview
This feature ensures fair gameplay by tracking when players have downloaded
media content for questions. The game remains in `MEDIA_DOWNLOADING` until all
active players are ready or the media timeout expires, then transitions to
`SHOWING` with the normal question timer.

The readiness barrier includes only active players (`PLAYER` / `IN_GAME`), not
the showman or spectators. Regular questions without files still use this
handshake; the client sends its acknowledgement immediately.

## Event Flow Diagram

```
┌─────────────┐                     ┌─────────────┐                     ┌─────────────┐
│   Player 1  │                     │   Server    │                     │   Player 2  │
└──────┬──────┘                     └──────┬──────┘                     └──────┬──────┘
       │                                   │                                   │
       │  1. Showman picks question        │                                   │
       │ ─────────────────────────────────>│                                   │
       │                                   │                                   │
       │  2. QUESTION_DATA event           │  2. QUESTION_DATA event           │
       │ <─────────────────────────────────┤──────────────────────────────────>│
       │    (question data, media timer)    │    (question data, media timer)   │
       │                                   │                                   │
       │  3. Download/Load media           │                                   │  3. Download/Load media
       │     ⏳                            │                                   │     ⏳
       │                                   │                                   │
       │  4. MEDIA_DOWNLOADED              │                                   │
       │ ─────────────────────────────────>│                                   │
       │                                   │                                   │
       │  5. MEDIA_DOWNLOAD_STATUS         │  5. MEDIA_DOWNLOAD_STATUS         │
       │ <─────────────────────────────────┤──────────────────────────────────>│
       │    (player1: true, allReady: false)  (player1: true, allReady: false) │
       │                                   │                                   │
       │  UI: ✓ Player 1                   │                                   │  UI: ✓ Player 1
       │      ⏳ Player 2                  │                                   │      ⏳ Player 2
       │                                   │                                   │
       │                                   │  6. MEDIA_DOWNLOADED              │
       │                                   │ <─────────────────────────────────│
       │                                   │                                   │
       │  7. MEDIA_DOWNLOAD_STATUS         │  7. MEDIA_DOWNLOAD_STATUS         │
       │ <─────────────────────────────────┤──────────────────────────────────>│
       │    (player2: true, allReady: true)   (player2: true, allReady: true)  │
       │                                   │                                   │
       │  UI: ✓ Player 1                   │                                   │  UI: ✓ Player 1
       │      ✓ Player 2                   │                                   │      ✓ Player 2
       │                                   │                                   │
       │  8. Start media playback          │                                   │  8. Start media playback
       │     ▶️                            │                                   │     ▶️
       │                                   │                                   │

Legend:
✓ = Green check (downloaded)
⏳ = Orange downloading icon
▶️ = Media playback starts after all players ready
```

## How It Works

### Backend (Server)

1. **Player State Tracking**
   - Added `mediaDownloaded` field to `PlayerDTO` and `Player` entity
   - Tracks whether each player has downloaded the current question's media

2. **Socket.IO Events**
   - `MEDIA_DOWNLOADED`: Sent by client when media download completes
   - `MEDIA_DOWNLOAD_STATUS`: Broadcast to all clients with player's download status

3. **Event Flow**
   - When a question is picked, all players' `mediaDownloaded` status is reset to `false`
   - Outgoing `QUESTION_PICK` receives personalized `QUESTION_DATA` with file links and the media timer
   - Client downloads/loads media and sends `MEDIA_DOWNLOADED` event
   - The server processes readiness only in `MEDIA_DOWNLOADING`. An ACK in any other phase is a successful no-op: no readiness change, persistence/timer mutation, or status broadcast. This also covers late ACKs after players have entered `SHOWING`.
   - Server broadcasts `MEDIA_DOWNLOAD_STATUS` to all clients with `allPlayersReady` flag
   - All clients update their UI to show which players have downloaded media
   - When `allPlayersReady` is `true`, clients start media playback synchronously
   - Readiness completion does not emit a second `QUESTION_DATA` or an inbound `QUESTION_PICK`

3. **Timer semantics**
   - Picking a regular question starts the `MEDIA_DOWNLOAD_TIMEOUT` timer.
   - Partial readiness broadcasts contain `timer: null`; the media timeout
     remains active in persisted game state.
   - Full readiness or media timeout transitions to `SHOWING`, and the status
     broadcast contains the new `GAME_QUESTION_ANSWER_TIME` timer.

### Frontend (Client)

1. **Media Download Detection**
   - After media (video/audio/image) is loaded, client sends `MEDIA_DOWNLOADED` event
   - For questions without media, event is sent immediately
   - Media is prepared but NOT played until all players are ready

2. **Synchronized Playback**
   - Client waits for `allPlayersReady` signal from server
   - Only when all active players have downloaded media does playback start
   - Ensures fair gameplay where all players see content simultaneously

3. **Visual Indicators**
   - Orange downloading icon: Player is still downloading media
   - Green check icon: Player has downloaded media
   - Indicators only shown when active question has media

4. **State Management**
   - Player download status is stored in game state
   - Status is reset when new question is picked
   - UI reactively updates based on status changes

## Files Modified

### Backend
- `src/domain/enums/SocketIOEvents.ts` - Added new event enums
  ```typescript
  MEDIA_DOWNLOADED = "media-downloaded",      // Client -> Server
  MEDIA_DOWNLOAD_STATUS = "media-download-status",  // Server -> All Clients
  ```
- `src/domain/types/dto/game/player/PlayerDTO.ts` - Added mediaDownloaded field
- `src/domain/entities/game/Player.ts` - Added media download tracking
- `src/presentation/controllers/io/SocketActionMap.ts` - Maps `MEDIA_DOWNLOADED` to `GameActionType.MEDIA_DOWNLOADED`
- `src/application/usecases/game/MediaDownloadedUseCase.ts` - Marks the player as ready and returns save/broadcast mutations
- `src/application/config/ActionHandlerConfig.ts` - Registers the media downloaded use case
- `src/domain/logic/question/MediaDownloadLogic.ts` - Checks whether all active players are ready
- `src/domain/types/socket/events/game/MediaDownloadStatusEventPayload.ts` - Event payload type
  ```typescript
  interface MediaDownloadStatusBroadcastData {
    playerId: number;
    mediaDownloaded: boolean;
    allPlayersReady: boolean;
    timer: GameStateTimerDTO | null;
  }
  ```
- OpenAPI schema - Updated media download event contract

### Current implementation references

- `src/application/usecases/game/MediaDownloadedUseCase.ts`
- `src/application/services/timer/TimerExpirationService.ts`
- `src/domain/state-machine/handlers/regular-round/ChoosingToMediaDownloadingHandler.ts`
- `src/domain/state-machine/handlers/regular-round/MediaDownloadingToShowingHandler.ts`
- `src/domain/types/socket/events/game/MediaDownloadStatusEventPayload.ts`

The generated client contract is derived from `openapi/schema.json`; do not use
historical manual generated-file paths as implementation guidance.

## API Usage Examples

### Client-Side (Dart/Flutter)
```dart
// Emit media downloaded event (done automatically by GameQuestionController)
socket?.emit(SocketIOGameSendEvents.mediaDownloaded.json!);

// Listen for status updates (handled in GameLobbyController)
socket?.on(SocketIOGameReceiveEvents.mediaDownloadStatus.json!, (data) {
  final statusData = MediaDownloadStatusEventPayload.fromJson(
    data as Map<String, dynamic>,
  );
  // Access typed fields
  final playerId = statusData.playerId;
  final mediaDownloaded = statusData.mediaDownloaded;
  final allPlayersReady = statusData.allPlayersReady;
  // Update UI
});
```

### Server-Side (TypeScript)
```typescript
// The use case marks the player ready, transitions when appropriate,
// and broadcasts readiness plus the resulting timer to the whole game.
await gameActionExecutor.submitAction(mediaDownloadedAction);
```

## Potential future enhancements

The current implementation enforces media readiness through its timeout.
Potential future improvements include:

1. **Content Hiding**: Don't show question content until all players are ready (or timeout)
2. **Progress Indicators**: Show download progress percentage instead of just status
3. **Skip Option**: Allow showman to skip waiting for specific players
