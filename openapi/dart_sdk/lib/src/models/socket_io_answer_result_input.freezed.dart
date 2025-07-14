// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'socket_io_answer_result_input.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SocketIOAnswerResultInput {

/// Score result of the answer; positive for correct, negative for incorrect, zero for skip
 int get scoreResult; SocketIOGameAnswerType get answerType;
/// Create a copy of SocketIOAnswerResultInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SocketIOAnswerResultInputCopyWith<SocketIOAnswerResultInput> get copyWith => _$SocketIOAnswerResultInputCopyWithImpl<SocketIOAnswerResultInput>(this as SocketIOAnswerResultInput, _$identity);

  /// Serializes this SocketIOAnswerResultInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SocketIOAnswerResultInput&&(identical(other.scoreResult, scoreResult) || other.scoreResult == scoreResult)&&(identical(other.answerType, answerType) || other.answerType == answerType));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,scoreResult,answerType);

@override
String toString() {
  return 'SocketIOAnswerResultInput(scoreResult: $scoreResult, answerType: $answerType)';
}


}

/// @nodoc
abstract mixin class $SocketIOAnswerResultInputCopyWith<$Res>  {
  factory $SocketIOAnswerResultInputCopyWith(SocketIOAnswerResultInput value, $Res Function(SocketIOAnswerResultInput) _then) = _$SocketIOAnswerResultInputCopyWithImpl;
@useResult
$Res call({
 int scoreResult, SocketIOGameAnswerType answerType
});




}
/// @nodoc
class _$SocketIOAnswerResultInputCopyWithImpl<$Res>
    implements $SocketIOAnswerResultInputCopyWith<$Res> {
  _$SocketIOAnswerResultInputCopyWithImpl(this._self, this._then);

  final SocketIOAnswerResultInput _self;
  final $Res Function(SocketIOAnswerResultInput) _then;

/// Create a copy of SocketIOAnswerResultInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? scoreResult = null,Object? answerType = null,}) {
  return _then(_self.copyWith(
scoreResult: null == scoreResult ? _self.scoreResult : scoreResult // ignore: cast_nullable_to_non_nullable
as int,answerType: null == answerType ? _self.answerType : answerType // ignore: cast_nullable_to_non_nullable
as SocketIOGameAnswerType,
  ));
}

}


/// Adds pattern-matching-related methods to [SocketIOAnswerResultInput].
extension SocketIOAnswerResultInputPatterns on SocketIOAnswerResultInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SocketIOAnswerResultInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SocketIOAnswerResultInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SocketIOAnswerResultInput value)  $default,){
final _that = this;
switch (_that) {
case _SocketIOAnswerResultInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SocketIOAnswerResultInput value)?  $default,){
final _that = this;
switch (_that) {
case _SocketIOAnswerResultInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int scoreResult,  SocketIOGameAnswerType answerType)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SocketIOAnswerResultInput() when $default != null:
return $default(_that.scoreResult,_that.answerType);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int scoreResult,  SocketIOGameAnswerType answerType)  $default,) {final _that = this;
switch (_that) {
case _SocketIOAnswerResultInput():
return $default(_that.scoreResult,_that.answerType);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int scoreResult,  SocketIOGameAnswerType answerType)?  $default,) {final _that = this;
switch (_that) {
case _SocketIOAnswerResultInput() when $default != null:
return $default(_that.scoreResult,_that.answerType);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SocketIOAnswerResultInput implements SocketIOAnswerResultInput {
  const _SocketIOAnswerResultInput({required this.scoreResult, required this.answerType});
  factory _SocketIOAnswerResultInput.fromJson(Map<String, dynamic> json) => _$SocketIOAnswerResultInputFromJson(json);

/// Score result of the answer; positive for correct, negative for incorrect, zero for skip
@override final  int scoreResult;
@override final  SocketIOGameAnswerType answerType;

/// Create a copy of SocketIOAnswerResultInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SocketIOAnswerResultInputCopyWith<_SocketIOAnswerResultInput> get copyWith => __$SocketIOAnswerResultInputCopyWithImpl<_SocketIOAnswerResultInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SocketIOAnswerResultInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SocketIOAnswerResultInput&&(identical(other.scoreResult, scoreResult) || other.scoreResult == scoreResult)&&(identical(other.answerType, answerType) || other.answerType == answerType));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,scoreResult,answerType);

@override
String toString() {
  return 'SocketIOAnswerResultInput(scoreResult: $scoreResult, answerType: $answerType)';
}


}

/// @nodoc
abstract mixin class _$SocketIOAnswerResultInputCopyWith<$Res> implements $SocketIOAnswerResultInputCopyWith<$Res> {
  factory _$SocketIOAnswerResultInputCopyWith(_SocketIOAnswerResultInput value, $Res Function(_SocketIOAnswerResultInput) _then) = __$SocketIOAnswerResultInputCopyWithImpl;
@override @useResult
$Res call({
 int scoreResult, SocketIOGameAnswerType answerType
});




}
/// @nodoc
class __$SocketIOAnswerResultInputCopyWithImpl<$Res>
    implements _$SocketIOAnswerResultInputCopyWith<$Res> {
  __$SocketIOAnswerResultInputCopyWithImpl(this._self, this._then);

  final _SocketIOAnswerResultInput _self;
  final $Res Function(_SocketIOAnswerResultInput) _then;

/// Create a copy of SocketIOAnswerResultInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? scoreResult = null,Object? answerType = null,}) {
  return _then(_SocketIOAnswerResultInput(
scoreResult: null == scoreResult ? _self.scoreResult : scoreResult // ignore: cast_nullable_to_non_nullable
as int,answerType: null == answerType ? _self.answerType : answerType // ignore: cast_nullable_to_non_nullable
as SocketIOGameAnswerType,
  ));
}


}

// dart format on
