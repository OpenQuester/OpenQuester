import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class GameStakeQuestionBids extends WatchingWidget {
  const GameStakeQuestionBids({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final stakeController = watchIt<GameLobbyPlayerStakesController>();

    int getPlayerBid(PlayerData player) =>
        stakeController.getPlayerBid(player.meta.id) ?? -1;

    final players = (gameData?.players ?? [])
        .where(
          (e) =>
              e.role == PlayerRole.player &&
              e.status == PlayerDataStatus.inGame,
        )
        .sorted((a, b) => getPlayerBid(b).compareTo(getPlayerBid(a)));

    return Column(
      spacing: 8,
      children: [
        Text(
          LocaleKeys.game_stake_question_players_stakes.tr(),
          textAlign: TextAlign.center,
          style: context.textTheme.headlineSmall,
        ),
        for (var index = 0; index < players.length; index++)
          _PlayerStake(
            index: index,
            bidding: stakeController.bidderId == players[index].meta.id,
            playerData: players[index],
            stake: stakeController.getPlayerBid(players[index].meta.id),
          ),
        if (players.isEmpty) const Text('-'),
      ],
    );
  }
}

class _PlayerStake extends StatelessWidget {
  const _PlayerStake({
    required this.playerData,
    required this.stake,
    required this.index,
    required this.bidding,
  });
  final PlayerData playerData;
  final int? stake;
  final int index;
  final bool bidding;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        selected: bidding,
        title: Text(
          [(index + 1).toString(), playerData.meta.username].join('. '),
        ),
        trailing: ScoreText(
          score: stake,
          textStyle: context.textTheme.bodyLarge,
        ),
      ),
    );
  }
}
