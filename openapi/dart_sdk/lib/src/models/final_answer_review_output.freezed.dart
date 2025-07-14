// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_answer_review_output.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalAnswerReviewOutput {

/// ID of the reviewed answer
 String get answerId;/// ID of the player whose answer was reviewed
 int get playerId;/// Whether the answer was correct
 bool get isCorrect;/// Score change for the player
 int get scoreChange;
/// Create a copy of FinalAnswerReviewOutput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalAnswerReviewOutputCopyWith<FinalAnswerReviewOutput> get copyWith => _$FinalAnswerReviewOutputCopyWithImpl<FinalAnswerReviewOutput>(this as FinalAnswerReviewOutput, _$identity);

  /// Serializes this FinalAnswerReviewOutput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalAnswerReviewOutput&&(identical(other.answerId, answerId) || other.answerId == answerId)&&(identical(other.playerId, playerId) || other.playerId == playerId)&&(identical(other.isCorrect, isCorrect) || other.isCorrect == isCorrect)&&(identical(other.scoreChange, scoreChange) || other.scoreChange == scoreChange));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,answerId,playerId,isCorrect,scoreChange);

@override
String toString() {
  return 'FinalAnswerReviewOutput(answerId: $answerId, playerId: $playerId, isCorrect: $isCorrect, scoreChange: $scoreChange)';
}


}

/// @nodoc
abstract mixin class $FinalAnswerReviewOutputCopyWith<$Res>  {
  factory $FinalAnswerReviewOutputCopyWith(FinalAnswerReviewOutput value, $Res Function(FinalAnswerReviewOutput) _then) = _$FinalAnswerReviewOutputCopyWithImpl;
@useResult
$Res call({
 String answerId, int playerId, bool isCorrect, int scoreChange
});




}
/// @nodoc
class _$FinalAnswerReviewOutputCopyWithImpl<$Res>
    implements $FinalAnswerReviewOutputCopyWith<$Res> {
  _$FinalAnswerReviewOutputCopyWithImpl(this._self, this._then);

  final FinalAnswerReviewOutput _self;
  final $Res Function(FinalAnswerReviewOutput) _then;

/// Create a copy of FinalAnswerReviewOutput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? answerId = null,Object? playerId = null,Object? isCorrect = null,Object? scoreChange = null,}) {
  return _then(_self.copyWith(
answerId: null == answerId ? _self.answerId : answerId // ignore: cast_nullable_to_non_nullable
as String,playerId: null == playerId ? _self.playerId : playerId // ignore: cast_nullable_to_non_nullable
as int,isCorrect: null == isCorrect ? _self.isCorrect : isCorrect // ignore: cast_nullable_to_non_nullable
as bool,scoreChange: null == scoreChange ? _self.scoreChange : scoreChange // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [FinalAnswerReviewOutput].
extension FinalAnswerReviewOutputPatterns on FinalAnswerReviewOutput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FinalAnswerReviewOutput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FinalAnswerReviewOutput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FinalAnswerReviewOutput value)  $default,){
final _that = this;
switch (_that) {
case _FinalAnswerReviewOutput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FinalAnswerReviewOutput value)?  $default,){
final _that = this;
switch (_that) {
case _FinalAnswerReviewOutput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String answerId,  int playerId,  bool isCorrect,  int scoreChange)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FinalAnswerReviewOutput() when $default != null:
return $default(_that.answerId,_that.playerId,_that.isCorrect,_that.scoreChange);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String answerId,  int playerId,  bool isCorrect,  int scoreChange)  $default,) {final _that = this;
switch (_that) {
case _FinalAnswerReviewOutput():
return $default(_that.answerId,_that.playerId,_that.isCorrect,_that.scoreChange);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String answerId,  int playerId,  bool isCorrect,  int scoreChange)?  $default,) {final _that = this;
switch (_that) {
case _FinalAnswerReviewOutput() when $default != null:
return $default(_that.answerId,_that.playerId,_that.isCorrect,_that.scoreChange);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FinalAnswerReviewOutput implements FinalAnswerReviewOutput {
  const _FinalAnswerReviewOutput({required this.answerId, required this.playerId, required this.isCorrect, required this.scoreChange});
  factory _FinalAnswerReviewOutput.fromJson(Map<String, dynamic> json) => _$FinalAnswerReviewOutputFromJson(json);

/// ID of the reviewed answer
@override final  String answerId;
/// ID of the player whose answer was reviewed
@override final  int playerId;
/// Whether the answer was correct
@override final  bool isCorrect;
/// Score change for the player
@override final  int scoreChange;

/// Create a copy of FinalAnswerReviewOutput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalAnswerReviewOutputCopyWith<_FinalAnswerReviewOutput> get copyWith => __$FinalAnswerReviewOutputCopyWithImpl<_FinalAnswerReviewOutput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalAnswerReviewOutputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalAnswerReviewOutput&&(identical(other.answerId, answerId) || other.answerId == answerId)&&(identical(other.playerId, playerId) || other.playerId == playerId)&&(identical(other.isCorrect, isCorrect) || other.isCorrect == isCorrect)&&(identical(other.scoreChange, scoreChange) || other.scoreChange == scoreChange));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,answerId,playerId,isCorrect,scoreChange);

@override
String toString() {
  return 'FinalAnswerReviewOutput(answerId: $answerId, playerId: $playerId, isCorrect: $isCorrect, scoreChange: $scoreChange)';
}


}

/// @nodoc
abstract mixin class _$FinalAnswerReviewOutputCopyWith<$Res> implements $FinalAnswerReviewOutputCopyWith<$Res> {
  factory _$FinalAnswerReviewOutputCopyWith(_FinalAnswerReviewOutput value, $Res Function(_FinalAnswerReviewOutput) _then) = __$FinalAnswerReviewOutputCopyWithImpl;
@override @useResult
$Res call({
 String answerId, int playerId, bool isCorrect, int scoreChange
});




}
/// @nodoc
class __$FinalAnswerReviewOutputCopyWithImpl<$Res>
    implements _$FinalAnswerReviewOutputCopyWith<$Res> {
  __$FinalAnswerReviewOutputCopyWithImpl(this._self, this._then);

  final _FinalAnswerReviewOutput _self;
  final $Res Function(_FinalAnswerReviewOutput) _then;

/// Create a copy of FinalAnswerReviewOutput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? answerId = null,Object? playerId = null,Object? isCorrect = null,Object? scoreChange = null,}) {
  return _then(_FinalAnswerReviewOutput(
answerId: null == answerId ? _self.answerId : answerId // ignore: cast_nullable_to_non_nullable
as String,playerId: null == playerId ? _self.playerId : playerId // ignore: cast_nullable_to_non_nullable
as int,isCorrect: null == isCorrect ? _self.isCorrect : isCorrect // ignore: cast_nullable_to_non_nullable
as bool,scoreChange: null == scoreChange ? _self.scoreChange : scoreChange // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
