import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@singleton
class GameLobbyThemePickerController extends ChangeNotifier {
  bool isPicking = false;
  int? selectedThemeId;
  void Function(int id)? _onSelected;

  /// Show selection UI
  /// [onSelected] - callback when a player is selected
  void startSelect({
    required void Function(int id) onSelected,
  }) {
    isPicking = true;
    selectedThemeId = null;
    _onSelected = onSelected;

    notifyListeners();
  }

  void pick(int id) {
    selectedThemeId = id;
    isPicking = true;
    notifyListeners();
  }

  void confirmSelection() {
    _onSelected?.call(selectedThemeId!);
    selectedThemeId = null;
    notifyListeners();
  }

  void stopSelection() {
    isPicking = false;
    selectedThemeId = null;
    _onSelected = null;
    notifyListeners();
  }

  void clear() => stopSelection();
}
