import 'package:openquester/src/connection/files/file_service.dart';
import 'package:oq_compress/oq_compress.dart';
import 'package:path_provider/path_provider.dart';
import 'package:universal_io/io.dart';

class PackageCompressController {
  static Future<void> pickAndCompress() async {
    final fileResult = await FileService.pickFile();
    final file = fileResult?.files.firstOrNull;
    if (file == null) return;

    final encoder = OqFileEncoder();
    final tempFolder = await getTemporaryDirectory();
    final workDir = Directory(
      [
        tempFolder.path,
        'encode_${DateTime.now().millisecondsSinceEpoch}',
      ].join(Platform.pathSeparator),
    );
    await workDir.create();

    try {
      final archiveFile = File(
        [workDir.path, 'input.zip'].join(Platform.pathSeparator),
      );
      await archiveFile.create();
      await file.xFile.saveTo(archiveFile.path);

      final outputArchive = await encoder.encodePackage(archiveFile);

      if (outputArchive == null) return;

      if (!outputArchive.existsSync()) {
        throw Exception('outputArchive dont exist!');
      }

      final bytes = outputArchive.readAsBytesSync();
      await FilePicker.platform.saveFile(
        fileName: file.name.split('.').first,
        bytes: bytes,
        allowedExtensions: ['siq'],
        lockParentWindow: true,
        type: FileType.custom,
      );
    } finally {
      encoder.dispose();
      await workDir.delete(recursive: true);
    }
  }
}
