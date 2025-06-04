// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'package_question_file.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PackageQuestionFile _$PackageQuestionFileFromJson(Map<String, dynamic> json) =>
    _PackageQuestionFile(
      id: (json['id'] as num?)?.toInt(),
      order: (json['order'] as num).toInt(),
      file: FileItem.fromJson(json['file'] as Map<String, dynamic>),
      displayTime: (json['displayTime'] as num?)?.toInt(),
    );

Map<String, dynamic> _$PackageQuestionFileToJson(
  _PackageQuestionFile instance,
) => <String, dynamic>{
  'id': instance.id,
  'order': instance.order,
  'file': instance.file,
  'displayTime': instance.displayTime,
};
