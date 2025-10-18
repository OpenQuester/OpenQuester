import 'package:freezed_annotation/freezed_annotation.dart';

part 'ffprobe_output.freezed.dart';
part 'ffprobe_output.g.dart';

enum CodecType { video, audio, image }

enum SampleFormat { s16, s32, fltp, dlp }

@freezed
abstract class FfprobeOutput with _$FfprobeOutput {
  @JsonSerializable(fieldRename: FieldRename.snake)
  const factory FfprobeOutput({
    required List<StreamData> streams,
    required FormatData format,
  }) = _FfprobeOutput;

  factory FfprobeOutput.fromJson(Map<String, dynamic> json) =>
      _$FfprobeOutputFromJson(json);
}

@freezed
abstract class StreamData with _$StreamData {
  @JsonSerializable(fieldRename: FieldRename.snake)
  const factory StreamData({
    required int index,
    String? codecName,
    String? codecLongName,
    @JsonKey(unknownEnumValue: JsonKey.nullForUndefinedEnumValue)
    CodecType? codecType,
    String? profile,
    int? width,
    int? height,
    int? codedWidth,
    int? codedHeight,
    String? displayAspectRatio,
    String? pixFmt,
    int? level,
    @JsonKey(fromJson: _sampleFormatFromString, toJson: _sampleFormatToString)
    SampleFormat? sampleFmt,
    String? sampleRate,
    int? channels,
    String? channelLayout,
    String? nbFrames,
  }) = _StreamData;

  factory StreamData.fromJson(Map<String, dynamic> json) =>
      _$StreamDataFromJson(json);
}

@freezed
abstract class FormatData with _$FormatData {
  @JsonSerializable(fieldRename: FieldRename.snake)
  const factory FormatData({
    required String filename,
    required String formatName,
    required String formatLongName,
    required String size,
    String? bitRate,
    String? duration,
    String? startTime,
  }) = _FormatData;

  factory FormatData.fromJson(Map<String, dynamic> json) =>
      _$FormatDataFromJson(json);
}

// Converter functions for SampleFormat enum.
SampleFormat? _sampleFormatFromString(String? value) {
  if (value == null) return null;
  return SampleFormat.values.firstWhere(
    (e) => e.toString().split('.').last == value,
    orElse: () => SampleFormat.fltp,
  );
}

String? _sampleFormatToString(SampleFormat? value) =>
    value?.toString().split('.').last;
