import 'dart:typed_data';

import 'package:squadron/squadron.dart';

/// Output model for OQ package parsing
@OqParseResultMarshaler()
class OqParseResult {
  const OqParseResult({
    required this.package,
    required this.fileHashes,
    required this.filesBytesByHash,
    this.encodedFileHashes,
  });

  final Map<String, dynamic> package;
  final List<String> fileHashes;
  final Map<String, Uint8List> filesBytesByHash;
  final List<String>? encodedFileHashes;
}

/// Input model for OQ package encoding
@OqEncodeInputMarshaler()
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

/// Output model for SIQ file parsing
@SiqParseResultMarshaler()
class SiqParseResult {
  const SiqParseResult({
    required this.body,
    required this.files,
  });

  final Map<String, dynamic> body;
  final Map<String, Uint8List> files;
}

class OqParseResultMarshaler
    implements SquadronMarshaler<OqParseResult, List<dynamic>> {
  const OqParseResultMarshaler();

  @override
  List<dynamic> marshal(OqParseResult data, [MarshalingContext? context]) => [
    data.package,
    data.fileHashes,
    data.filesBytesByHash,
    data.encodedFileHashes,
  ];

  @override
  OqParseResult unmarshal(List<dynamic> data, [MarshalingContext? context]) {
    return OqParseResult(
      package: (data[0] as Map<dynamic, dynamic>).cast<String, dynamic>(),
      fileHashes: (data[1] as List<dynamic>).cast<String>(),
      filesBytesByHash: (data[2] as Map<dynamic, dynamic>).map(
        (key, value) => MapEntry(key as String, value as Uint8List),
      ),
      encodedFileHashes: data[3] != null
          ? (data[3] as List<dynamic>).cast<String>()
          : null,
    );
  }
}

class OqEncodeInputMarshaler
    implements SquadronMarshaler<OqEncodeInput, List<dynamic>> {
  const OqEncodeInputMarshaler();

  @override
  List<dynamic> marshal(OqEncodeInput data, [MarshalingContext? context]) => [
    data.package,
    data.mediaFilesBytes,
    data.encodedFileHashes?.toList(),
  ];

  @override
  OqEncodeInput unmarshal(List<dynamic> data, [MarshalingContext? context]) {
    return OqEncodeInput(
      package: (data[0] as Map<dynamic, dynamic>).cast<String, dynamic>(),
      mediaFilesBytes: (data[1] as Map<dynamic, dynamic>).map(
        (key, value) =>
            MapEntry(key as String, (value as List<dynamic>).cast<int>()),
      ),
      encodedFileHashes: data[2] != null
          ? (data[2] as List<dynamic>).cast<String>().toSet()
          : null,
    );
  }
}

class SiqParseResultMarshaler
    implements SquadronMarshaler<SiqParseResult, List<dynamic>> {
  const SiqParseResultMarshaler();

  @override
  List<dynamic> marshal(SiqParseResult data, [MarshalingContext? context]) => [
    data.body,
    data.files,
  ];

  @override
  SiqParseResult unmarshal(List<dynamic> data, [MarshalingContext? context]) {
    return SiqParseResult(
      body: (data[0] as Map<dynamic, dynamic>).cast<String, dynamic>(),
      files: (data[1] as Map<dynamic, dynamic>).map(
        (key, value) => MapEntry(
          key as String,
          value is List
              ? Uint8List.fromList(value.cast<int>())
              : throw Exception(
                  'Invalid type for file bytes: ${value.runtimeType}',
                ),
        ),
      ),
    );
  }
}
