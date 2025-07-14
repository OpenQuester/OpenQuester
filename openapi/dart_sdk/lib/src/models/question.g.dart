// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'question.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Question _$QuestionFromJson(Map<String, dynamic> json) => _Question(
  id: (json['id'] as num).toInt(),
  order: (json['order'] as num).toInt(),
  price: (json['price'] as num?)?.toInt(),
  questionComment: json['questionComment'] as String?,
  isPlayed: json['isPlayed'] as bool,
);

Map<String, dynamic> _$QuestionToJson(_Question instance) => <String, dynamic>{
  'id': instance.id,
  'order': instance.order,
  'price': instance.price,
  'questionComment': instance.questionComment,
  'isPlayed': instance.isPlayed,
};
