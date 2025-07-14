// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'socket_io_answer_result_event_payload.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SocketIOAnswerResultEventPayload {

 GameStateAnsweredPlayer? get answerResult; GameStateTimer? get timer; List<PackageQuestionFile?>? get answerFiles; QuestionAnswerText? get answerText;
/// Create a copy of SocketIOAnswerResultEventPayload
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SocketIOAnswerResultEventPayloadCopyWith<SocketIOAnswerResultEventPayload> get copyWith => _$SocketIOAnswerResultEventPayloadCopyWithImpl<SocketIOAnswerResultEventPayload>(this as SocketIOAnswerResultEventPayload, _$identity);

  /// Serializes this SocketIOAnswerResultEventPayload to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SocketIOAnswerResultEventPayload&&(identical(other.answerResult, answerResult) || other.answerResult == answerResult)&&(identical(other.timer, timer) || other.timer == timer)&&const DeepCollectionEquality().equals(other.answerFiles, answerFiles)&&(identical(other.answerText, answerText) || other.answerText == answerText));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,answerResult,timer,const DeepCollectionEquality().hash(answerFiles),answerText);

@override
String toString() {
  return 'SocketIOAnswerResultEventPayload(answerResult: $answerResult, timer: $timer, answerFiles: $answerFiles, answerText: $answerText)';
}


}

/// @nodoc
abstract mixin class $SocketIOAnswerResultEventPayloadCopyWith<$Res>  {
  factory $SocketIOAnswerResultEventPayloadCopyWith(SocketIOAnswerResultEventPayload value, $Res Function(SocketIOAnswerResultEventPayload) _then) = _$SocketIOAnswerResultEventPayloadCopyWithImpl;
@useResult
$Res call({
 GameStateAnsweredPlayer? answerResult, GameStateTimer? timer, List<PackageQuestionFile?>? answerFiles, QuestionAnswerText? answerText
});


$GameStateAnsweredPlayerCopyWith<$Res>? get answerResult;$GameStateTimerCopyWith<$Res>? get timer;

}
/// @nodoc
class _$SocketIOAnswerResultEventPayloadCopyWithImpl<$Res>
    implements $SocketIOAnswerResultEventPayloadCopyWith<$Res> {
  _$SocketIOAnswerResultEventPayloadCopyWithImpl(this._self, this._then);

  final SocketIOAnswerResultEventPayload _self;
  final $Res Function(SocketIOAnswerResultEventPayload) _then;

/// Create a copy of SocketIOAnswerResultEventPayload
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? answerResult = freezed,Object? timer = freezed,Object? answerFiles = freezed,Object? answerText = freezed,}) {
  return _then(_self.copyWith(
answerResult: freezed == answerResult ? _self.answerResult : answerResult // ignore: cast_nullable_to_non_nullable
as GameStateAnsweredPlayer?,timer: freezed == timer ? _self.timer : timer // ignore: cast_nullable_to_non_nullable
as GameStateTimer?,answerFiles: freezed == answerFiles ? _self.answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,
  ));
}
/// Create a copy of SocketIOAnswerResultEventPayload
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameStateAnsweredPlayerCopyWith<$Res>? get answerResult {
    if (_self.answerResult == null) {
    return null;
  }

  return $GameStateAnsweredPlayerCopyWith<$Res>(_self.answerResult!, (value) {
    return _then(_self.copyWith(answerResult: value));
  });
}/// Create a copy of SocketIOAnswerResultEventPayload
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameStateTimerCopyWith<$Res>? get timer {
    if (_self.timer == null) {
    return null;
  }

  return $GameStateTimerCopyWith<$Res>(_self.timer!, (value) {
    return _then(_self.copyWith(timer: value));
  });
}
}


/// Adds pattern-matching-related methods to [SocketIOAnswerResultEventPayload].
extension SocketIOAnswerResultEventPayloadPatterns on SocketIOAnswerResultEventPayload {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SocketIOAnswerResultEventPayload value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SocketIOAnswerResultEventPayload() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SocketIOAnswerResultEventPayload value)  $default,){
final _that = this;
switch (_that) {
case _SocketIOAnswerResultEventPayload():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SocketIOAnswerResultEventPayload value)?  $default,){
final _that = this;
switch (_that) {
case _SocketIOAnswerResultEventPayload() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( GameStateAnsweredPlayer? answerResult,  GameStateTimer? timer,  List<PackageQuestionFile?>? answerFiles,  QuestionAnswerText? answerText)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SocketIOAnswerResultEventPayload() when $default != null:
return $default(_that.answerResult,_that.timer,_that.answerFiles,_that.answerText);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( GameStateAnsweredPlayer? answerResult,  GameStateTimer? timer,  List<PackageQuestionFile?>? answerFiles,  QuestionAnswerText? answerText)  $default,) {final _that = this;
switch (_that) {
case _SocketIOAnswerResultEventPayload():
return $default(_that.answerResult,_that.timer,_that.answerFiles,_that.answerText);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( GameStateAnsweredPlayer? answerResult,  GameStateTimer? timer,  List<PackageQuestionFile?>? answerFiles,  QuestionAnswerText? answerText)?  $default,) {final _that = this;
switch (_that) {
case _SocketIOAnswerResultEventPayload() when $default != null:
return $default(_that.answerResult,_that.timer,_that.answerFiles,_that.answerText);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SocketIOAnswerResultEventPayload implements SocketIOAnswerResultEventPayload {
  const _SocketIOAnswerResultEventPayload({this.answerResult, this.timer, final  List<PackageQuestionFile?>? answerFiles, this.answerText}): _answerFiles = answerFiles;
  factory _SocketIOAnswerResultEventPayload.fromJson(Map<String, dynamic> json) => _$SocketIOAnswerResultEventPayloadFromJson(json);

@override final  GameStateAnsweredPlayer? answerResult;
@override final  GameStateTimer? timer;
 final  List<PackageQuestionFile?>? _answerFiles;
@override List<PackageQuestionFile?>? get answerFiles {
  final value = _answerFiles;
  if (value == null) return null;
  if (_answerFiles is EqualUnmodifiableListView) return _answerFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

@override final  QuestionAnswerText? answerText;

/// Create a copy of SocketIOAnswerResultEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SocketIOAnswerResultEventPayloadCopyWith<_SocketIOAnswerResultEventPayload> get copyWith => __$SocketIOAnswerResultEventPayloadCopyWithImpl<_SocketIOAnswerResultEventPayload>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SocketIOAnswerResultEventPayloadToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SocketIOAnswerResultEventPayload&&(identical(other.answerResult, answerResult) || other.answerResult == answerResult)&&(identical(other.timer, timer) || other.timer == timer)&&const DeepCollectionEquality().equals(other._answerFiles, _answerFiles)&&(identical(other.answerText, answerText) || other.answerText == answerText));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,answerResult,timer,const DeepCollectionEquality().hash(_answerFiles),answerText);

@override
String toString() {
  return 'SocketIOAnswerResultEventPayload(answerResult: $answerResult, timer: $timer, answerFiles: $answerFiles, answerText: $answerText)';
}


}

/// @nodoc
abstract mixin class _$SocketIOAnswerResultEventPayloadCopyWith<$Res> implements $SocketIOAnswerResultEventPayloadCopyWith<$Res> {
  factory _$SocketIOAnswerResultEventPayloadCopyWith(_SocketIOAnswerResultEventPayload value, $Res Function(_SocketIOAnswerResultEventPayload) _then) = __$SocketIOAnswerResultEventPayloadCopyWithImpl;
@override @useResult
$Res call({
 GameStateAnsweredPlayer? answerResult, GameStateTimer? timer, List<PackageQuestionFile?>? answerFiles, QuestionAnswerText? answerText
});


@override $GameStateAnsweredPlayerCopyWith<$Res>? get answerResult;@override $GameStateTimerCopyWith<$Res>? get timer;

}
/// @nodoc
class __$SocketIOAnswerResultEventPayloadCopyWithImpl<$Res>
    implements _$SocketIOAnswerResultEventPayloadCopyWith<$Res> {
  __$SocketIOAnswerResultEventPayloadCopyWithImpl(this._self, this._then);

  final _SocketIOAnswerResultEventPayload _self;
  final $Res Function(_SocketIOAnswerResultEventPayload) _then;

/// Create a copy of SocketIOAnswerResultEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? answerResult = freezed,Object? timer = freezed,Object? answerFiles = freezed,Object? answerText = freezed,}) {
  return _then(_SocketIOAnswerResultEventPayload(
answerResult: freezed == answerResult ? _self.answerResult : answerResult // ignore: cast_nullable_to_non_nullable
as GameStateAnsweredPlayer?,timer: freezed == timer ? _self.timer : timer // ignore: cast_nullable_to_non_nullable
as GameStateTimer?,answerFiles: freezed == answerFiles ? _self._answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,
  ));
}

/// Create a copy of SocketIOAnswerResultEventPayload
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameStateAnsweredPlayerCopyWith<$Res>? get answerResult {
    if (_self.answerResult == null) {
    return null;
  }

  return $GameStateAnsweredPlayerCopyWith<$Res>(_self.answerResult!, (value) {
    return _then(_self.copyWith(answerResult: value));
  });
}/// Create a copy of SocketIOAnswerResultEventPayload
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameStateTimerCopyWith<$Res>? get timer {
    if (_self.timer == null) {
    return null;
  }

  return $GameStateTimerCopyWith<$Res>(_self.timer!, (value) {
    return _then(_self.copyWith(timer: value));
  });
}
}

// dart format on
