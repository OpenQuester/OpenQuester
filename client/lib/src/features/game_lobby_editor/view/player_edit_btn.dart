import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:openquester/openquester.dart';

class PlayerEditBtn extends WatchingWidget {
  const PlayerEditBtn({
    required this.player,
    super.key,
  });
  final PlayerData player;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.edit),
      tooltip: LocaleKeys.player_edit_title.tr(),
      onPressed: () => showEditMenu(context: context, player: player),
    );
  }

  // ignore: avoid_positional_boolean_parameters
  static String statusBtnText(String text, bool state) {
    return !state
        ? text
        : LocaleKeys.player_edit_remove_status.tr(args: [text.toLowerCase()]);
  }

  static Future<void> showEditMenu({
    required BuildContext context,
    required PlayerData player,
    Offset? offset,
  }) {
    final gameData = getIt<GameLobbyController>().gameData.value;
    final gameState = gameData?.gameState;
    final restrictions = player.restrictionData;
    final controller = getIt<GameLobbyEditorController>();
    final currentRestrictions = SocketIOPlayerRestrictionInput(
      playerId: player.meta.id,
      banned: restrictions.banned,
      muted: restrictions.muted,
      restricted: restrictions.restricted,
    );

    void changePlayerRestrictions(
      SocketIOPlayerRestrictionInput newRestrictions,
    ) => controller.addPlayerRestriction(newRestrictions);

    Future<void> changeScore() async {
      final newScoreText = await OneFieldDialog(
        keyboardType: TextInputType.number,
        initText: player.score.toString(),
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      ).show(context);
      if (newScoreText == null) return;

      final newScore = int.tryParse(newScoreText);
      if (newScore == null) return;

      controller.changeScore(player.meta.id, newScore);
    }

    final items = <PopupMenuItem<void>>[
      PopupMenuItem(
        onTap: changeScore,
        child: Text(LocaleKeys.player_edit_change_score.tr()),
      ),
      if (gameState?.currentTurnPlayerId != player.meta.id)
        PopupMenuItem(
          onTap: gameState?.currentTurnPlayerId == player.meta.id
              ? null
              : () => controller.giveTurnToPlayer(player.meta.id),
          child: Text(LocaleKeys.player_edit_give_turn.tr()),
        ),
      PopupMenuItem(
        onTap: () => changePlayerRestrictions(
          currentRestrictions.copyWith(
            restricted: !restrictions.restricted,
          ),
        ),
        child: Text(
          statusBtnText(
            LocaleKeys.player_edit_kick.tr(),
            restrictions.restricted,
          ),
        ),
      ),
      PopupMenuItem(
        onTap: () => changePlayerRestrictions(
          currentRestrictions.copyWith(
            banned: !restrictions.banned,
          ),
        ),
        child: Text(
          statusBtnText(
            LocaleKeys.player_edit_ban.tr(),
            restrictions.banned,
          ),
        ),
      ),
      PopupMenuItem(
        onTap: () => changePlayerRestrictions(
          currentRestrictions.copyWith(
            muted: !restrictions.muted,
          ),
        ),
        child: Text(
          statusBtnText(
            LocaleKeys.player_edit_mute.tr(),
            restrictions.muted,
          ),
        ),
      ),
    ];

    final renderBox = context.findRenderObject()! as RenderBox;
    final rectOffset = renderBox.localToGlobal(offset ?? const Offset(42, 42));

    return showMenu(
      context: context,
      items: items,
      position: RelativeRect.fromLTRB(
        rectOffset.dx,
        rectOffset.dy,
        rectOffset.dx + renderBox.size.width,
        rectOffset.dy + renderBox.size.height,
      ),
    );
  }
}
