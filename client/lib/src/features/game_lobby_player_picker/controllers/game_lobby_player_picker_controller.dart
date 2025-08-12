import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@singleton
class GameLobbyPlayerPickerController extends ChangeNotifier {
  bool isPicking = false;
  int? selectedPlayerId;
  int? selectingPlayerId;
  QuestionTransferType type = QuestionTransferType.exceptCurrent;
  void Function(int selectedPlayerId)? _onPlayerSelected;

  /// Show selection UI
  /// [players] - list of players to select from
  /// [onPlayerSelected] - callback when a player is selected
  /// [type] - type of selection, can be [QuestionTransferType.exceptCurrent]
  /// to exclude current user
  /// [selectingPlayerId] - the ID of the player who selects
  void startSelect({
    required List<PlayerData> players,
    required int selectingPlayerId,
    required QuestionTransferType type,
    required void Function(int selectedPlayerId) onPlayerSelected,
  }) {
    isPicking = true;
    selectedPlayerId = null;
    _onPlayerSelected = onPlayerSelected;
    this.selectingPlayerId = selectingPlayerId;
    this.type = type;

    notifyListeners();
  }

  void pickPlayer(int playerId) {
    selectedPlayerId = playerId;
    isPicking = true;
    notifyListeners();
  }

  void confirmSelection() {
    isPicking = false;
    _onPlayerSelected?.call(selectedPlayerId!);
    notifyListeners();
  }

  void stopSelection() {
    isPicking = false;
    selectedPlayerId = null;
    selectingPlayerId = null;
    _onPlayerSelected = null;
    notifyListeners();
  }
}
