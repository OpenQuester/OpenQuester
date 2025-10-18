import 'package:openquester/openquester.dart';
import 'package:oq_editor/oq_editor.dart';

class AppOqEditorTranslations implements OqEditorTranslations {
  @override
  String get cancelButton => LocaleKeys.cancel.tr();

  @override
  String get closeButton => LocaleKeys.close.tr();

  @override
  String get editorTitle => LocaleKeys.package_editor.tr();

  @override
  String get saveButton => LocaleKeys.save.tr();
}
