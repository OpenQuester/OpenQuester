import 'package:animate_do/animate_do.dart';
import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';
import 'package:openquester/src/features/game_question/view/waiting_for_others_loader.dart';
import 'package:video_player/video_player.dart';

class GameQuestionMediaWidget extends WatchingWidget {
  const GameQuestionMediaWidget({required this.file, super.key});
  final PackageQuestionFile file;

  @override
  Widget build(BuildContext context) {
    final mediaController = watchValue(
      (GameQuestionController e) => e.mediaController,
    );
    final waitingForPlayers = watchValue(
      (GameQuestionController e) => e.waitingForPlayers,
    );
    final showMedia = watchValue((GameQuestionController e) => e.showMedia);
    final error = watchValue((GameQuestionController e) => e.error);

    final url = file.file.link;
    final fileType = file.file.type;

    final borderColor = context.theme.colorScheme.primary;
    final loader = SizedBox.expand(
      child: CircularProgressIndicator(color: borderColor).center(),
    );

    Widget child = loader;

    if (error != null) {
      child = Text(error).paddingAll(24);
    } else if (showMedia) {
      if (fileType == PackageFileType.image) {
        child = ImageWidget(
          url: url,
          afterLoad: getIt<GameQuestionController>().onImageLoaded,
          forcedLoader: ValueListenableBuilder(
            valueListenable: getIt<GameQuestionController>().waitingForPlayers,
            builder: (context, value, child) {
              if (value) return const WaitingForOthersLoader();
              return const SizedBox.shrink();
            },
          ),
        );
      } else if (mediaController != null) {
        if (waitingForPlayers) {
          child = const WaitingForOthersLoader();
        } else {
          if (fileType == PackageFileType.audio) {
            child = const Icon(Icons.music_note, size: 60).fadeOut();
          } else {
            child = AspectRatio(
              aspectRatio: mediaController.value.aspectRatio,
              child: VideoPlayer(mediaController),
            ).fadeIn();
          }
        }
      }
    }

    if (waitingForPlayers) return child;

    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: 8.circular,
          border: Border.all(color: borderColor),
        ),
        constraints: const BoxConstraints(minHeight: 300),
        clipBehavior: Clip.antiAlias,
        child: AnimatedCrossFade(
          alignment: Alignment.center,
          duration: Durations.long2,
          crossFadeState: showMedia
              ? CrossFadeState.showSecond
              : CrossFadeState.showFirst,
          firstChild: SizedBox.expand(child: loader.center()),
          secondChild: SizedBox.expand(child: child.center()),
          layoutBuilder: (topChild, topChildKey, bottomChild, bottomChildKey) {
            return Stack(
              alignment: Alignment.center,
              children: [
                Positioned.fill(key: bottomChildKey, child: bottomChild),
                Positioned.fill(key: topChildKey, child: topChild),
              ],
            );
          },
        ),
      ).center(),
    );
  }
}
