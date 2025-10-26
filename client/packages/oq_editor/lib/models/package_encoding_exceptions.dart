/// Exception thrown when user cancels the upload operation
class UploadCancelledException implements Exception {
  const UploadCancelledException([this.message = 'Upload cancelled by user']);

  final String message;

  @override
  String toString() => message;
}

/// Exception thrown when encoding is not supported
class EncodingNotSupportedException implements Exception {
  const EncodingNotSupportedException([
    this.message = 'Encoding not supported on this platform',
  ]);

  final String message;

  @override
  String toString() => message;
}
