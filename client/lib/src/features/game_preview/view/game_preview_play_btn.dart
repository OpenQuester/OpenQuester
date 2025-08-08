import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GamePreviewPlayButton extends StatelessWidget {
  const GamePreviewPlayButton({super.key});

  @override
  Widget build(BuildContext context) {
    return FadeInAnimationWidget(
      child: LoadingButtonBuilder(
        onPressed: () async {
          await const ProfileDialog().showIfUnauthorized(context);
          await getIt<GamePreviewController>().onPressPlay();
        },
        child: const Icon(Icons.play_arrow),
        builder: (context, child, onPressed) => FilledButton(
          onPressed: onPressed,
          child: child,
        ).withTooltip(msg: LocaleKeys.join_game.tr()),
      ),
    );
  }
}
