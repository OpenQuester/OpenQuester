# Media Download Synchronization Feature

## Overview
This feature ensures fair gameplay by tracking when players have downloaded media content for questions. The game displays visual indicators on player cards showing the download status of each player.

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
- `server/src/domain/types/dto/game/player/PlayerDTO.ts` - Added mediaDownloaded field
- `server/src/domain/entities/game/Player.ts` - Added media download tracking
- `server/src/domain/handlers/socket/game/MediaDownloadedEventHandler.ts` - New handler
- `server/src/application/services/socket/SocketIOQuestionService.ts` - Added media download methods
- `server/src/domain/handlers/socket/SocketEventHandlerFactory.ts` - Registered handler
- `server/src/domain/types/socket/events/game/MediaDownloadStatusEventPayload.ts` - Event payload type
- `openapi/schema.json` - Updated OpenAPI schema

### Frontend
- `client/lib/src/features/game_question/controllers/game_question_controller.dart` - Send media downloaded event
- `client/lib/src/features/game_lobby/controllers/game_lobby_controller.dart` - Handle status events
- `client/lib/src/features/game_lobby/view/game_lobby_player.dart` - Visual indicators

## Future Enhancements

The current implementation provides visual feedback but doesn't enforce waiting. Potential enhancements:

1. **Timeout Implementation**: Add a 10-second timeout after which the question proceeds regardless of download status
2. **Content Hiding**: Don't show question content until all players are ready (or timeout)
3. **Progress Indicators**: Show download progress percentage instead of just status
4. **Skip Option**: Allow showman to skip waiting for specific players
