import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';
import 'package:talker_flutter/talker_flutter.dart' hide TalkerLogger;
import 'package:toastification/toastification.dart';

/// Wraps MaterialApp
class AppWrapper extends StatelessWidget {
  const AppWrapper({
    required this.child,
    super.key,
  });
  final Widget child;

  @override
  Widget build(BuildContext context) {
    var child = this.child;

    child = TalkerWrapper(
      talker: getIt<TalkerLogger>().talker,
      child: child,
    );

    child = ToastificationWrapper(
      config: getIt<ToastController>().config(context),
      child: child,
    );

    return child;
  }
}

/// Wraps MaterialApp.builder.child
class AppBuilderWrapper extends StatelessWidget {
  const AppBuilderWrapper({
    required this.child,
    super.key,
  });
  final Widget child;

  @override
  Widget build(BuildContext _) {
    final context = AppRouter.I.navigatorKey.currentContext;
    if (context == null) return this.child;

    var child = this.child;

    // Show Talker dialog on long press in debug mode
    if (kDebugMode) {
      child = GestureDetector(
        onLongPress: () => getIt<TalkerLogger>().showTalkerDialog(context),
        child: child,
      );
    }

    return child;
  }
}
