import 'package:freezed_annotation/freezed_annotation.dart';

part 'package_editor_validation.freezed.dart';

@freezed
sealed class PackageEditorValidationResult
    with _$PackageEditorValidationResult {
  const factory PackageEditorValidationResult({
    @Default(<String>[]) List<String> errors,
  }) = _PackageEditorValidationResult;

  const PackageEditorValidationResult._();

  bool get isValid => errors.isEmpty;
}
