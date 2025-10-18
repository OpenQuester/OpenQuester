import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';
import 'package:oq_editor/oq_editor.dart';

@RoutePage()
class PackageEditorScreen extends StatelessWidget {
  const PackageEditorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return OqEditorScreen(
      controller: OqEditorController(
        translations: const AppOqEditorTranslations(),
      ),
    );
  }
}
