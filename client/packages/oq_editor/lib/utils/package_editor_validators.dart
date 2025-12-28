import 'package:get_it/get_it.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';

class PackageEditorValidators {
  static String? validateStringLength(
    String? value,
    int? minLength,
    int? maxLength,
  ) {
    final controller = GetIt.I<OqEditorController>();
    final translations = controller.translations;
    if (value == null || value.trim().isEmpty) {
      return translations.fieldRequired;
    }
    if (minLength != null && value.length < minLength) {
      return translations.minLengthError(minLength);
    }
    if (maxLength != null && value.length > maxLength) {
      return translations.maxLengthError(maxLength);
    }
    return null;
  }
}
