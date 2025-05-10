import 'package:file_saver/file_saver.dart';
import 'package:openquester/src/connection/files/file_service.dart';
import 'package:path_provider/path_provider.dart';
import 'package:siq_compress/siq_compress.dart';
import 'package:universal_io/io.dart';

class PackageCompressController {
  static Future<void> pickAndCompress() async {
    final fileResult = await FileService.pickFile();
    final file = fileResult?.files.firstOrNull;
    if (file == null) return;

    final encoder = SiqFileEncoder();
    final tempFolder = await getTemporaryDirectory();
    final workDir = Directory(
      [
        tempFolder.path,
        'encode_${DateTime.now().millisecondsSinceEpoch}',
      ].join(Platform.pathSeparator),
    );
    await workDir.create();

    try {
      final archiveFile =
          File([workDir.path, 'input.zip'].join(Platform.pathSeparator));
      await archiveFile.create();
      await file.xFile.saveTo(archiveFile.path);

      final outputArchive = await encoder.encodePackage(archiveFile);

      if (outputArchive == null) return;
      if (!outputArchive.existsSync()) {
        throw Exception('outputArchive dont exist!');
      }

      final bytes = outputArchive.readAsBytesSync();
      final filePath = await FileSaver.instance.saveAs(
        name: file.name.split('.').first,
        bytes: bytes,
        ext: '.siq',
        mimeType: MimeType.zip,
      );
      if (filePath == null) {
        // cancelled prompt
        return;
      }
      // TODO FileSaver.instance.saveAs() as of 0.2.13 on Windows
      // only prompts the user for the desired file location, but does not write
      // the file passed in.
      if (Platform.isWindows) {
        final file = File(filePath);
        await file.writeAsBytes(bytes);
      }
    } finally {
      encoder.dispose();
      await workDir.delete(recursive: true);
    }
  }
}
