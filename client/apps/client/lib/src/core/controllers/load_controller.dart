import 'package:openquester/common_imports.dart';

@singleton
class LoadController {
  Future<void> addUpload(List<UploadFile> files) async {}
}

class UploadFile {
  UploadFile({required this.uri, this.headers});
  final Uri uri;
  final Map<String, String>? headers;

  late final String filename = uri.pathSegments.last;
}
