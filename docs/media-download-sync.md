# Media Download Synchronization Feature

## Overview
This feature ensures fair gameplay by tracking when players have downloaded media content for questions. The game displays visual indicators on player cards showing the download status of each player.

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
       │    (mediaDownloaded: false)       │    (mediaDownloaded: false)       │
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

Legend:
✓ = Green check (downloaded)
⏳ = Orange downloading icon
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
   - Client sends `MEDIA_DOWNLOADED` event after completing download
   - Server broadcasts `MEDIA_DOWNLOAD_STATUS` to all clients
   - All clients update their UI to show which players have downloaded media

### Frontend (Client)

1. **Media Download Detection**
   - After media (video/audio/image) is loaded, client sends `MEDIA_DOWNLOADED` event
   - For questions without media, event is sent immediately

2. **Visual Indicators**
   - Orange downloading icon: Player is still downloading media
   - Green check icon: Player has downloaded media
   - Indicators only shown when active question has media

3. **State Management**
   - Player download status is stored in game state
   - Status is reset when new question is picked
   - UI reactively updates based on status changes

## Files Modified

### Backend
- `server/src/domain/enums/SocketIOEvents.ts` - Added new event enums
  ```typescript
  MEDIA_DOWNLOADED = "media-downloaded",      // Client -> Server
  MEDIA_DOWNLOAD_STATUS = "media-download-status",  // Server -> All Clients
  ```
- `server/src/domain/types/dto/game/player/PlayerDTO.ts` - Added mediaDownloaded field
- `server/src/domain/entities/game/Player.ts` - Added media download tracking
- `server/src/domain/handlers/socket/game/MediaDownloadedEventHandler.ts` - New handler
- `server/src/application/services/socket/SocketIOQuestionService.ts` - Added media download methods
  - `handleMediaDownloaded(socketId)` - Handles incoming media downloaded event
  - `resetMediaDownloadStatus(game)` - Resets all players' status
- `server/src/domain/handlers/socket/SocketEventHandlerFactory.ts` - Registered handler
- `server/src/domain/types/socket/events/game/MediaDownloadStatusEventPayload.ts` - Event payload type
  ```typescript
  interface MediaDownloadStatusBroadcastData {
    playerId: number;
    mediaDownloaded: boolean;
    allPlayersReady: boolean;
  }
  ```
- `openapi/schema.json` - Updated OpenAPI schema

### Frontend
- `client/lib/src/features/game_question/controllers/game_question_controller.dart` - Send media downloaded event
  - Calls `notifyMediaDownloaded()` after media loads or immediately if no media
- `client/lib/src/features/game_lobby/controllers/game_lobby_controller.dart` - Handle status events
  - `notifyMediaDownloaded()` - Emits MEDIA_DOWNLOADED event to server
  - `_onMediaDownloadStatus()` - Updates player state when receiving status broadcasts using `MediaDownloadStatusEventPayload` model
- `client/lib/src/features/game_lobby/view/game_lobby_player.dart` - Visual indicators
  - `_MediaDownloadIndicator` widget shows download status icons
- `openapi/dart_sdk/lib/src/models/media_download_status_event_payload.dart` - Event payload model (temporary manual implementation)
  - This file should be replaced when running `make build` to regenerate the full SDK from OpenAPI schema

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
// The handler automatically:
// 1. Marks player as downloaded
// 2. Checks if all players are ready
// 3. Broadcasts status to all clients
await socketIOQuestionService.handleMediaDownloaded(socketId);

// Reset status when new question is picked
socketIOQuestionService.resetMediaDownloadStatus(game);
```

## Future Enhancements

The current implementation provides visual feedback but doesn't enforce waiting. Potential enhancements:

1. **Timeout Implementation**: Add a 10-second timeout after which the question proceeds regardless of download status
2. **Content Hiding**: Don't show question content until all players are ready (or timeout)
3. **Progress Indicators**: Show download progress percentage instead of just status
4. **Skip Option**: Allow showman to skip waiting for specific players
