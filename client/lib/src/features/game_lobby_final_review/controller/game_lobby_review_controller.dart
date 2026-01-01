import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@singleton
class GameLobbyReviewController extends ChangeNotifier {
  bool isReviewing = false;
  String? currentReviewingAnswerId;

  /// Start the review phase
  void startReview() {
    if (isReviewing) return;
    isReviewing = true;
    currentReviewingAnswerId = null;
    notifyListeners();
  }

  /// Submit a review for an answer
  Future<void> reviewAnswer({
    required String answerId,
    required bool isCorrect,
  }) async {
    final socket = getIt<GameLobbyController>().socket;
    if (socket == null) return;

    try {
      currentReviewingAnswerId = answerId;
      notifyListeners();

      socket.emit(
        SocketIoGameSendEvents.finalAnswerReview.json!,
        SocketIoFinalAnswerReviewInput(
          answerId: answerId,
          isCorrect: isCorrect,
        ).toJson(),
      );
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
    notifyListeners();
  }

  /// Update current reviewing answer ID
  void updateReviewingAnswerId(String? answerId) {
    currentReviewingAnswerId = answerId;
    notifyListeners();
  }
}
