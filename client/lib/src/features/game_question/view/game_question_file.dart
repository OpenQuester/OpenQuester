import 'package:animate_do/animate_do.dart';
import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';
import 'package:video_player/video_player.dart';

class GameQuestionMediaWidget extends WatchingWidget {
  const GameQuestionMediaWidget({required this.file, super.key});
  final PackageQuestionFile file;

  @override
  Widget build(BuildContext context) {
    final mediaController = watchValue(
      (GameQuestionController e) => e.mediaController,
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
        child = ImageWidget(url: url);
      } else if (mediaController != null) {
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

    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: 8.circular,
          border: Border.all(color: borderColor),
        ),
        constraints: const BoxConstraints(minHeight: 300),
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
