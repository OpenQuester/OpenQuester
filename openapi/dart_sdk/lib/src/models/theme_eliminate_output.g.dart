// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'theme_eliminate_output.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ThemeEliminateOutput _$ThemeEliminateOutputFromJson(
  Map<String, dynamic> json,
) => _ThemeEliminateOutput(
  themeId: (json['themeId'] as num).toInt(),
  eliminatedBy: (json['eliminatedBy'] as num).toInt(),
  nextPlayerId: (json['nextPlayerId'] as num?)?.toInt(),
);

Map<String, dynamic> _$ThemeEliminateOutputToJson(
  _ThemeEliminateOutput instance,
) => <String, dynamic>{
  'themeId': instance.themeId,
  'eliminatedBy': instance.eliminatedBy,
  'nextPlayerId': instance.nextPlayerId,
};
