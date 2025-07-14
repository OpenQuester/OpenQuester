// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'question_finish_event_payload.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$QuestionFinishEventPayload {

 List<PackageQuestionFile>? get answerFiles; QuestionAnswerText? get answerText;
/// Create a copy of QuestionFinishEventPayload
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$QuestionFinishEventPayloadCopyWith<QuestionFinishEventPayload> get copyWith => _$QuestionFinishEventPayloadCopyWithImpl<QuestionFinishEventPayload>(this as QuestionFinishEventPayload, _$identity);

  /// Serializes this QuestionFinishEventPayload to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is QuestionFinishEventPayload&&const DeepCollectionEquality().equals(other.answerFiles, answerFiles)&&(identical(other.answerText, answerText) || other.answerText == answerText));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(answerFiles),answerText);

@override
String toString() {
  return 'QuestionFinishEventPayload(answerFiles: $answerFiles, answerText: $answerText)';
}


}

/// @nodoc
abstract mixin class $QuestionFinishEventPayloadCopyWith<$Res>  {
  factory $QuestionFinishEventPayloadCopyWith(QuestionFinishEventPayload value, $Res Function(QuestionFinishEventPayload) _then) = _$QuestionFinishEventPayloadCopyWithImpl;
@useResult
$Res call({
 List<PackageQuestionFile>? answerFiles, QuestionAnswerText? answerText
});




}
/// @nodoc
class _$QuestionFinishEventPayloadCopyWithImpl<$Res>
    implements $QuestionFinishEventPayloadCopyWith<$Res> {
  _$QuestionFinishEventPayloadCopyWithImpl(this._self, this._then);

  final QuestionFinishEventPayload _self;
  final $Res Function(QuestionFinishEventPayload) _then;

/// Create a copy of QuestionFinishEventPayload
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? answerFiles = freezed,Object? answerText = freezed,}) {
  return _then(_self.copyWith(
answerFiles: freezed == answerFiles ? _self.answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile>?,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,
  ));
}

}


/// @nodoc
@JsonSerializable()

class _QuestionFinishEventPayload implements QuestionFinishEventPayload {
  const _QuestionFinishEventPayload({required final  List<PackageQuestionFile>? answerFiles, required this.answerText}): _answerFiles = answerFiles;
  factory _QuestionFinishEventPayload.fromJson(Map<String, dynamic> json) => _$QuestionFinishEventPayloadFromJson(json);

 final  List<PackageQuestionFile>? _answerFiles;
@override List<PackageQuestionFile>? get answerFiles {
  final value = _answerFiles;
  if (value == null) return null;
  if (_answerFiles is EqualUnmodifiableListView) return _answerFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

@override final  QuestionAnswerText? answerText;

/// Create a copy of QuestionFinishEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$QuestionFinishEventPayloadCopyWith<_QuestionFinishEventPayload> get copyWith => __$QuestionFinishEventPayloadCopyWithImpl<_QuestionFinishEventPayload>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$QuestionFinishEventPayloadToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _QuestionFinishEventPayload&&const DeepCollectionEquality().equals(other._answerFiles, _answerFiles)&&(identical(other.answerText, answerText) || other.answerText == answerText));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_answerFiles),answerText);

@override
String toString() {
  return 'QuestionFinishEventPayload(answerFiles: $answerFiles, answerText: $answerText)';
}


}

/// @nodoc
abstract mixin class _$QuestionFinishEventPayloadCopyWith<$Res> implements $QuestionFinishEventPayloadCopyWith<$Res> {
  factory _$QuestionFinishEventPayloadCopyWith(_QuestionFinishEventPayload value, $Res Function(_QuestionFinishEventPayload) _then) = __$QuestionFinishEventPayloadCopyWithImpl;
@override @useResult
$Res call({
 List<PackageQuestionFile>? answerFiles, QuestionAnswerText? answerText
});




}
/// @nodoc
class __$QuestionFinishEventPayloadCopyWithImpl<$Res>
    implements _$QuestionFinishEventPayloadCopyWith<$Res> {
  __$QuestionFinishEventPayloadCopyWithImpl(this._self, this._then);

  final _QuestionFinishEventPayload _self;
  final $Res Function(_QuestionFinishEventPayload) _then;

/// Create a copy of QuestionFinishEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? answerFiles = freezed,Object? answerText = freezed,}) {
  return _then(_QuestionFinishEventPayload(
answerFiles: freezed == answerFiles ? _self._answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile>?,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,
  ));
}


}

// dart format on
