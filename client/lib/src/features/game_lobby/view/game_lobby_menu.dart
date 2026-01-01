import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:openquester/common_imports.dart';

class GameLobbyMenu extends WatchingWidget {
  const GameLobbyMenu({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = getIt<GameLobbyController>();
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final me = gameData?.me;
    final pauseState = gameData?.gameState.isPaused ?? false;
    final imShowman = me?.role == PlayerRole.showman;
    final lobbyEditorMode = watchValue(
      (GameLobbyController e) => e.lobbyEditorMode,
    );

    return PopupMenuButton(
      itemBuilder: (BuildContext context) => [
        const PopupMenuItem<void>(child: _VolumeSlider()),
        PopupMenuItem<void>(
          child: Text(LocaleKeys.copy_game_link.tr()),
          onTap: () async {
            final gameId = getIt<GameLobbyController>().gameId;
            if (gameId == null) return;
            final link = Env.clientAppUrl.replace(path: '/games/$gameId');
            await Clipboard.setData(ClipboardData(text: link.toString()));
          },
        ),
        if (!lobbyEditorMode)
          PopupMenuItem<void>(
            child: Text(
              LocaleKeys.game_lobby_editor_open_player_editor.tr(),
            ),
            onTap: () => controller.lobbyEditorMode.value = true,
          ),
        if (imShowman) ...[
          PopupMenuItem<void>(
            child: Text(
              pauseState ? LocaleKeys.resume_game.tr() : LocaleKeys.pause.tr(),
            ),
            onTap: () =>
                getIt<GameLobbyController>().setPause(pauseState: !pauseState),
          ),
          PopupMenuItem<void>(
            child: Text(LocaleKeys.question_skip_round.tr()),
            onTap: () async {
              final result = await ConfirmDialog(
                title: LocaleKeys.question_sure_skip_round.tr(),
              ).show(context);
              if (!result) return;
              getIt<GameLobbyController>().skipRound();
            },
          ),
          PopupMenuItem<void>(
            child: Text(LocaleKeys.delete_lobby.tr()),
            onTap: () async {
              final result = await ConfirmDialog(
                title: LocaleKeys.delete_lobby_confirmation.tr(),
              ).show(context);
              if (!result) return;
              await getIt<GamesListController>().deleteLobby(
                getIt<GameLobbyController>().gameListData.value!.id,
              );
            },
          ),
        ],
      ],
      icon: const Icon(Icons.more_vert),
    );
  }
}

class _VolumeSlider extends StatefulWidget {
  const _VolumeSlider();

  @override
  State<_VolumeSlider> createState() => _VolumeSliderState();
}

class _VolumeSliderState extends State<_VolumeSlider> {
  late double volume;

  @override
  void initState() {
    volume = getIt<GameQuestionController>().volume.value;
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(LocaleKeys.volume.tr()),
        Slider(
          value: volume,
          onChanged: (value) {
            final volume = double.parse(
              value.clamp(0, 1).toStringAsExponential(2),
            );
            if (this.volume == volume) return;
            this.volume = volume;
            setState(() {});
            unawaited(getIt<GameQuestionController>().onChangeVolume(volume));
          },
        ),
      ],
    );
  }
}
