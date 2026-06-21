import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@singleton
class TimeController extends ChangeNotifier {
  late DateTime current = DateTime.now();
  late Timer timer;

  @postConstruct
  void init() {
    timer = Timer.periodic(const Duration(seconds: 1), _tick);
  }

  void _tick(Timer timer) {
    current = DateTime.now();
    notifyListeners();
  }
}
