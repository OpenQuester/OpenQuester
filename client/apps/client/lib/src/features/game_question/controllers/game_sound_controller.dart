import 'dart:async';

import 'package:openquester/common_imports.dart';
import 'package:video_player/video_player.dart';

/// Short cues, the same as the web client's: the buzzer opening, your turn
/// to answer, someone pressing, a right and a wrong answer.
enum GameSound { open, turn, buzz, correct, wrong }

@singleton
class GameSoundController {
  final Set<VideoPlayerController> _playing = {};

  void play(GameSound sound) {
    if (!getIt<SettingsController>().settings.gameSounds) return;
    unawaited(_play(sound));
  }

  Future<void> _play(GameSound sound) async {
    final controller = VideoPlayerController.asset(
      'assets/sounds/${sound.name}.wav',
    );
    _playing.add(controller);
    try {
      await controller.initialize();
      final volume = getIt<GameQuestionController>().volume.value;
      await controller.setVolume(VideoPlayerUtils.toLogVolume(volume));
      await controller.play();
      // Cues are well under a second; free the player once it has played
      await Future<void>.delayed(
        controller.value.duration + const Duration(milliseconds: 300),
      );
    } catch (e) {
      // Platforms without a media player (Linux) stay silent
      logger.d('GameSoundController: cannot play ${sound.name}: $e');
    } finally {
      _playing.remove(controller);
      await controller.dispose();
    }
  }
}
