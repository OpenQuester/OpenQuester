// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'package_list_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PackageListItem _$PackageListItemFromJson(Map<String, dynamic> json) =>
    _PackageListItem(
      id: (json['id'] as num).toInt(),
      title: json['title'] as String,
      description: json['description'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      author: ShortUserInfo.fromJson(json['author'] as Map<String, dynamic>),
      ageRestriction: AgeRestriction.fromJson(json['ageRestriction'] as String),
      language: json['language'] as String?,
      tags: (json['tags'] as List<dynamic>?)
          ?.map((e) => PackageTag.fromJson(e as Map<String, dynamic>))
          .toList(),
      logo: json['logo'] == null
          ? null
          : PackageLogoFileItem.fromJson(json['logo'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$PackageListItemToJson(_PackageListItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'description': instance.description,
      'createdAt': instance.createdAt.toIso8601String(),
      'author': instance.author,
      'ageRestriction': instance.ageRestriction,
      'language': instance.language,
      'tags': instance.tags,
      'logo': instance.logo,
    };
