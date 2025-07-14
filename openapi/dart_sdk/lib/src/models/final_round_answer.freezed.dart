// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_round_answer.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalRoundAnswer {

/// Unique ID of the answer
 String get id;/// ID of the player submitting the answer
 int get playerId;/// The player's answer text
 String get answer;/// Whether the answer is correct (null if not yet reviewed)
 bool? get isCorrect;/// Whether this is an automatic loss
 bool? get autoLoss;/// When the answer was submitted
 DateTime get submittedAt;/// When the answer was reviewed
 DateTime? get reviewedAt;
/// Create a copy of FinalRoundAnswer
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalRoundAnswerCopyWith<FinalRoundAnswer> get copyWith => _$FinalRoundAnswerCopyWithImpl<FinalRoundAnswer>(this as FinalRoundAnswer, _$identity);

  /// Serializes this FinalRoundAnswer to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalRoundAnswer&&(identical(other.id, id) || other.id == id)&&(identical(other.playerId, playerId) || other.playerId == playerId)&&(identical(other.answer, answer) || other.answer == answer)&&(identical(other.isCorrect, isCorrect) || other.isCorrect == isCorrect)&&(identical(other.autoLoss, autoLoss) || other.autoLoss == autoLoss)&&(identical(other.submittedAt, submittedAt) || other.submittedAt == submittedAt)&&(identical(other.reviewedAt, reviewedAt) || other.reviewedAt == reviewedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,playerId,answer,isCorrect,autoLoss,submittedAt,reviewedAt);

@override
String toString() {
  return 'FinalRoundAnswer(id: $id, playerId: $playerId, answer: $answer, isCorrect: $isCorrect, autoLoss: $autoLoss, submittedAt: $submittedAt, reviewedAt: $reviewedAt)';
}


}

/// @nodoc
abstract mixin class $FinalRoundAnswerCopyWith<$Res>  {
  factory $FinalRoundAnswerCopyWith(FinalRoundAnswer value, $Res Function(FinalRoundAnswer) _then) = _$FinalRoundAnswerCopyWithImpl;
@useResult
$Res call({
 String id, int playerId, String answer, bool? isCorrect, bool? autoLoss, DateTime submittedAt, DateTime? reviewedAt
});




}
/// @nodoc
class _$FinalRoundAnswerCopyWithImpl<$Res>
    implements $FinalRoundAnswerCopyWith<$Res> {
  _$FinalRoundAnswerCopyWithImpl(this._self, this._then);

  final FinalRoundAnswer _self;
  final $Res Function(FinalRoundAnswer) _then;

/// Create a copy of FinalRoundAnswer
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? playerId = null,Object? answer = null,Object? isCorrect = freezed,Object? autoLoss = freezed,Object? submittedAt = null,Object? reviewedAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,playerId: null == playerId ? _self.playerId : playerId // ignore: cast_nullable_to_non_nullable
as int,answer: null == answer ? _self.answer : answer // ignore: cast_nullable_to_non_nullable
as String,isCorrect: freezed == isCorrect ? _self.isCorrect : isCorrect // ignore: cast_nullable_to_non_nullable
as bool?,autoLoss: freezed == autoLoss ? _self.autoLoss : autoLoss // ignore: cast_nullable_to_non_nullable
as bool?,submittedAt: null == submittedAt ? _self.submittedAt : submittedAt // ignore: cast_nullable_to_non_nullable
as DateTime,reviewedAt: freezed == reviewedAt ? _self.reviewedAt : reviewedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [FinalRoundAnswer].
extension FinalRoundAnswerPatterns on FinalRoundAnswer {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FinalRoundAnswer value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FinalRoundAnswer() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FinalRoundAnswer value)  $default,){
final _that = this;
switch (_that) {
case _FinalRoundAnswer():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FinalRoundAnswer value)?  $default,){
final _that = this;
switch (_that) {
case _FinalRoundAnswer() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  int playerId,  String answer,  bool? isCorrect,  bool? autoLoss,  DateTime submittedAt,  DateTime? reviewedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FinalRoundAnswer() when $default != null:
return $default(_that.id,_that.playerId,_that.answer,_that.isCorrect,_that.autoLoss,_that.submittedAt,_that.reviewedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  int playerId,  String answer,  bool? isCorrect,  bool? autoLoss,  DateTime submittedAt,  DateTime? reviewedAt)  $default,) {final _that = this;
switch (_that) {
case _FinalRoundAnswer():
return $default(_that.id,_that.playerId,_that.answer,_that.isCorrect,_that.autoLoss,_that.submittedAt,_that.reviewedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  int playerId,  String answer,  bool? isCorrect,  bool? autoLoss,  DateTime submittedAt,  DateTime? reviewedAt)?  $default,) {final _that = this;
switch (_that) {
case _FinalRoundAnswer() when $default != null:
return $default(_that.id,_that.playerId,_that.answer,_that.isCorrect,_that.autoLoss,_that.submittedAt,_that.reviewedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FinalRoundAnswer implements FinalRoundAnswer {
  const _FinalRoundAnswer({required this.id, required this.playerId, required this.answer, required this.isCorrect, required this.autoLoss, required this.submittedAt, required this.reviewedAt});
  factory _FinalRoundAnswer.fromJson(Map<String, dynamic> json) => _$FinalRoundAnswerFromJson(json);

/// Unique ID of the answer
@override final  String id;
/// ID of the player submitting the answer
@override final  int playerId;
/// The player's answer text
@override final  String answer;
/// Whether the answer is correct (null if not yet reviewed)
@override final  bool? isCorrect;
/// Whether this is an automatic loss
@override final  bool? autoLoss;
/// When the answer was submitted
@override final  DateTime submittedAt;
/// When the answer was reviewed
@override final  DateTime? reviewedAt;

/// Create a copy of FinalRoundAnswer
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalRoundAnswerCopyWith<_FinalRoundAnswer> get copyWith => __$FinalRoundAnswerCopyWithImpl<_FinalRoundAnswer>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalRoundAnswerToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalRoundAnswer&&(identical(other.id, id) || other.id == id)&&(identical(other.playerId, playerId) || other.playerId == playerId)&&(identical(other.answer, answer) || other.answer == answer)&&(identical(other.isCorrect, isCorrect) || other.isCorrect == isCorrect)&&(identical(other.autoLoss, autoLoss) || other.autoLoss == autoLoss)&&(identical(other.submittedAt, submittedAt) || other.submittedAt == submittedAt)&&(identical(other.reviewedAt, reviewedAt) || other.reviewedAt == reviewedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,playerId,answer,isCorrect,autoLoss,submittedAt,reviewedAt);

@override
String toString() {
  return 'FinalRoundAnswer(id: $id, playerId: $playerId, answer: $answer, isCorrect: $isCorrect, autoLoss: $autoLoss, submittedAt: $submittedAt, reviewedAt: $reviewedAt)';
}


}

/// @nodoc
abstract mixin class _$FinalRoundAnswerCopyWith<$Res> implements $FinalRoundAnswerCopyWith<$Res> {
  factory _$FinalRoundAnswerCopyWith(_FinalRoundAnswer value, $Res Function(_FinalRoundAnswer) _then) = __$FinalRoundAnswerCopyWithImpl;
@override @useResult
$Res call({
 String id, int playerId, String answer, bool? isCorrect, bool? autoLoss, DateTime submittedAt, DateTime? reviewedAt
});




}
/// @nodoc
class __$FinalRoundAnswerCopyWithImpl<$Res>
    implements _$FinalRoundAnswerCopyWith<$Res> {
  __$FinalRoundAnswerCopyWithImpl(this._self, this._then);

  final _FinalRoundAnswer _self;
  final $Res Function(_FinalRoundAnswer) _then;

/// Create a copy of FinalRoundAnswer
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? playerId = null,Object? answer = null,Object? isCorrect = freezed,Object? autoLoss = freezed,Object? submittedAt = null,Object? reviewedAt = freezed,}) {
  return _then(_FinalRoundAnswer(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,playerId: null == playerId ? _self.playerId : playerId // ignore: cast_nullable_to_non_nullable
as int,answer: null == answer ? _self.answer : answer // ignore: cast_nullable_to_non_nullable
as String,isCorrect: freezed == isCorrect ? _self.isCorrect : isCorrect // ignore: cast_nullable_to_non_nullable
as bool?,autoLoss: freezed == autoLoss ? _self.autoLoss : autoLoss // ignore: cast_nullable_to_non_nullable
as bool?,submittedAt: null == submittedAt ? _self.submittedAt : submittedAt // ignore: cast_nullable_to_non_nullable
as DateTime,reviewedAt: freezed == reviewedAt ? _self.reviewedAt : reviewedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}

// dart format on
