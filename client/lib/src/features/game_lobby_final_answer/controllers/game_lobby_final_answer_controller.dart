import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@singleton
class GameLobbyFinalAnswerController extends ChangeNotifier {
  String? userAnswer;
  void Function(String answer)? _onSelected;

  /// Show selection UI
  /// [onSelected] - callback when a player is selected
  void startSelect({
    required String? initialAnswer,
    required void Function(String answer) onSelected,
  }) {
    userAnswer = initialAnswer;
    _onSelected = onSelected;

    notifyListeners();
  }

  void onChange(String answer) {
    userAnswer = answer;
    notifyListeners();
  }

  void confirm() {
    _onSelected?.call(userAnswer!);
    userAnswer = null;
    notifyListeners();
  }

  void stop() {
    userAnswer = null;
    _onSelected = null;
    notifyListeners();
  }

  void clear() => stop();
}
