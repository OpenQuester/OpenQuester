import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@singleton
class GameLobbyPlayerStakesController extends ChangeNotifier {
  bool isBidding = false;
  int? bidderId;
  Map<int, int?>? bids;
  SocketIOStakeQuestionBidInput? bid = const SocketIOStakeQuestionBidInput(
    bidAmount: null,
    bidType: StakeBidType.normal,
  );

  void Function(SocketIOStakeQuestionBidInput bid)? _onPlayerBid;

  /// Show selection UI
  void startBidding({
    required int bidderId,
    required Map<int, int?> bids,
    required void Function(SocketIOStakeQuestionBidInput bid) onPlayerBid,
  }) {
    isBidding = true;
    _onPlayerBid = onPlayerBid;
    this.bids = bids;
    this.bidderId = bidderId;
    notifyListeners();
  }

  void changeBid(SocketIOStakeQuestionBidInput bid) {
    this.bid = bid;
    notifyListeners();
  }

  void changeBidder(int bidderId) {
    this.bidderId = bidderId;
    notifyListeners();
  }

  void changeBids(Map<int, int?>? bids) {
    this.bids = bids;
    notifyListeners();
  }

  void confirmSelection(SocketIOStakeQuestionBidInput bid) {
    this.bid = bid;
    _onPlayerBid?.call(bid);
    notifyListeners();
  }

  void stopSelection() {
    bid = null;
    isBidding = false;
    bidderId = null;
    _onPlayerBid = null;
    bids = null;
    notifyListeners();
  }

  int? getPlayerBid(int? playerId) => bids?[playerId];

  void clear() => stopSelection();
}
