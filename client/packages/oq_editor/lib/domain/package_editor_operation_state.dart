import 'package:freezed_annotation/freezed_annotation.dart';

part 'package_editor_operation_state.freezed.dart';

enum PackageEditorOperationPhase {
  importPicking,
  importParsing,
  encoding,
  exporting,
  creatingPackage,
  uploadingMedia,
  finalizing,
}

@freezed
sealed class PackageEditorOperationState with _$PackageEditorOperationState {
  const PackageEditorOperationState._();

  const factory PackageEditorOperationState.idle() = PackageEditorOperationIdle;

  const factory PackageEditorOperationState.running({
    required PackageEditorOperationPhase phase,
    double? progress,
    String? message,
  }) = PackageEditorOperationRunning;

  const factory PackageEditorOperationState.completed({
    String? message,
  }) = PackageEditorOperationCompleted;

  const factory PackageEditorOperationState.failed({
    required Object error,
    StackTrace? stackTrace,
  }) = PackageEditorOperationFailed;

  bool get isRunning => this is PackageEditorOperationRunning;
}
