// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'answer_review_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$AnswerReviewData {

/// ID of the player
 int get playerId;/// Unique ID of the answer
 String get answerId;/// Player's answer text
 String get answerText;/// Score change for the player
 int get scoreChange; FinalAnswerType get answerType;/// Whether the answer is correct (optional, present after review)
 bool get isCorrect;
/// Create a copy of AnswerReviewData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AnswerReviewDataCopyWith<AnswerReviewData> get copyWith => _$AnswerReviewDataCopyWithImpl<AnswerReviewData>(this as AnswerReviewData, _$identity);

  /// Serializes this AnswerReviewData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AnswerReviewData&&(identical(other.playerId, playerId) || other.playerId == playerId)&&(identical(other.answerId, answerId) || other.answerId == answerId)&&(identical(other.answerText, answerText) || other.answerText == answerText)&&(identical(other.scoreChange, scoreChange) || other.scoreChange == scoreChange)&&(identical(other.answerType, answerType) || other.answerType == answerType)&&(identical(other.isCorrect, isCorrect) || other.isCorrect == isCorrect));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,playerId,answerId,answerText,scoreChange,answerType,isCorrect);

@override
String toString() {
  return 'AnswerReviewData(playerId: $playerId, answerId: $answerId, answerText: $answerText, scoreChange: $scoreChange, answerType: $answerType, isCorrect: $isCorrect)';
}


}

/// @nodoc
abstract mixin class $AnswerReviewDataCopyWith<$Res>  {
  factory $AnswerReviewDataCopyWith(AnswerReviewData value, $Res Function(AnswerReviewData) _then) = _$AnswerReviewDataCopyWithImpl;
@useResult
$Res call({
 int playerId, String answerId, String answerText, int scoreChange, FinalAnswerType answerType, bool isCorrect
});




}
/// @nodoc
class _$AnswerReviewDataCopyWithImpl<$Res>
    implements $AnswerReviewDataCopyWith<$Res> {
  _$AnswerReviewDataCopyWithImpl(this._self, this._then);

  final AnswerReviewData _self;
  final $Res Function(AnswerReviewData) _then;

/// Create a copy of AnswerReviewData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? playerId = null,Object? answerId = null,Object? answerText = null,Object? scoreChange = null,Object? answerType = null,Object? isCorrect = null,}) {
  return _then(_self.copyWith(
playerId: null == playerId ? _self.playerId : playerId // ignore: cast_nullable_to_non_nullable
as int,answerId: null == answerId ? _self.answerId : answerId // ignore: cast_nullable_to_non_nullable
as String,answerText: null == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as String,scoreChange: null == scoreChange ? _self.scoreChange : scoreChange // ignore: cast_nullable_to_non_nullable
as int,answerType: null == answerType ? _self.answerType : answerType // ignore: cast_nullable_to_non_nullable
as FinalAnswerType,isCorrect: null == isCorrect ? _self.isCorrect : isCorrect // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// @nodoc
@JsonSerializable()

class _AnswerReviewData implements AnswerReviewData {
  const _AnswerReviewData({required this.playerId, required this.answerId, required this.answerText, required this.scoreChange, required this.answerType, required this.isCorrect});
  factory _AnswerReviewData.fromJson(Map<String, dynamic> json) => _$AnswerReviewDataFromJson(json);

/// ID of the player
@override final  int playerId;
/// Unique ID of the answer
@override final  String answerId;
/// Player's answer text
@override final  String answerText;
/// Score change for the player
@override final  int scoreChange;
@override final  FinalAnswerType answerType;
/// Whether the answer is correct (optional, present after review)
@override final  bool isCorrect;

/// Create a copy of AnswerReviewData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AnswerReviewDataCopyWith<_AnswerReviewData> get copyWith => __$AnswerReviewDataCopyWithImpl<_AnswerReviewData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AnswerReviewDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AnswerReviewData&&(identical(other.playerId, playerId) || other.playerId == playerId)&&(identical(other.answerId, answerId) || other.answerId == answerId)&&(identical(other.answerText, answerText) || other.answerText == answerText)&&(identical(other.scoreChange, scoreChange) || other.scoreChange == scoreChange)&&(identical(other.answerType, answerType) || other.answerType == answerType)&&(identical(other.isCorrect, isCorrect) || other.isCorrect == isCorrect));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,playerId,answerId,answerText,scoreChange,answerType,isCorrect);

@override
String toString() {
  return 'AnswerReviewData(playerId: $playerId, answerId: $answerId, answerText: $answerText, scoreChange: $scoreChange, answerType: $answerType, isCorrect: $isCorrect)';
}


}

/// @nodoc
abstract mixin class _$AnswerReviewDataCopyWith<$Res> implements $AnswerReviewDataCopyWith<$Res> {
  factory _$AnswerReviewDataCopyWith(_AnswerReviewData value, $Res Function(_AnswerReviewData) _then) = __$AnswerReviewDataCopyWithImpl;
@override @useResult
$Res call({
 int playerId, String answerId, String answerText, int scoreChange, FinalAnswerType answerType, bool isCorrect
});




}
/// @nodoc
class __$AnswerReviewDataCopyWithImpl<$Res>
    implements _$AnswerReviewDataCopyWith<$Res> {
  __$AnswerReviewDataCopyWithImpl(this._self, this._then);

  final _AnswerReviewData _self;
  final $Res Function(_AnswerReviewData) _then;

/// Create a copy of AnswerReviewData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? playerId = null,Object? answerId = null,Object? answerText = null,Object? scoreChange = null,Object? answerType = null,Object? isCorrect = null,}) {
  return _then(_AnswerReviewData(
playerId: null == playerId ? _self.playerId : playerId // ignore: cast_nullable_to_non_nullable
as int,answerId: null == answerId ? _self.answerId : answerId // ignore: cast_nullable_to_non_nullable
as String,answerText: null == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as String,scoreChange: null == scoreChange ? _self.scoreChange : scoreChange // ignore: cast_nullable_to_non_nullable
as int,answerType: null == answerType ? _self.answerType : answerType // ignore: cast_nullable_to_non_nullable
as FinalAnswerType,isCorrect: null == isCorrect ? _self.isCorrect : isCorrect // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
