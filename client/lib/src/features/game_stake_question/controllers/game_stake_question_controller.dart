import 'package:flutter/material.dart';

class GameStakeQuestionController extends ChangeNotifier {
  int? bidderId;

  /// A map of player IDs to their bid amounts
  Map<int, int> bids = {};
}
