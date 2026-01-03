import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@singleton
class GameLobbyReviewController extends ChangeNotifier {
  bool isReviewing = false;
  String? currentReviewingAnswerId;
  List<FinalRoundAnswer> answers = [];
  Map<int, int> bids = {};
  void Function(String answerId, bool isCorrect)? onReview;

  /// Start the review phase
  void startReview({
    required List<FinalRoundAnswer> answers,
    required Map<int, int> bids,
    required void Function(String answerId, bool isCorrect) onReview,
  }) {
    isReviewing = true;
    currentReviewingAnswerId = null;
    this.answers = answers;
    this.bids = bids;
    this.onReview = onReview;
    notifyListeners();
  }

  /// Submit a review for an answer
  Future<void> reviewAnswer({
    required String answerId,
    required bool isCorrect,
  }) async {
    try {
      currentReviewingAnswerId = answerId;
      notifyListeners();

      onReview?.call(answerId, isCorrect);
    } catch (e) {
      logger.e(e);
      await getIt<ToastController>().show(
        LocaleKeys.something_went_wrong.tr(),
      );
    }
  }

  /// Clear review state
  void clear() {
    isReviewing = false;
    currentReviewingAnswerId = null;
    answers = [];
    bids = {};
    onReview = null;
    notifyListeners();
  }

  /// Update current reviewing answer ID
  void updateReviewingAnswerId(String? answerId) {
    currentReviewingAnswerId = answerId;
    notifyListeners();
  }
}
