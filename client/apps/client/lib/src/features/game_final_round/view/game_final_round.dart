import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class GameFinalRoundBody extends WatchingWidget {
  const GameFinalRoundBody({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<GameLobbyThemePickerController>();
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final themes = gameData?.gameState.currentRound?.themes ?? [];
    final eliminatedThemes =
        gameData?.gameState.finalRoundData?.eliminatedThemes ?? [];
    final allowToSelect =
        (gameData?.gameState.currentTurnPlayerId == gameData?.me.meta.id ||
            (gameData?.me.isShowman ?? false)) &&
        gameData?.me.isSpectator == false;

    final body = Column(
      spacing: 16,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const GameQuestionTimer(),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 550),
          child: ListView.separated(
            separatorBuilder: (_, _) => 8.height,
            itemCount: themes.length,
            itemBuilder: (context, index) {
              final theme = themes[index];
              return _GameFinalRoundTile(
                data: theme,
                enabled: !eliminatedThemes.contains(theme.id),
                selected: controller.selectedThemeId == theme.id,
                onTap: !allowToSelect
                    ? null
                    : () => getIt<GameLobbyThemePickerController>().pick(
                        theme.id!,
                      ),
              );
            },
          ),
        ).center().expand(),
        if (allowToSelect)
          FilledButton(
            onPressed: controller.selectedThemeId == null
                ? null
                : controller.confirmSelection,
            child: Text(LocaleKeys.confirm.tr()),
          ).center(),
      ],
    );

    return SafeArea(child: body.paddingAll(16));
  }
}

class _GameFinalRoundTile extends WatchingWidget {
  const _GameFinalRoundTile({
    required this.data,
    required this.enabled,
    required this.selected,
    required this.onTap,
  });
  final SocketIoGameStateThemeData data;
  final bool enabled;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      shape: selected
          ? RoundedRectangleBorder(
              side: BorderSide(
                color: context.theme.colorScheme.primary,
                width: 2,
              ),
              borderRadius: BorderRadius.circular(8),
            )
          : null,
      elevation: enabled
          ? selected
                ? 8
                : 2
          : 0,
      child: ListTile(
        onTap: onTap,
        enabled: enabled,
        selected: selected,
        title: Text(
          data.name,
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
