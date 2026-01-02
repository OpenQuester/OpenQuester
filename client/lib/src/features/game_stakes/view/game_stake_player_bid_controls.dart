import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:openquester/openquester.dart';

class PlayerBidControls extends WatchingWidget {
  const PlayerBidControls({super.key, this.showPassButton = true});
  final bool showPassButton;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final stakeController = watchIt<GameLobbyPlayerStakesController>();
    final biddingPlayer = gameData?.players.getById(stakeController.bidderId);

    Future<void> onCustom() async {
      final bidAmountText = await OneFieldDialog(
        keyboardType: TextInputType.number,
        initText:
            stakeController.getPlayerBid(gameData?.me.meta.id)?.toString() ??
            '',
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp('[0-9]'))],
        title: LocaleKeys.game_stake_question_question_bid.tr(),
      ).show(context);
      if (bidAmountText == null) return;

      final bidAmount = int.tryParse(bidAmountText);
      if (bidAmount == null) return;

      stakeController.confirmSelection(
        SocketIoStakeQuestionBidInput(
          bidAmount: bidAmount,
          bidType: StakeBidType.normal,
        ),
      );
    }

    return Card.outlined(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (showPassButton)
                const _BidBtn(
                  SocketIoStakeQuestionBidInput(
                    bidAmount: null,
                    bidType: StakeBidType.pass,
                  ),
                ),
              ...[100, 1000]
                  .where(
                    (e) =>
                        (gameData?.me.isShowman ?? false) ||
                        e <= (biddingPlayer?.score ?? 0),
                  )
                  .map(
                    (e) => _BidBtn(
                      SocketIoStakeQuestionBidInput(
                        bidAmount: e,
                        bidType: StakeBidType.normal,
                      ),
                    ),
                  ),
              _BidBtn(null, onCustom),
              const _BidBtn(
                SocketIoStakeQuestionBidInput(
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
  final SocketIoStakeQuestionBidInput? input;
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
          () =>
              getIt<GameLobbyPlayerStakesController>().confirmSelection(input!),
      style: ButtonStyle(
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(borderRadius: 8.circular),
        ),
      ),
      child: Text(title ?? bid),
    );
  }
}
