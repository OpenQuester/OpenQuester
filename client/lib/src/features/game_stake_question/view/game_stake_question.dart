import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class GameStakeQuestionBody extends WatchingWidget {
  const GameStakeQuestionBody({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final stakeData = gameData?.gameState.stakeQuestionData;
    final currentBidderIndex = stakeData?.currentBidderIndex;
    final playerMakesABid =
        getIt<GameLobbyController>().myId ==
        stakeData?.biddingOrder.tryByIndex(currentBidderIndex);
    final questionMediaOnLeft = GameLobbyStyles.questionMediaOnLeft(context);

    final direction = questionMediaOnLeft ? Axis.horizontal : Axis.vertical;
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
            AppAnimatedSwitcher(
              sizeTransitionAxis: direction,
              visible:
                  playerMakesABid || gameData?.me.role == PlayerRole.showman,
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: questionMediaOnLeft ? 250 : double.infinity,
                ),
                child: const PlayerBidControls().center(),
              ),
            ),
          ],
        ).expand(),
      ],
    );

    return SafeArea(child: body.paddingAll(16));
  }
}

class PlayerBidControls extends WatchingWidget {
  const PlayerBidControls({super.key});

  @override
  Widget build(BuildContext context) {
    return Card.outlined(
      child: const Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          _BidBtn(
            SocketIOStakeQuestionBidInput(
              bidAmount: null,
              bidType: StakeBidType.pass,
            ),
          ),
          _BidBtn(
            SocketIOStakeQuestionBidInput(
              bidAmount: 100,
              bidType: StakeBidType.normal,
            ),
          ),
          _BidBtn(
            SocketIOStakeQuestionBidInput(
              bidAmount: 200,
              bidType: StakeBidType.normal,
            ),
          ),
          _BidBtn(
            SocketIOStakeQuestionBidInput(
              bidAmount: 1000,
              bidType: StakeBidType.normal,
            ),
          ),
          _BidBtn(
            SocketIOStakeQuestionBidInput(
              bidAmount: null,
              bidType: StakeBidType.allIn,
            ),
          ),
        ],
      ).paddingAll(16),
    );
  }
}

class _BidBtn extends StatelessWidget {
  const _BidBtn(this.input);
  final SocketIOStakeQuestionBidInput input;

  @override
  Widget build(BuildContext context) {
    final title = switch (input.bidType) {
      StakeBidType.allIn => LocaleKeys.game_stake_question_allIn.tr(),
      StakeBidType.pass => LocaleKeys.pass.tr(),
      StakeBidType.normal => null,
      StakeBidType.$unknown => null,
    };
    final bid = ScoreText.formatScore(input.bidAmount).$1;

    return FilledButton.tonal(
      onPressed: () => getIt<GameLobbyController>().submitQuestionBid(input),
      style: ButtonStyle(
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(borderRadius: 8.circular),
        ),
      ),
      child: Text(title ?? bid),
    );
  }
}
