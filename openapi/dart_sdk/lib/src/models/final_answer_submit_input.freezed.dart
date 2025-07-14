// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_answer_submit_input.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalAnswerSubmitInput {

/// Player's final answer text
 String get answerText;
/// Create a copy of FinalAnswerSubmitInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalAnswerSubmitInputCopyWith<FinalAnswerSubmitInput> get copyWith => _$FinalAnswerSubmitInputCopyWithImpl<FinalAnswerSubmitInput>(this as FinalAnswerSubmitInput, _$identity);

  /// Serializes this FinalAnswerSubmitInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalAnswerSubmitInput&&(identical(other.answerText, answerText) || other.answerText == answerText));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,answerText);

@override
String toString() {
  return 'FinalAnswerSubmitInput(answerText: $answerText)';
}


}

/// @nodoc
abstract mixin class $FinalAnswerSubmitInputCopyWith<$Res>  {
  factory $FinalAnswerSubmitInputCopyWith(FinalAnswerSubmitInput value, $Res Function(FinalAnswerSubmitInput) _then) = _$FinalAnswerSubmitInputCopyWithImpl;
@useResult
$Res call({
 String answerText
});




}
/// @nodoc
class _$FinalAnswerSubmitInputCopyWithImpl<$Res>
    implements $FinalAnswerSubmitInputCopyWith<$Res> {
  _$FinalAnswerSubmitInputCopyWithImpl(this._self, this._then);

  final FinalAnswerSubmitInput _self;
  final $Res Function(FinalAnswerSubmitInput) _then;

/// Create a copy of FinalAnswerSubmitInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? answerText = null,}) {
  return _then(_self.copyWith(
answerText: null == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [FinalAnswerSubmitInput].
extension FinalAnswerSubmitInputPatterns on FinalAnswerSubmitInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FinalAnswerSubmitInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FinalAnswerSubmitInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FinalAnswerSubmitInput value)  $default,){
final _that = this;
switch (_that) {
case _FinalAnswerSubmitInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FinalAnswerSubmitInput value)?  $default,){
final _that = this;
switch (_that) {
case _FinalAnswerSubmitInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String answerText)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FinalAnswerSubmitInput() when $default != null:
return $default(_that.answerText);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String answerText)  $default,) {final _that = this;
switch (_that) {
case _FinalAnswerSubmitInput():
return $default(_that.answerText);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String answerText)?  $default,) {final _that = this;
switch (_that) {
case _FinalAnswerSubmitInput() when $default != null:
return $default(_that.answerText);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FinalAnswerSubmitInput implements FinalAnswerSubmitInput {
  const _FinalAnswerSubmitInput({required this.answerText});
  factory _FinalAnswerSubmitInput.fromJson(Map<String, dynamic> json) => _$FinalAnswerSubmitInputFromJson(json);

/// Player's final answer text
@override final  String answerText;

/// Create a copy of FinalAnswerSubmitInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalAnswerSubmitInputCopyWith<_FinalAnswerSubmitInput> get copyWith => __$FinalAnswerSubmitInputCopyWithImpl<_FinalAnswerSubmitInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalAnswerSubmitInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalAnswerSubmitInput&&(identical(other.answerText, answerText) || other.answerText == answerText));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,answerText);

@override
String toString() {
  return 'FinalAnswerSubmitInput(answerText: $answerText)';
}


}

/// @nodoc
abstract mixin class _$FinalAnswerSubmitInputCopyWith<$Res> implements $FinalAnswerSubmitInputCopyWith<$Res> {
  factory _$FinalAnswerSubmitInputCopyWith(_FinalAnswerSubmitInput value, $Res Function(_FinalAnswerSubmitInput) _then) = __$FinalAnswerSubmitInputCopyWithImpl;
@override @useResult
$Res call({
 String answerText
});




}
/// @nodoc
class __$FinalAnswerSubmitInputCopyWithImpl<$Res>
    implements _$FinalAnswerSubmitInputCopyWith<$Res> {
  __$FinalAnswerSubmitInputCopyWithImpl(this._self, this._then);

  final _FinalAnswerSubmitInput _self;
  final $Res Function(_FinalAnswerSubmitInput) _then;

/// Create a copy of FinalAnswerSubmitInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? answerText = null,}) {
  return _then(_FinalAnswerSubmitInput(
answerText: null == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
