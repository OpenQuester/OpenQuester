import 'package:crypto/crypto.dart' show md5;
import 'package:dio/dio.dart';
import 'package:fetch_client/fetch_client.dart';
import 'package:flutter/foundation.dart';
import 'package:openquester/openquester.dart';
import 'package:oq_editor/oq_editor.dart';
import 'package:universal_io/io.dart';

@injectable
class S3UploadController {
  Future<void> uploadFile({
    required Uri uploadLink,
    required String md5Hash,
    required Uint8List file,
  }) async {
    bool validateStatus(int? status) {
      if ({412}.contains(status)) return true;
      return status != null && status >= 200 && status < 300;
    }

    final client = kIsWeb
        ? FetchClient(
            mode: RequestMode.cors,
            cache: RequestCache.noCache,
            credentials: RequestCredentials.cors,
          )
        : Dio(
            BaseOptions(
              persistentConnection: true,
              validateStatus: validateStatus,
            ),
          );

    final fileHeaders = _fileHeaders(md5Hash);
    final headers = {
      ...fileHeaders,
      'Content-Length': file.lengthInBytes.toString(),
      'content-type': 'application/octet-stream',
    };

    if (client is FetchClient) {
      try {
        final response = await client.put(
          uploadLink,
          body: file,
          headers: headers,
        );

        throwIf(!validateStatus(response.statusCode), response.body);
      } catch (e, s) {
        logger.e(e, stackTrace: s);
      }
    } else if (client is Dio) {
      try {
        await client.put<void>(
          uploadLink.toString(),
          data: Stream.value(file),
          options: Options(headers: headers),
        );
      } on DioException catch (e) {
        // Ignore "Peer reset connection" error
        if (e.type != DioExceptionType.unknown) rethrow;
      }
    }
  }

  /// Upload file from MediaFileReference - reads bytes only when needed
  /// Optimized to avoid unnecessary memory usage when path is available
  Future<void> uploadFileFromReference({
    required Uri uploadLink,
    required String md5Hash,
    required MediaFileReference mediaFile,
  }) async {
    // Optimize: Use path directly if available (native platforms)
    // Only read into memory as last resort (web platform or no path)
    if (mediaFile.platformFile.path != null && !kIsWeb) {
      await _uploadFileFromPath(
        uploadLink: uploadLink,
        md5Hash: md5Hash,
        filePath: mediaFile.platformFile.path!,
        fileSize: mediaFile.platformFile.size,
      );
    } else {
      // Fallback: read bytes (web or no path available)
      final bytes = await MediaFileUtils.readMediaBytes(mediaFile);
      await uploadFile(
        uploadLink: uploadLink,
        md5Hash: md5Hash,
        file: bytes,
      );
    }
  }

  /// Upload file directly from path (native platforms only)
  /// Avoids loading entire file into memory
  Future<void> _uploadFileFromPath({
    required Uri uploadLink,
    required String md5Hash,
    required String filePath,
    required int? fileSize,
  }) async {
    bool validateStatus(int? status) {
      if ({412}.contains(status)) return true;
      return status != null && status >= 200 && status < 300;
    }

    // Only use Dio for file uploads from path (better streaming support)
    final client = Dio(
      BaseOptions(
        persistentConnection: true,
        validateStatus: validateStatus,
      ),
    );

    final fileHeaders = _fileHeaders(md5Hash);
    final file = File(filePath);
    final headers = {
      ...fileHeaders,
      'Content-Length': (fileSize ?? await file.length()).toString(),
      'content-type': 'application/octet-stream',
    };

    try {
      await client.put<void>(
        uploadLink.toString(),
        data: file.openRead(), // Stream the file instead of loading into memory
        options: Options(headers: headers),
      );
    } on DioException catch (e) {
      // Ignore "Peer reset connection" error
      if (e.type != DioExceptionType.unknown) rethrow;
    }
  }

  Future<String> getLinkAndUpload(Uint8List file) async {
    final md5Hash = md5.convert(file).toString();
    final getLinkResult = await Api.I.api.files.postV1FilesFilename(
      filename: md5Hash,
    );
    final uploadLink = Uri.parse(getLinkResult.url);

    await uploadFile(uploadLink: uploadLink, md5Hash: md5Hash, file: file);

    return md5Hash;
  }

  Map<String, String> _fileHeaders(String hash) {
    final encodedHash = hexToBase64(hash);
    return {'Content-MD5': encodedHash, 'if-none-match': '*'};
  }
}
