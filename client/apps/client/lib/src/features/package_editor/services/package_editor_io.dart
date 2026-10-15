import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:openapi/openapi.dart';
import 'package:openquester/src/core/services/package_service.dart';
import 'package:openquester/src/features/package_editor/data/editor_media_file.dart';
import 'package:openquester/workers/models/worker_models.dart';
import 'package:openquester/workers/package_service.dart';

class PackageEditorIo {
  const PackageEditorIo(this._packageService);

  final PackageService _packageService;

  Future<ImportResult?> importPackage() => _packageService.pickAndImportFile();

  Future<void> exportPackage(
    OqPackage package,
    Map<String, EditorMediaFile> mediaFiles,
  ) async {
    final bytesByHash = <String, List<int>>{};
    for (final entry in mediaFiles.entries) {
      bytesByHash[entry.key] = await entry.value.readBytes();
    }

    final archive = await PackageWorkerService().encodeOqPackage(
      OqEncodeInput(
        package: package.toJson(),
        mediaFilesBytes: bytesByHash,
      ),
    );
    await FilePicker.saveFile(
      fileName: '${_safeFileName(package.title)}.oq',
      type: FileType.custom,
      allowedExtensions: const ['oq'],
      bytes: Uint8List.fromList(archive),
    );
  }

  String _safeFileName(String value) {
    final normalized = value.trim().replaceAll(
      RegExp('[^a-zA-Z0-9_-]+'),
      '_',
    );
    return normalized.isEmpty ? 'openquester-package' : normalized;
  }
}
