// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
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


/// Adds pattern-matching-related methods to [FinalAnswerReviewInput].
extension FinalAnswerReviewInputPatterns on FinalAnswerReviewInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FinalAnswerReviewInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FinalAnswerReviewInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FinalAnswerReviewInput value)  $default,){
final _that = this;
switch (_that) {
case _FinalAnswerReviewInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FinalAnswerReviewInput value)?  $default,){
final _that = this;
switch (_that) {
case _FinalAnswerReviewInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String answerId,  bool isCorrect)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FinalAnswerReviewInput() when $default != null:
return $default(_that.answerId,_that.isCorrect);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String answerId,  bool isCorrect)  $default,) {final _that = this;
switch (_that) {
case _FinalAnswerReviewInput():
return $default(_that.answerId,_that.isCorrect);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String answerId,  bool isCorrect)?  $default,) {final _that = this;
switch (_that) {
case _FinalAnswerReviewInput() when $default != null:
return $default(_that.answerId,_that.isCorrect);case _:
  return null;

}
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
