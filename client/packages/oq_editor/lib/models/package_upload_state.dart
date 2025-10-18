import 'package:freezed_annotation/freezed_annotation.dart';

part 'package_upload_state.freezed.dart';

/// Upload state for package editor
/// Tracks progress and completion status during package save
@freezed
sealed class PackageUploadState with _$PackageUploadState {
  /// Initial idle state - no upload in progress
  const factory PackageUploadState.idle() = _Idle;

  /// Upload in progress with current progress (0.0 to 1.0)
  const factory PackageUploadState.uploading({
    required double progress,
    String? message,
  }) = _Uploading;

  /// Upload completed successfully with package ID
  const factory PackageUploadState.completed({
    required int packageId,
  }) = _Completed;

  /// Upload failed with error
  const factory PackageUploadState.error({
    required Object error,
    StackTrace? stackTrace,
  }) = _Error;
}
