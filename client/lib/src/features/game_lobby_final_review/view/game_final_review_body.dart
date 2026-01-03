import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

/// Main widget for final round reviewing phase
class GameFinalReviewBody extends WatchingWidget {
  const GameFinalReviewBody({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final isShowman = gameData?.me.isShowman ?? false;

    if (isShowman) {
      return const _ShowmanReviewView();
    } else {
      return const _PlayerWaitingView();
    }
  }
}

/// Showman view - shows cards with player answers to review
class _ShowmanReviewView extends WatchingWidget {
  const _ShowmanReviewView();

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final finalRoundData = gameData?.gameState.finalRoundData;
    final answers = finalRoundData?.answers ?? [];
    final bids = finalRoundData?.bids ?? {};
    final players = Map<int, PlayerData>.from(
      gameData?.players.asMap().map(
            (_, player) => MapEntry(player.meta.id, player),
          ) ??
          <int, PlayerData>{},
    );

    if (answers.isEmpty) {
      return Center(
        child: Text(
          LocaleKeys.game_final_round_waiting_for_review.tr(),
          style: context.textTheme.bodyLarge,
        ),
      );
    }

    return ListView.builder(
      padding: 16.all,
      itemCount: answers.length,
      itemBuilder: (context, index) {
        final answer = answers[index];
        final player = players[answer.playerId];
        final bidAmount = bids[answer.playerId.toString()] ?? 0;
        final isReviewed = answer.isCorrect != null;

        return _AnswerReviewCard(
          answer: answer,
          player: player,
          bidAmount: bidAmount,
          isReviewed: isReviewed,
        ).paddingBottom(12);
      },
    );
  }
}

/// Card showing a player's answer with review buttons
class _AnswerReviewCard extends WatchingWidget {
  const _AnswerReviewCard({
    required this.answer,
    required this.player,
    required this.bidAmount,
    required this.isReviewed,
  });

  final FinalRoundAnswer answer;
  final PlayerData? player;
  final int bidAmount;
  final bool isReviewed;

  @override
  Widget build(BuildContext context) {
    final currentReviewingAnswerId = watchPropertyValue(
      (GameLobbyReviewController e) => e.currentReviewingAnswerId,
    );
    final isCurrentlyReviewing = currentReviewingAnswerId == answer.id;
    final extraColors = ExtraColors.of(context);

    // Determine card color based on review state
    Color? cardColor;
    if (isReviewed) {
      final successColor = extraColors.success;
      cardColor = answer.isCorrect ?? false
          ? successColor.withValues(alpha: 0.1)
          : Colors.red.withValues(alpha: 0.1);
    }

    // Show auto-loss styling
    final isAutoLoss = answer.autoLoss ?? false;
    final answerText = isAutoLoss
        ? (answer.answer.isEmpty
              ? LocaleKeys.game_final_round_answer_empty.tr()
              : LocaleKeys.game_final_round_answer_timeout.tr())
        : answer.answer;

    return Card(
      color: cardColor ?? context.theme.colorScheme.surfaceContainer,
      elevation: isCurrentlyReviewing ? 8 : 2,
      child: Padding(
        padding: 16.all,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 12,
          children: [
            // Player info
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  spacing: 8,
                  children: [
                    if (player != null)
                      CircleAvatar(
                        radius: 16,
                        backgroundImage: player!.meta.avatar != null
                            ? NetworkImage(player!.meta.avatar!)
                            : null,
                        child: player!.meta.avatar == null
                            ? const Icon(Icons.person, size: 16)
                            : null,
                      ),
                    Text(
                      player?.meta.username ?? LocaleKeys.username.tr(),
                      style: context.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                Text(
                  LocaleKeys.game_final_round_player_bid.tr(
                    namedArgs: {'points': bidAmount.toString()},
                  ),
                  style: context.textTheme.bodyMedium?.copyWith(
                    color: context.theme.colorScheme.primary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),

            const Divider(),

            // Answer text
            Text(
              LocaleKeys.game_final_round_player_answer.tr(),
              style: context.textTheme.bodySmall?.copyWith(
                color: context.theme.colorScheme.onSurfaceVariant,
              ),
            ),
            Container(
              width: double.infinity,
              padding: 12.all,
              decoration: BoxDecoration(
                color: context.theme.colorScheme.surface,
                borderRadius: BorderRadius.circular(8),
                border: isAutoLoss
                    ? Border.all(
                        color: Colors.red.withValues(alpha: 0.5),
                        width: 1.5,
                      )
                    : null,
              ),
              child: Text(
                answerText,
                style: context.textTheme.bodyLarge?.copyWith(
                  fontStyle: isAutoLoss ? FontStyle.italic : null,
                  color: isAutoLoss
                      ? context.theme.colorScheme.error
                      : context.theme.colorScheme.onSurface,
                  decoration: isAutoLoss ? TextDecoration.lineThrough : null,
                ),
              ),
            ),

            // Review buttons
            if (!isReviewed && !isCurrentlyReviewing)
              Row(
                spacing: 12,
                children: [
                  Expanded(
                    child: FilledButton.tonal(
                      onPressed: () => _reviewAnswer(context, isCorrect: false),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.red.withValues(alpha: 0.2),
                        foregroundColor: Colors.red,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        spacing: 8,
                        children: [
                          const Icon(Icons.close, size: 20),
                          Text(LocaleKeys.game_final_round_mark_wrong.tr()),
                        ],
                      ),
                    ),
                  ),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => _reviewAnswer(context, isCorrect: true),
                      style: FilledButton.styleFrom(
                        backgroundColor: extraColors.success,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        spacing: 8,
                        children: [
                          const Icon(Icons.check, size: 20),
                          Text(LocaleKeys.game_final_round_mark_correct.tr()),
                        ],
                      ),
                    ),
                  ),
                ],
              ),

            // Show loading indicator while reviewing
            if (isCurrentlyReviewing)
              const Center(
                child: CircularProgressIndicator(),
              ).paddingAll(8),

            // Show review result
            if (isReviewed)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                spacing: 8,
                children: [
                  Icon(
                    answer.isCorrect ?? false
                        ? Icons.check_circle
                        : Icons.cancel,
                    color: answer.isCorrect ?? false
                        ? extraColors.success
                        : Colors.red,
                    size: 20,
                  ),
                  Text(
                    answer.isCorrect ?? false
                        ? LocaleKeys.game_final_round_mark_correct.tr()
                        : LocaleKeys.game_final_round_mark_wrong.tr(),
                    style: context.textTheme.bodyMedium?.copyWith(
                      color: answer.isCorrect ?? false
                          ? extraColors.success
                          : Colors.red,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _reviewAnswer(
    BuildContext context, {
    required bool isCorrect,
  }) async => getIt<GameLobbyReviewController>().reviewAnswer(
    answerId: answer.id,
    isCorrect: isCorrect,
  );
}

/// Player waiting view - shows list of players and their answers (read-only)
class _PlayerWaitingView extends WatchingWidget {
  const _PlayerWaitingView();

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final finalRoundData = gameData?.gameState.finalRoundData;
    final answers = finalRoundData?.answers ?? [];
    final bids = finalRoundData?.bids ?? {};
    final players = Map<int, PlayerData>.from(
      gameData?.players.asMap().map(
            (_, player) => MapEntry(player.meta.id, player),
          ) ??
          <int, PlayerData>{},
    );
    final extraColors = ExtraColors.of(context);

    return Column(
          children: [
            const Icon(Icons.rate_review, size: 54).paddingBottom(16),
            Text(
              LocaleKeys.game_final_round_showman_reviewing_answers.tr(),
              style: context.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ).paddingBottom(8),
            Text(
              LocaleKeys.game_final_round_waiting_for_review.tr(),
              style: context.textTheme.bodyMedium?.copyWith(
                color: context.theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ).paddingBottom(24),
            if (answers.isNotEmpty)
              ListView.builder(
                padding: 16.horizontal,
                itemCount: answers.length,
                itemBuilder: (context, index) {
                  final answer = answers[index];
                  final player = players[answer.playerId];
                  final bidAmount = bids[answer.playerId.toString()] ?? 0;
                  final isReviewed = answer.isCorrect != null;
                  final isAutoLoss = answer.autoLoss ?? false;
                  final successColor = extraColors.success;

                  return Card(
                    color: isReviewed
                        ? (answer.isCorrect ?? false
                              ? successColor.withValues(alpha: 0.1)
                              : Colors.red.withValues(alpha: 0.1))
                        : context.theme.colorScheme.surfaceContainer,
                    child: ListTile(
                      leading: player != null
                          ? CircleAvatar(
                              backgroundImage: player.meta.avatar != null
                                  ? NetworkImage(player.meta.avatar!)
                                  : null,
                              child: player.meta.avatar == null
                                  ? const Icon(Icons.person)
                                  : null,
                            )
                          : const CircleAvatar(child: Icon(Icons.person)),
                      title: Text(
                        player?.meta.username ?? LocaleKeys.username.tr(),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        spacing: 4,
                        children: [
                          Text(
                            LocaleKeys.game_final_round_player_bid.tr(
                              namedArgs: {'points': bidAmount.toString()},
                            ),
                            style: TextStyle(
                              color: context.theme.colorScheme.primary,
                            ),
                          ),
                          if (isAutoLoss)
                            Text(
                              answer.answer.isEmpty
                                  ? LocaleKeys.game_final_round_answer_empty
                                        .tr()
                                  : LocaleKeys.game_final_round_answer_timeout
                                        .tr(),
                              style: TextStyle(
                                color: context.theme.colorScheme.error,
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                        ],
                      ),
                      trailing: isReviewed
                          ? Icon(
                              answer.isCorrect ?? false
                                  ? Icons.check_circle
                                  : Icons.cancel,
                              color: answer.isCorrect ?? false
                                  ? extraColors.success
                                  : Colors.red,
                            )
                          : const Icon(Icons.hourglass_empty),
                    ),
                  ).paddingBottom(8);
                },
              ).expand(),
          ],
        )
        .paddingAll(16)
        .constrained(
          const BoxConstraints(maxWidth: UiModeUtils.maximumDialogWidth),
        );
  }
}
