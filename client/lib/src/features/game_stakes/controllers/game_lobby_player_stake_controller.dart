import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@singleton
class GameLobbyPlayerStakesController extends ChangeNotifier {
  bool isBidding = false;
  int? bidderId;
  int bid = 0;

  void Function(int bid)? _onPlayerBid;
  Map<int, int> Function()? getPlayerBids;

  /// Show selection UI
  void startBidding({
    required int bidderId,
    required Map<int, int> Function()? getPlayerBids,
    required void Function(int bid) onPlayerBid,
  }) {
    isBidding = true;
    _onPlayerBid = onPlayerBid;
    this.getPlayerBids = getPlayerBids;
    this.bidderId = bidderId;

    notifyListeners();
  }

  void changeBid(int bid) {
    this.bid = bid;
    notifyListeners();
  }

  void confirmSelection(int bid) {
    isBidding = false;
    _onPlayerBid?.call(bid);
    notifyListeners();
  }

  void stopSelection() {
    isBidding = false;
    bidderId = null;
    _onPlayerBid = null;
    getPlayerBids = null;
    notifyListeners();
  }

  void clear() => stopSelection();
}
