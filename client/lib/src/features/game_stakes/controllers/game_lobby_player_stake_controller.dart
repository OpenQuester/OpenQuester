import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@singleton
class GameLobbyPlayerStakesController extends ChangeNotifier {
  bool isBidding = false;
  bool allPlayersBid = false;
  bool isFinalRound = false;
  int? bidderId;
  Map<int, int?>? bids;
  SocketIoStakeQuestionBidInput? bid = const SocketIoStakeQuestionBidInput(
    bidAmount: null,
    bidType: StakeBidType.normal,
  );

  void Function(SocketIoStakeQuestionBidInput bid)? _onPlayerBid;

  /// Show selection UI
  void startBidding({
    required int bidderId,
    required bool allPlayersBid,
    required Map<int, int?> bids,
    required void Function(SocketIoStakeQuestionBidInput bid) onPlayerBid,
    bool isFinalRound = false,
  }) {
    isBidding = true;
    this.allPlayersBid = allPlayersBid;
    _onPlayerBid = onPlayerBid;
    this.bids = bids;
    this.bidderId = bidderId;
    notifyListeners();
  }

  void changeBid(SocketIoStakeQuestionBidInput bid) {
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

  void confirmSelection(SocketIoStakeQuestionBidInput bid) {
    this.bid = bid;
    _onPlayerBid?.call(bid);
    notifyListeners();
  }

  void stopSelection() {
    bid = null;
    isBidding = false;
    isFinalRound = false;
    bidderId = null;
    _onPlayerBid = null;
    bids = null;
    allPlayersBid = false;
    notifyListeners();
  }

  int? getPlayerBid(int? playerId) => bids?[playerId];

  void clear() => stopSelection();
}
