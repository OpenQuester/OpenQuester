import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class GameStakeQuestionBody extends WatchingWidget {
  const GameStakeQuestionBody({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final stakeController = watchIt<GameLobbyPlayerStakesController>();
    final playerMakesABid = gameData?.me.meta.id == stakeController.bidderId;
    final questionMediaOnLeft = GameLobbyStyles.questionMediaOnLeft(context);
    final direction = questionMediaOnLeft ? Axis.horizontal : Axis.vertical;

    final showControls =
        !(gameData?.imSpectator ?? true) &&
        !(stakeController.isFinalRound && (gameData?.imShowman ?? false));

    final body = Column(
      spacing: 16,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const GameQuestionTimer(),
        Flex(
          spacing: 16,
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          direction: direction,
          children: [
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 550),
              child: const SingleChildScrollView(
                child: GameStakeQuestionBids(),
              ),
            ).center().expand(),
            if (showControls)
              AppAnimatedSwitcher(
                sizeTransitionAxis: direction,
                visible:
                    stakeController.allPlayersBid ||
                    playerMakesABid ||
                    (gameData?.imShowman ?? false),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: questionMediaOnLeft ? 250 : double.infinity,
                  ),
                  child: PlayerBidControls(
                    showPassButton: !stakeController.isFinalRound,
                  ).center(),
                ),
              ),
          ],
        ).expand(),
      ],
    );

    return SafeArea(child: body.paddingAll(16));
  }
}
