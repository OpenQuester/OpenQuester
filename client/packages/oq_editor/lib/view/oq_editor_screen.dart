import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/view/screens/oq_editor_body.dart';
import 'package:watch_it/watch_it.dart';

class OqEditorScreen extends WatchingWidget {
  const OqEditorScreen({required this.controller, super.key});
  final OqEditorController controller;

  @override
  Widget build(BuildContext context) {
    callOnce(
      (context) {
        if (GetIt.I.isRegistered<OqEditorController>()) return;
        GetIt.I.registerSingleton<OqEditorController>(controller);
      },
      dispose: () =>
          GetIt.I.unregister<OqEditorController>(instance: controller),
    );
    return AutoRouter(
      navigatorKey: controller.navigatorKey,
      builder: (context, content) {
        return OqEditorBody(
          controller: controller,
          child: content,
        );
      },
    );
  }
}
