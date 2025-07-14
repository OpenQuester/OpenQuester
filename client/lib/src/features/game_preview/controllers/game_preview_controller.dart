import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

@singleton
class GamePreviewController {
  final Duration animationDuration = Durations.short2;
  GameListItem? game;

  Future<void> initWithId(String gameId) async {
    final item = await getIt<Api>().api.games.getV1GamesGameId(gameId: gameId);
    init(item);
  }

  void init(GameListItem item) {
    game = item;
    // Warmup cache during animation
    unawaited(getIt<PackageController>().getPackage(item.package.id));
  }

  void clear() {
    game = null;
  }

  Future<void> onPressPlay(BuildContext context) async {
    if (!getIt<AuthController>().authorized) {
      await getIt<ToastController>().show(LocaleKeys.user_unauthorized.tr());
      return;
    }

    if (game == null) throw Exception('game == null');

    final gameId = game!.id;
    await getIt<GameLobbyController>().join(gameId: gameId);
    // Using popAndPush to avoid animation bug
    // when page with preview is not pop'ed Here widget is not returning
    // to his place
    await getIt<AppRouter>().popAndPush(GameLobbyRoute(gameId: gameId));
  }
}
