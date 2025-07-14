// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
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

 List<PackageQuestionFile>? get answerFiles; QuestionAnswerText? get answerText;/// ID of the next player to take their turn, null if no next player (game finished)
 int? get nextTurnPlayerId;
/// Create a copy of QuestionFinishEventPayload
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$QuestionFinishEventPayloadCopyWith<QuestionFinishEventPayload> get copyWith => _$QuestionFinishEventPayloadCopyWithImpl<QuestionFinishEventPayload>(this as QuestionFinishEventPayload, _$identity);

  /// Serializes this QuestionFinishEventPayload to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is QuestionFinishEventPayload&&const DeepCollectionEquality().equals(other.answerFiles, answerFiles)&&(identical(other.answerText, answerText) || other.answerText == answerText)&&(identical(other.nextTurnPlayerId, nextTurnPlayerId) || other.nextTurnPlayerId == nextTurnPlayerId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(answerFiles),answerText,nextTurnPlayerId);

@override
String toString() {
  return 'QuestionFinishEventPayload(answerFiles: $answerFiles, answerText: $answerText, nextTurnPlayerId: $nextTurnPlayerId)';
}


}

/// @nodoc
abstract mixin class $QuestionFinishEventPayloadCopyWith<$Res>  {
  factory $QuestionFinishEventPayloadCopyWith(QuestionFinishEventPayload value, $Res Function(QuestionFinishEventPayload) _then) = _$QuestionFinishEventPayloadCopyWithImpl;
@useResult
$Res call({
 List<PackageQuestionFile>? answerFiles, QuestionAnswerText? answerText, int? nextTurnPlayerId
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
@pragma('vm:prefer-inline') @override $Res call({Object? answerFiles = freezed,Object? answerText = freezed,Object? nextTurnPlayerId = freezed,}) {
  return _then(_self.copyWith(
answerFiles: freezed == answerFiles ? _self.answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile>?,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,nextTurnPlayerId: freezed == nextTurnPlayerId ? _self.nextTurnPlayerId : nextTurnPlayerId // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [QuestionFinishEventPayload].
extension QuestionFinishEventPayloadPatterns on QuestionFinishEventPayload {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _QuestionFinishEventPayload value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _QuestionFinishEventPayload() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _QuestionFinishEventPayload value)  $default,){
final _that = this;
switch (_that) {
case _QuestionFinishEventPayload():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _QuestionFinishEventPayload value)?  $default,){
final _that = this;
switch (_that) {
case _QuestionFinishEventPayload() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<PackageQuestionFile>? answerFiles,  QuestionAnswerText? answerText,  int? nextTurnPlayerId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _QuestionFinishEventPayload() when $default != null:
return $default(_that.answerFiles,_that.answerText,_that.nextTurnPlayerId);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<PackageQuestionFile>? answerFiles,  QuestionAnswerText? answerText,  int? nextTurnPlayerId)  $default,) {final _that = this;
switch (_that) {
case _QuestionFinishEventPayload():
return $default(_that.answerFiles,_that.answerText,_that.nextTurnPlayerId);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<PackageQuestionFile>? answerFiles,  QuestionAnswerText? answerText,  int? nextTurnPlayerId)?  $default,) {final _that = this;
switch (_that) {
case _QuestionFinishEventPayload() when $default != null:
return $default(_that.answerFiles,_that.answerText,_that.nextTurnPlayerId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _QuestionFinishEventPayload implements QuestionFinishEventPayload {
  const _QuestionFinishEventPayload({required final  List<PackageQuestionFile>? answerFiles, required this.answerText, this.nextTurnPlayerId}): _answerFiles = answerFiles;
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
/// ID of the next player to take their turn, null if no next player (game finished)
@override final  int? nextTurnPlayerId;

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
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _QuestionFinishEventPayload&&const DeepCollectionEquality().equals(other._answerFiles, _answerFiles)&&(identical(other.answerText, answerText) || other.answerText == answerText)&&(identical(other.nextTurnPlayerId, nextTurnPlayerId) || other.nextTurnPlayerId == nextTurnPlayerId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_answerFiles),answerText,nextTurnPlayerId);

@override
String toString() {
  return 'QuestionFinishEventPayload(answerFiles: $answerFiles, answerText: $answerText, nextTurnPlayerId: $nextTurnPlayerId)';
}


}

/// @nodoc
abstract mixin class _$QuestionFinishEventPayloadCopyWith<$Res> implements $QuestionFinishEventPayloadCopyWith<$Res> {
  factory _$QuestionFinishEventPayloadCopyWith(_QuestionFinishEventPayload value, $Res Function(_QuestionFinishEventPayload) _then) = __$QuestionFinishEventPayloadCopyWithImpl;
@override @useResult
$Res call({
 List<PackageQuestionFile>? answerFiles, QuestionAnswerText? answerText, int? nextTurnPlayerId
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
@override @pragma('vm:prefer-inline') $Res call({Object? answerFiles = freezed,Object? answerText = freezed,Object? nextTurnPlayerId = freezed,}) {
  return _then(_QuestionFinishEventPayload(
answerFiles: freezed == answerFiles ? _self._answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile>?,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,nextTurnPlayerId: freezed == nextTurnPlayerId ? _self.nextTurnPlayerId : nextTurnPlayerId // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}

// dart format on
