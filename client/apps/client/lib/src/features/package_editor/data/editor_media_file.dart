import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';

class EditorMediaFile {
  const EditorMediaFile({required this.platformFile, this.url});

  factory EditorMediaFile.fromBytes(String hash, Uint8List bytes) {
    return EditorMediaFile(
      platformFile: PlatformFile(name: hash, size: bytes.length, bytes: bytes),
    );
  }

  final PlatformFile platformFile;
  final String? url;

  Future<Uint8List> readBytes() async {
    final bytes = platformFile.bytes;
    if (bytes != null) return bytes;
    final stream = platformFile.readStream;
    if (stream == null) return Uint8List(0);
    final chunks = await stream.toList();
    return Uint8List.fromList(chunks.expand((chunk) => chunk).toList());
  }
}

enum PackageUploadPhase { idle, uploading, completed, error }

class PackageUploadState {
  const PackageUploadState._({
    required this.phase,
    this.progress = 0,
    this.message,
    this.packageId,
    this.error,
    this.stackTrace,
  });

  const PackageUploadState.idle() : this._(phase: PackageUploadPhase.idle);

  const PackageUploadState.uploading({
    required double progress,
    String? message,
  }) : this._(
         phase: PackageUploadPhase.uploading,
         progress: progress,
         message: message,
       );

  const PackageUploadState.completed({required int packageId})
    : this._(
        phase: PackageUploadPhase.completed,
        progress: 1,
        packageId: packageId,
      );

  const PackageUploadState.error({
    required Object error,
    StackTrace? stackTrace,
  }) : this._(
         phase: PackageUploadPhase.error,
         error: error,
         stackTrace: stackTrace,
       );

  final PackageUploadPhase phase;
  final double progress;
  final String? message;
  final int? packageId;
  final Object? error;
  final StackTrace? stackTrace;
}
