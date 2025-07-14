// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'package_round.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PackageRound _$PackageRoundFromJson(Map<String, dynamic> json) =>
    _PackageRound(
      id: (json['id'] as num?)?.toInt(),
      order: (json['order'] as num).toInt(),
      name: json['name'] as String,
      description: json['description'] as String?,
      type: PackageRoundType.fromJson(json['type'] as String),
      themes: (json['themes'] as List<dynamic>)
          .map((e) => PackageTheme.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$PackageRoundToJson(_PackageRound instance) =>
    <String, dynamic>{
      'id': instance.id,
      'order': instance.order,
      'name': instance.name,
      'description': instance.description,
      'type': instance.type,
      'themes': instance.themes,
    };
