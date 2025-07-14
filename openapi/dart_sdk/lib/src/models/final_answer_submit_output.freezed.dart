// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_answer_submit_output.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalAnswerSubmitOutput {

/// ID of the player who submitted the answer
 int get playerId;/// The submitted answer text
 String get answerText;
/// Create a copy of FinalAnswerSubmitOutput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalAnswerSubmitOutputCopyWith<FinalAnswerSubmitOutput> get copyWith => _$FinalAnswerSubmitOutputCopyWithImpl<FinalAnswerSubmitOutput>(this as FinalAnswerSubmitOutput, _$identity);

  /// Serializes this FinalAnswerSubmitOutput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalAnswerSubmitOutput&&(identical(other.playerId, playerId) || other.playerId == playerId)&&(identical(other.answerText, answerText) || other.answerText == answerText));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,playerId,answerText);

@override
String toString() {
  return 'FinalAnswerSubmitOutput(playerId: $playerId, answerText: $answerText)';
}


}

/// @nodoc
abstract mixin class $FinalAnswerSubmitOutputCopyWith<$Res>  {
  factory $FinalAnswerSubmitOutputCopyWith(FinalAnswerSubmitOutput value, $Res Function(FinalAnswerSubmitOutput) _then) = _$FinalAnswerSubmitOutputCopyWithImpl;
@useResult
$Res call({
 int playerId, String answerText
});




}
/// @nodoc
class _$FinalAnswerSubmitOutputCopyWithImpl<$Res>
    implements $FinalAnswerSubmitOutputCopyWith<$Res> {
  _$FinalAnswerSubmitOutputCopyWithImpl(this._self, this._then);

  final FinalAnswerSubmitOutput _self;
  final $Res Function(FinalAnswerSubmitOutput) _then;

/// Create a copy of FinalAnswerSubmitOutput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? playerId = null,Object? answerText = null,}) {
  return _then(_self.copyWith(
playerId: null == playerId ? _self.playerId : playerId // ignore: cast_nullable_to_non_nullable
as int,answerText: null == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [FinalAnswerSubmitOutput].
extension FinalAnswerSubmitOutputPatterns on FinalAnswerSubmitOutput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FinalAnswerSubmitOutput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FinalAnswerSubmitOutput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FinalAnswerSubmitOutput value)  $default,){
final _that = this;
switch (_that) {
case _FinalAnswerSubmitOutput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FinalAnswerSubmitOutput value)?  $default,){
final _that = this;
switch (_that) {
case _FinalAnswerSubmitOutput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int playerId,  String answerText)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FinalAnswerSubmitOutput() when $default != null:
return $default(_that.playerId,_that.answerText);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int playerId,  String answerText)  $default,) {final _that = this;
switch (_that) {
case _FinalAnswerSubmitOutput():
return $default(_that.playerId,_that.answerText);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int playerId,  String answerText)?  $default,) {final _that = this;
switch (_that) {
case _FinalAnswerSubmitOutput() when $default != null:
return $default(_that.playerId,_that.answerText);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FinalAnswerSubmitOutput implements FinalAnswerSubmitOutput {
  const _FinalAnswerSubmitOutput({required this.playerId, required this.answerText});
  factory _FinalAnswerSubmitOutput.fromJson(Map<String, dynamic> json) => _$FinalAnswerSubmitOutputFromJson(json);

/// ID of the player who submitted the answer
@override final  int playerId;
/// The submitted answer text
@override final  String answerText;

/// Create a copy of FinalAnswerSubmitOutput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalAnswerSubmitOutputCopyWith<_FinalAnswerSubmitOutput> get copyWith => __$FinalAnswerSubmitOutputCopyWithImpl<_FinalAnswerSubmitOutput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalAnswerSubmitOutputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalAnswerSubmitOutput&&(identical(other.playerId, playerId) || other.playerId == playerId)&&(identical(other.answerText, answerText) || other.answerText == answerText));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,playerId,answerText);

@override
String toString() {
  return 'FinalAnswerSubmitOutput(playerId: $playerId, answerText: $answerText)';
}


}

/// @nodoc
abstract mixin class _$FinalAnswerSubmitOutputCopyWith<$Res> implements $FinalAnswerSubmitOutputCopyWith<$Res> {
  factory _$FinalAnswerSubmitOutputCopyWith(_FinalAnswerSubmitOutput value, $Res Function(_FinalAnswerSubmitOutput) _then) = __$FinalAnswerSubmitOutputCopyWithImpl;
@override @useResult
$Res call({
 int playerId, String answerText
});




}
/// @nodoc
class __$FinalAnswerSubmitOutputCopyWithImpl<$Res>
    implements _$FinalAnswerSubmitOutputCopyWith<$Res> {
  __$FinalAnswerSubmitOutputCopyWithImpl(this._self, this._then);

  final _FinalAnswerSubmitOutput _self;
  final $Res Function(_FinalAnswerSubmitOutput) _then;

/// Create a copy of FinalAnswerSubmitOutput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? playerId = null,Object? answerText = null,}) {
  return _then(_FinalAnswerSubmitOutput(
playerId: null == playerId ? _self.playerId : playerId // ignore: cast_nullable_to_non_nullable
as int,answerText: null == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
