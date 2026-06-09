import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GamePreviewPlayButton extends StatelessWidget {
  const GamePreviewPlayButton({super.key});

  @override
  Widget build(BuildContext context) {
    return LoadingButtonBuilder(
      onPressed: () async {
        await const ProfileDialog().showIfUnauthorized(context);
        await getIt<GamePreviewController>().onPressPlay();
      },
      onError: handleError,
      child: Text(LocaleKeys.join_game.tr()),
      builder: (context, child, onPressed) => FilledButton.icon(
        onPressed: onPressed,
        icon: const Icon(Icons.play_arrow_rounded),
        label: child,
      ).withTooltip(msg: LocaleKeys.join_game.tr()),
    );
  }
}
