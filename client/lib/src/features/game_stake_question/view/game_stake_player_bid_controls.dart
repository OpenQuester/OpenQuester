import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:openquester/openquester.dart';

class PlayerBidControls extends WatchingWidget {
  const PlayerBidControls({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final stakeData = gameData?.gameState.stakeQuestionData;
    final bidderId = stakeData?.biddingOrder.tryByIndex(
      stakeData.currentBidderIndex,
    );
    final biddingPlayer = gameData?.players.getById(bidderId);

    Future<void> onCustom() async {
      final bidAmountText = await OneFieldDialog(
        keyboardType: TextInputType.number,
        initText: stakeData?.bids[bidderId.toString()]?.toString() ?? '',
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp('[0-9]'))],
        title: LocaleKeys.game_stake_question_question_bid.tr(),
      ).show(context);
      if (bidAmountText == null) return;

      final bidAmount = int.tryParse(bidAmountText);
      if (bidAmount == null) return;

      getIt<GameLobbyController>().submitQuestionBid(
        SocketIOStakeQuestionBidInput(
          bidAmount: bidAmount,
          bidType: StakeBidType.normal,
        ),
      );
    }

    return Card.outlined(
      child: Column(
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              const _BidBtn(
                SocketIOStakeQuestionBidInput(
                  bidAmount: null,
                  bidType: StakeBidType.pass,
                ),
              ),
              ...[100, 1000]
                  .where((e) => e <= (biddingPlayer?.score ?? 0))
                  .map(
                    (e) => _BidBtn(
                      SocketIOStakeQuestionBidInput(
                        bidAmount: e,
                        bidType: StakeBidType.normal,
                      ),
                    ),
                  ),
              _BidBtn(null, onCustom),
              const _BidBtn(
                SocketIOStakeQuestionBidInput(
                  bidAmount: null,
                  bidType: StakeBidType.allIn,
                ),
              ),
            ],
          ).paddingAll(16),
        ],
      ),
    );
  }
}

class _BidBtn extends StatelessWidget {
  const _BidBtn(this.input, [this.customButtonCallback]);
  final SocketIOStakeQuestionBidInput? input;
  final VoidCallback? customButtonCallback;

  @override
  Widget build(BuildContext context) {
    final title = input == null
        ? LocaleKeys.custom.tr()
        : switch (input!.bidType) {
            StakeBidType.allIn => LocaleKeys.game_stake_question_allIn.tr(),
            StakeBidType.pass => LocaleKeys.pass.tr(),
            StakeBidType.normal => null,
            StakeBidType.$unknown => null,
          };
    final bid = ScoreText.formatScore(input?.bidAmount).$1;

    return FilledButton.tonal(
      onPressed:
          customButtonCallback ??
          () => getIt<GameLobbyController>().submitQuestionBid(input!),
      style: ButtonStyle(
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(borderRadius: 8.circular),
        ),
      ),
      child: Text(title ?? bid),
    );
  }
}
