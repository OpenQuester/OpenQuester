// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_round_question_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalRoundQuestionData {

/// ID of the question theme
 int get themeId;/// Name of the question theme
 String get themeName;/// Question state data
 Question get question;
/// Create a copy of FinalRoundQuestionData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalRoundQuestionDataCopyWith<FinalRoundQuestionData> get copyWith => _$FinalRoundQuestionDataCopyWithImpl<FinalRoundQuestionData>(this as FinalRoundQuestionData, _$identity);

  /// Serializes this FinalRoundQuestionData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalRoundQuestionData&&(identical(other.themeId, themeId) || other.themeId == themeId)&&(identical(other.themeName, themeName) || other.themeName == themeName)&&(identical(other.question, question) || other.question == question));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,themeId,themeName,question);

@override
String toString() {
  return 'FinalRoundQuestionData(themeId: $themeId, themeName: $themeName, question: $question)';
}


}

/// @nodoc
abstract mixin class $FinalRoundQuestionDataCopyWith<$Res>  {
  factory $FinalRoundQuestionDataCopyWith(FinalRoundQuestionData value, $Res Function(FinalRoundQuestionData) _then) = _$FinalRoundQuestionDataCopyWithImpl;
@useResult
$Res call({
 int themeId, String themeName, Question question
});


$QuestionCopyWith<$Res> get question;

}
/// @nodoc
class _$FinalRoundQuestionDataCopyWithImpl<$Res>
    implements $FinalRoundQuestionDataCopyWith<$Res> {
  _$FinalRoundQuestionDataCopyWithImpl(this._self, this._then);

  final FinalRoundQuestionData _self;
  final $Res Function(FinalRoundQuestionData) _then;

/// Create a copy of FinalRoundQuestionData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? themeId = null,Object? themeName = null,Object? question = null,}) {
  return _then(_self.copyWith(
themeId: null == themeId ? _self.themeId : themeId // ignore: cast_nullable_to_non_nullable
as int,themeName: null == themeName ? _self.themeName : themeName // ignore: cast_nullable_to_non_nullable
as String,question: null == question ? _self.question : question // ignore: cast_nullable_to_non_nullable
as Question,
  ));
}
/// Create a copy of FinalRoundQuestionData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$QuestionCopyWith<$Res> get question {
  
  return $QuestionCopyWith<$Res>(_self.question, (value) {
    return _then(_self.copyWith(question: value));
  });
}
}


/// @nodoc
@JsonSerializable()

class _FinalRoundQuestionData implements FinalRoundQuestionData {
  const _FinalRoundQuestionData({required this.themeId, required this.themeName, required this.question});
  factory _FinalRoundQuestionData.fromJson(Map<String, dynamic> json) => _$FinalRoundQuestionDataFromJson(json);

/// ID of the question theme
@override final  int themeId;
/// Name of the question theme
@override final  String themeName;
/// Question state data
@override final  Question question;

/// Create a copy of FinalRoundQuestionData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalRoundQuestionDataCopyWith<_FinalRoundQuestionData> get copyWith => __$FinalRoundQuestionDataCopyWithImpl<_FinalRoundQuestionData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalRoundQuestionDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalRoundQuestionData&&(identical(other.themeId, themeId) || other.themeId == themeId)&&(identical(other.themeName, themeName) || other.themeName == themeName)&&(identical(other.question, question) || other.question == question));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,themeId,themeName,question);

@override
String toString() {
  return 'FinalRoundQuestionData(themeId: $themeId, themeName: $themeName, question: $question)';
}


}

/// @nodoc
abstract mixin class _$FinalRoundQuestionDataCopyWith<$Res> implements $FinalRoundQuestionDataCopyWith<$Res> {
  factory _$FinalRoundQuestionDataCopyWith(_FinalRoundQuestionData value, $Res Function(_FinalRoundQuestionData) _then) = __$FinalRoundQuestionDataCopyWithImpl;
@override @useResult
$Res call({
 int themeId, String themeName, Question question
});


@override $QuestionCopyWith<$Res> get question;

}
/// @nodoc
class __$FinalRoundQuestionDataCopyWithImpl<$Res>
    implements _$FinalRoundQuestionDataCopyWith<$Res> {
  __$FinalRoundQuestionDataCopyWithImpl(this._self, this._then);

  final _FinalRoundQuestionData _self;
  final $Res Function(_FinalRoundQuestionData) _then;

/// Create a copy of FinalRoundQuestionData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? themeId = null,Object? themeName = null,Object? question = null,}) {
  return _then(_FinalRoundQuestionData(
themeId: null == themeId ? _self.themeId : themeId // ignore: cast_nullable_to_non_nullable
as int,themeName: null == themeName ? _self.themeName : themeName // ignore: cast_nullable_to_non_nullable
as String,question: null == question ? _self.question : question // ignore: cast_nullable_to_non_nullable
as Question,
  ));
}

/// Create a copy of FinalRoundQuestionData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$QuestionCopyWith<$Res> get question {
  
  return $QuestionCopyWith<$Res>(_self.question, (value) {
    return _then(_self.copyWith(question: value));
  });
}
}

// dart format on
