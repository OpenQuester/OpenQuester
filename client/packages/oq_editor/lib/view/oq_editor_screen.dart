import 'package:flutter/material.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:watch_it/watch_it.dart';

class OqEditorScreen extends WatchingWidget {
  const OqEditorScreen({required this.controller, super.key});
  final OqEditorController controller;

  @override
  Widget build(BuildContext context) {
    callOnce(
      (context) => GetIt.I.registerSingleton<OqEditorController>(controller),
      dispose: () =>
          GetIt.I.unregister<OqEditorController>(instance: controller),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(controller.translations.editorTitle),
      ),
      body: const Center(
        child: Text('Oq Editor Screen'),
      ),
    );
  }
}
