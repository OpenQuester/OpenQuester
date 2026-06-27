import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/domain/package_editor_operation_state.dart';
import 'package:oq_editor/models/media_file_reference.dart';

part 'package_editor_save_adapter.freezed.dart';

@freezed
sealed class PackageEditorSaveRequest with _$PackageEditorSaveRequest {
  const factory PackageEditorSaveRequest({
    required OqPackage package,
    required Map<String, MediaFileReference> mediaFilesByHash,
  }) = _PackageEditorSaveRequest;
}

@freezed
sealed class PackageEditorOperationEvent with _$PackageEditorOperationEvent {
  const PackageEditorOperationEvent._();

  const factory PackageEditorOperationEvent.running({
    required PackageEditorOperationPhase phase,
    double? progress,
    String? message,
  }) = PackageEditorOperationRunningEvent;

  const factory PackageEditorOperationEvent.completed({
    required OqPackage package,
    String? message,
  }) = PackageEditorOperationCompletedEvent;

  PackageEditorOperationPhase get phase {
    return map(
      running: (event) => event.phase,
      completed: (_) => PackageEditorOperationPhase.finalizing,
    );
  }

  double? get progress {
    return map(
      running: (event) => event.progress,
      completed: (_) => 1,
    );
  }

  @override
  String? get message {
    return map(
      running: (event) => event.message,
      completed: (event) => event.message,
    );
  }

  OqPackage? get savedPackage {
    return map(
      running: (_) => null,
      completed: (event) => event.package,
    );
  }
}

typedef OqPackageSaveAdapter =
    Stream<PackageEditorOperationEvent> Function(
      PackageEditorSaveRequest request,
    );
