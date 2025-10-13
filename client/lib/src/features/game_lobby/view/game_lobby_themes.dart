import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GameLobbyThemes extends WatchingWidget {
  const GameLobbyThemes({super.key});

  @override
  Widget build(BuildContext context) {
    // Save scroll position
    final scrollController = createOnce(() {
      final controller = ScrollController(
        initialScrollOffset:
            getIt<GameLobbyController>().themeScrollPosition ?? 0,
      );

      controller.addListener(
        () => getIt<GameLobbyController>().themeScrollPosition =
            controller.offset,
      );
      return controller;
    }, dispose: (c) => c.dispose());

    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final round = gameData?.gameState.currentRound;

    registerHandler(
      select: (GameLobbyController e) => e.gameData,
      handler: (context, newValue, cancel) {
        if (round?.order == newValue?.gameState.currentRound?.order) {
          return;
        }
        // Reset scroll position when round changes
        scrollController.animToTop();
      },
    );

    final themes =
        round
            ?.sortedThemes()
            .map((theme) => GameLobbyTheme(theme: theme).paddingBottom(16))
            .toList() ??
        [];

    return ListView.builder(
      controller: scrollController,
      padding: 8.vertical + screenBottomInset(context).bottom,
      itemCount: themes.length,
      itemBuilder: (context, index) => themes[index],
    );
  }
}
