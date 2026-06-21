import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@singleton
class GameLobbyFinalAnswerController extends ChangeNotifier {
  bool isAnswering = false;
  String? userAnswer;
  void Function(String answer)? _onSelected;

  /// Show selection UI
  /// [onSelected] - callback when a player is selected
  void startSelect({
    required String? initialAnswer,
    required void Function(String answer) onSelected,
  }) {
    isAnswering = true;
    userAnswer = initialAnswer;
    _onSelected = onSelected;

    notifyListeners();
  }

  void onChange(String answer) {
    userAnswer = answer;
    notifyListeners();
  }

  void confirm() {
    if (userAnswer == null) return;

    _onSelected?.call(userAnswer!);
    userAnswer = null;
    notifyListeners();
  }

  void stop() {
    isAnswering = false;
    userAnswer = null;
    _onSelected = null;
    notifyListeners();
  }

  void clear() => stop();
}
