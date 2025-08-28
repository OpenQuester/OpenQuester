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

    final body = Flex(
      spacing: 16,
      mainAxisAlignment: MainAxisAlignment.center,
      direction: questionMediaOnLeft ? Axis.horizontal : Axis.vertical,
      children: [
        const SingleChildScrollView(
          child: GameStakeQuestionBids(),
        ).expand(),
        AppAnimatedSwitcher(
          visible: playerMakesABid,
          disableSizeTransition: true,
          child: const PlayerBidControls().paddingAll(16),
        ),
      ],
    );

    return body;
  }
}

class PlayerBidControls extends WatchingWidget {
  const PlayerBidControls({super.key});

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints.tight(const Size.square(250)),
      child: const Card.outlined(
        child: Wrap(
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
        ),
      ),
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

    return Card(
      child: ListTile(
        title: title == null ? ScoreText(score: input.bidAmount) : Text(title),
        subtitle: title != null ? ScoreText(score: input.bidAmount) : null,
        onTap: () => getIt<GameLobbyController>().submitQuestionBid(input),
      ),
    );
  }
}
