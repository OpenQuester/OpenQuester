// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_answer_review_input.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalAnswerReviewInput {

/// ID of the answer being reviewed
 String get answerId;/// Whether the answer is correct
 bool get isCorrect;
/// Create a copy of FinalAnswerReviewInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalAnswerReviewInputCopyWith<FinalAnswerReviewInput> get copyWith => _$FinalAnswerReviewInputCopyWithImpl<FinalAnswerReviewInput>(this as FinalAnswerReviewInput, _$identity);

  /// Serializes this FinalAnswerReviewInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalAnswerReviewInput&&(identical(other.answerId, answerId) || other.answerId == answerId)&&(identical(other.isCorrect, isCorrect) || other.isCorrect == isCorrect));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,answerId,isCorrect);

@override
String toString() {
  return 'FinalAnswerReviewInput(answerId: $answerId, isCorrect: $isCorrect)';
}


}

/// @nodoc
abstract mixin class $FinalAnswerReviewInputCopyWith<$Res>  {
  factory $FinalAnswerReviewInputCopyWith(FinalAnswerReviewInput value, $Res Function(FinalAnswerReviewInput) _then) = _$FinalAnswerReviewInputCopyWithImpl;
@useResult
$Res call({
 String answerId, bool isCorrect
});




}
/// @nodoc
class _$FinalAnswerReviewInputCopyWithImpl<$Res>
    implements $FinalAnswerReviewInputCopyWith<$Res> {
  _$FinalAnswerReviewInputCopyWithImpl(this._self, this._then);

  final FinalAnswerReviewInput _self;
  final $Res Function(FinalAnswerReviewInput) _then;

/// Create a copy of FinalAnswerReviewInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? answerId = null,Object? isCorrect = null,}) {
  return _then(_self.copyWith(
answerId: null == answerId ? _self.answerId : answerId // ignore: cast_nullable_to_non_nullable
as String,isCorrect: null == isCorrect ? _self.isCorrect : isCorrect // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// @nodoc
@JsonSerializable()

class _FinalAnswerReviewInput implements FinalAnswerReviewInput {
  const _FinalAnswerReviewInput({required this.answerId, required this.isCorrect});
  factory _FinalAnswerReviewInput.fromJson(Map<String, dynamic> json) => _$FinalAnswerReviewInputFromJson(json);

/// ID of the answer being reviewed
@override final  String answerId;
/// Whether the answer is correct
@override final  bool isCorrect;

/// Create a copy of FinalAnswerReviewInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalAnswerReviewInputCopyWith<_FinalAnswerReviewInput> get copyWith => __$FinalAnswerReviewInputCopyWithImpl<_FinalAnswerReviewInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalAnswerReviewInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalAnswerReviewInput&&(identical(other.answerId, answerId) || other.answerId == answerId)&&(identical(other.isCorrect, isCorrect) || other.isCorrect == isCorrect));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,answerId,isCorrect);

@override
String toString() {
  return 'FinalAnswerReviewInput(answerId: $answerId, isCorrect: $isCorrect)';
}


}

/// @nodoc
abstract mixin class _$FinalAnswerReviewInputCopyWith<$Res> implements $FinalAnswerReviewInputCopyWith<$Res> {
  factory _$FinalAnswerReviewInputCopyWith(_FinalAnswerReviewInput value, $Res Function(_FinalAnswerReviewInput) _then) = __$FinalAnswerReviewInputCopyWithImpl;
@override @useResult
$Res call({
 String answerId, bool isCorrect
});




}
/// @nodoc
class __$FinalAnswerReviewInputCopyWithImpl<$Res>
    implements _$FinalAnswerReviewInputCopyWith<$Res> {
  __$FinalAnswerReviewInputCopyWithImpl(this._self, this._then);

  final _FinalAnswerReviewInput _self;
  final $Res Function(_FinalAnswerReviewInput) _then;

/// Create a copy of FinalAnswerReviewInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? answerId = null,Object? isCorrect = null,}) {
  return _then(_FinalAnswerReviewInput(
answerId: null == answerId ? _self.answerId : answerId // ignore: cast_nullable_to_non_nullable
as String,isCorrect: null == isCorrect ? _self.isCorrect : isCorrect // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
