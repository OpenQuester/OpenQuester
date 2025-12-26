import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@Singleton(order: 0)
class AppStateController {
  final ValueNotifier<AppLifecycleState> appLifecycleState = ValueNotifier(
    AppLifecycleState.resumed,
  );
}
