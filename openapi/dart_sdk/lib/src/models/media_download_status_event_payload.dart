// GENERATED CODE - Manual implementation until SDK is regenerated
// This file should be replaced when running `make build` in openapi/dart_sdk/

/// Data sent to all players when a player downloads media
class MediaDownloadStatusEventPayload {
  /// ID of the player who downloaded media
  final int playerId;
  
  /// Whether the player has downloaded media
  final bool mediaDownloaded;
  
  /// Whether all active players have downloaded media
  final bool allPlayersReady;

  /// Question timer (only present when allPlayersReady is true)
  final GameStateTimer? timer;

  const MediaDownloadStatusEventPayload({
    required this.playerId,
    required this.mediaDownloaded,
    required this.allPlayersReady,
    this.timer,
  });

  factory MediaDownloadStatusEventPayload.fromJson(Map<String, dynamic> json) {
    return MediaDownloadStatusEventPayload(
      playerId: json['playerId'] as int,
      mediaDownloaded: json['mediaDownloaded'] as bool,
      allPlayersReady: json['allPlayersReady'] as bool,
      timer: json['timer'] != null
          ? GameStateTimer.fromJson(json['timer'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'playerId': playerId,
      'mediaDownloaded': mediaDownloaded,
      'allPlayersReady': allPlayersReady,
      if (timer != null) 'timer': timer!.toJson(),
    };
  }
}
