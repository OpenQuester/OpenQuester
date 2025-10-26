import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';
import 'package:oq_editor/oq_editor.dart';

@RoutePage()
class PackageEditorScreen extends WatchingWidget {
  const PackageEditorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = createOnce(
      () => OqEditorController(
        translations: const AppOqEditorTranslations(),
        onSave: PackageEditorUploadController.onSave,
        onSaveProgressStream:
            getIt<PackageEditorUploadController>().progressStream,
        logger: logger,
      ),
      dispose: (e) => e.dispose(),
    );

    return OqEditorScreen(controller: controller);
  }
}
