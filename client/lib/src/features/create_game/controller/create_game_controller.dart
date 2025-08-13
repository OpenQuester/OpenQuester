import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class CreateGameController {
  CreateGameController();

  final ValueNotifier<CreateGameDto> state = ValueNotifier(
    const CreateGameDto(),
  );
  final formKey = GlobalKey<FormState>();

  void dispose() {
    state.dispose();
  }

  Future<void> createGame(BuildContext context) async {
    if (!getIt<AuthController>().authorized) {
      await getIt<ToastController>().show(LocaleKeys.user_unauthorized.tr());
      return;
    }

    final formValid = formKey.currentState?.validate() ?? false;
    if (!formValid) return;

    final game = await Api.I.api.games.postV1Games(
      body: state.value.toRequestData(),
    );

    // Join the game with the selected role
    await getIt<GameLobbyController>().join(
      gameId: game.id,
      role: state.value.selectedRole,
    );

    // Navigate to the game lobby
    await AppRouter.I.replace(GameLobbyRoute(gameId: game.id));
  }
}
