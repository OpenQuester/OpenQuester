import 'dart:typed_data';

import 'package:squadron/squadron.dart';

/// Marshaler for Uint8List to List int conversion
const uint8ListMarshaler = Uint8ListMarshaler();

class Uint8ListMarshaler implements SquadronMarshaler<Uint8List, List<int>> {
  const Uint8ListMarshaler();

  @override
  List<int> marshal(Uint8List data, [MarshalingContext? context]) {
    return data.toList();
  }

  @override
  Uint8List unmarshal(List<int> data, [MarshalingContext? context]) {
    return Uint8List.fromList(data);
  }
}

/// Input model for OQ package parsing
class OqParseInput {
  const OqParseInput({
    required this.fileData,
  });

  @uint8ListMarshaler
  final Uint8List fileData;
}

/// Output model for OQ package parsing
class OqParseResult {
  const OqParseResult({
    required this.package,
    required this.fileHashes,
    required this.filesBytesByHash,
    this.encodedFileHashes,
  });

  final Map<String, dynamic> package;
  final List<String> fileHashes;
  final Map<String, List<int>> filesBytesByHash;
  final List<String>? encodedFileHashes;
}

/// Input model for OQ package encoding
class OqEncodeInput {
  const OqEncodeInput({
    required this.package,
    required this.mediaFilesBytes,
    this.encodedFileHashes,
  });

  final Map<String, dynamic> package;
  final Map<String, List<int>> mediaFilesBytes;
  final Set<String>? encodedFileHashes;
}

/// Output model for OQ package encoding
class OqEncodeResult {
  const OqEncodeResult({
    required this.archiveBytes,
  });

  final List<int> archiveBytes;
}

/// Input model for SIQ file parsing
class SiqParseInput {
  const SiqParseInput({
    required this.fileData,
  });

  @uint8ListMarshaler
  final Uint8List fileData;
}

/// Output model for SIQ file parsing
class SiqParseResult {
  const SiqParseResult({
    required this.body,
    required this.files,
  });

  final Map<String, dynamic> body;
  final Map<String, List<String>> files;
}
