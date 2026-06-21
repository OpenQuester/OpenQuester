import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:universal_io/io.dart';

export 'package:file_picker/file_picker.dart';

abstract class FileService {
  static Future<FilePickerResult?> pickFile({
    PickerSettings? filePickConf,
  }) async {
    final defaultConf =
        kIsWeb || kIsWasm || !(Platform.isAndroid || Platform.isIOS)
        ? PickerSettings.other()
        : PickerSettings.mobile();
    final conf = filePickConf ?? defaultConf;

    final result = await FilePicker.pickFiles(
      type: conf.type,
      allowedExtensions: conf.allowedExtensions,
      withReadStream: !(kIsWasm || kIsWeb || Platform.isMacOS),
    );

    final ext = result?.files.firstOrNull?.extension;
    if (ext != null && !conf.isExtensionSupported(ext)) {
      throw Exception('Extension $ext is not supported!');
    }

    if (result == null) return null;
    return result;
  }
}

class PickerSettings {
  const PickerSettings({required this.type, this.allowedExtensions});

  factory PickerSettings.mobile() => const PickerSettings(type: FileType.any);
  factory PickerSettings.other() => const PickerSettings(
    allowedExtensions: siqExtensions,
    type: FileType.custom,
  );
  final List<String>? allowedExtensions;
  final FileType type;

  static const List<String> siqExtensions = ['siq'];
  bool isExtensionSupported(String ext) =>
      allowedExtensions?.contains(ext) ?? true;
}
