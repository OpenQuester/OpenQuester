import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class GameStakeQuestionBids extends StatelessWidget {
  const GameStakeQuestionBids({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final stakeData = gameData?.gameState.stakeQuestionData;

    int getPlayerBid(PlayerData player) {
      return stakeData?.bids[player.meta.id.toString()] ??
          double.negativeInfinity.toInt();
    }

    final players = (gameData?.players ?? [])
        .where(
          (e) =>
              e.role == PlayerRole.player &&
              e.status == PlayerDataStatus.inGame,
        )
        .sorted((a, b) => getPlayerBid(b).compareTo(getPlayerBid(a)));

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (var index = 0; index < players.length; index++)
          _PlayerStake(
            index: index,
            playerData: players[index],
            stake: stakeData?.bids[players[index].meta.id.toString()],
          ),
      ],
    );
  }
}

class _PlayerStake extends StatelessWidget {
  const _PlayerStake({
    required this.playerData,
    required this.stake,
    required this.index,
  });
  final PlayerData playerData;
  final int? stake;
  final int index;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints.tight(GameLobbyStyles.players),
      child: Card(
        child: ListTile(
          title: Text([index + 1, playerData.meta.username].join('. ')),
          trailing: ScoreText(score: stake),
        ),
      ),
    );
  }
}
