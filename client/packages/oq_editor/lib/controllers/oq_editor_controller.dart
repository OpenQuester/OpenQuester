import 'package:flutter/foundation.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_editor/utils/extensions.dart';

class OqEditorController {
  OqEditorController({
    required this.translations,
    OqPackage? initialPackage,
  }) {
    package.value = initialPackage;
  }

  /// Translation provider injected from parent app
  final OqEditorTranslations translations;

  final ValueNotifier<OqPackage?> package = ValueNotifier<OqPackage?>(
    OqPackageX.empty,
  );
}
