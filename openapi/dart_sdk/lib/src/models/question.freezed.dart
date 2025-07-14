// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'question.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Question {

/// Question ID
 int get id;/// Question order
 int get order;/// Question price/points
 int? get price;/// Question comment
 String? get questionComment;/// Whether question has been played
 bool get isPlayed;
/// Create a copy of Question
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$QuestionCopyWith<Question> get copyWith => _$QuestionCopyWithImpl<Question>(this as Question, _$identity);

  /// Serializes this Question to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Question&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.price, price) || other.price == price)&&(identical(other.questionComment, questionComment) || other.questionComment == questionComment)&&(identical(other.isPlayed, isPlayed) || other.isPlayed == isPlayed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,price,questionComment,isPlayed);

@override
String toString() {
  return 'Question(id: $id, order: $order, price: $price, questionComment: $questionComment, isPlayed: $isPlayed)';
}


}

/// @nodoc
abstract mixin class $QuestionCopyWith<$Res>  {
  factory $QuestionCopyWith(Question value, $Res Function(Question) _then) = _$QuestionCopyWithImpl;
@useResult
$Res call({
 int id, int order, int? price, String? questionComment, bool isPlayed
});




}
/// @nodoc
class _$QuestionCopyWithImpl<$Res>
    implements $QuestionCopyWith<$Res> {
  _$QuestionCopyWithImpl(this._self, this._then);

  final Question _self;
  final $Res Function(Question) _then;

/// Create a copy of Question
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? order = null,Object? price = freezed,Object? questionComment = freezed,Object? isPlayed = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as int,price: freezed == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as int?,questionComment: freezed == questionComment ? _self.questionComment : questionComment // ignore: cast_nullable_to_non_nullable
as String?,isPlayed: null == isPlayed ? _self.isPlayed : isPlayed // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// @nodoc
@JsonSerializable()

class _Question implements Question {
  const _Question({required this.id, required this.order, required this.price, required this.questionComment, required this.isPlayed});
  factory _Question.fromJson(Map<String, dynamic> json) => _$QuestionFromJson(json);

/// Question ID
@override final  int id;
/// Question order
@override final  int order;
/// Question price/points
@override final  int? price;
/// Question comment
@override final  String? questionComment;
/// Whether question has been played
@override final  bool isPlayed;

/// Create a copy of Question
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$QuestionCopyWith<_Question> get copyWith => __$QuestionCopyWithImpl<_Question>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$QuestionToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Question&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.price, price) || other.price == price)&&(identical(other.questionComment, questionComment) || other.questionComment == questionComment)&&(identical(other.isPlayed, isPlayed) || other.isPlayed == isPlayed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,price,questionComment,isPlayed);

@override
String toString() {
  return 'Question(id: $id, order: $order, price: $price, questionComment: $questionComment, isPlayed: $isPlayed)';
}


}

/// @nodoc
abstract mixin class _$QuestionCopyWith<$Res> implements $QuestionCopyWith<$Res> {
  factory _$QuestionCopyWith(_Question value, $Res Function(_Question) _then) = __$QuestionCopyWithImpl;
@override @useResult
$Res call({
 int id, int order, int? price, String? questionComment, bool isPlayed
});




}
/// @nodoc
class __$QuestionCopyWithImpl<$Res>
    implements _$QuestionCopyWith<$Res> {
  __$QuestionCopyWithImpl(this._self, this._then);

  final _Question _self;
  final $Res Function(_Question) _then;

/// Create a copy of Question
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? order = null,Object? price = freezed,Object? questionComment = freezed,Object? isPlayed = null,}) {
  return _then(_Question(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as int,price: freezed == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as int?,questionComment: freezed == questionComment ? _self.questionComment : questionComment // ignore: cast_nullable_to_non_nullable
as String?,isPlayed: null == isPlayed ? _self.isPlayed : isPlayed // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
