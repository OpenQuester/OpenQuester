// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_submit_end_event_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalSubmitEndEventData {

 FinalRoundPhase get phase; FinalRoundPhase? get nextPhase;/// All answers revealed when transitioning to reviewing phase
 List<AnswerReviewData?>? get allReviews;
/// Create a copy of FinalSubmitEndEventData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalSubmitEndEventDataCopyWith<FinalSubmitEndEventData> get copyWith => _$FinalSubmitEndEventDataCopyWithImpl<FinalSubmitEndEventData>(this as FinalSubmitEndEventData, _$identity);

  /// Serializes this FinalSubmitEndEventData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalSubmitEndEventData&&(identical(other.phase, phase) || other.phase == phase)&&(identical(other.nextPhase, nextPhase) || other.nextPhase == nextPhase)&&const DeepCollectionEquality().equals(other.allReviews, allReviews));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,phase,nextPhase,const DeepCollectionEquality().hash(allReviews));

@override
String toString() {
  return 'FinalSubmitEndEventData(phase: $phase, nextPhase: $nextPhase, allReviews: $allReviews)';
}


}

/// @nodoc
abstract mixin class $FinalSubmitEndEventDataCopyWith<$Res>  {
  factory $FinalSubmitEndEventDataCopyWith(FinalSubmitEndEventData value, $Res Function(FinalSubmitEndEventData) _then) = _$FinalSubmitEndEventDataCopyWithImpl;
@useResult
$Res call({
 FinalRoundPhase phase, FinalRoundPhase? nextPhase, List<AnswerReviewData?>? allReviews
});




}
/// @nodoc
class _$FinalSubmitEndEventDataCopyWithImpl<$Res>
    implements $FinalSubmitEndEventDataCopyWith<$Res> {
  _$FinalSubmitEndEventDataCopyWithImpl(this._self, this._then);

  final FinalSubmitEndEventData _self;
  final $Res Function(FinalSubmitEndEventData) _then;

/// Create a copy of FinalSubmitEndEventData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? phase = null,Object? nextPhase = freezed,Object? allReviews = freezed,}) {
  return _then(_self.copyWith(
phase: null == phase ? _self.phase : phase // ignore: cast_nullable_to_non_nullable
as FinalRoundPhase,nextPhase: freezed == nextPhase ? _self.nextPhase : nextPhase // ignore: cast_nullable_to_non_nullable
as FinalRoundPhase?,allReviews: freezed == allReviews ? _self.allReviews : allReviews // ignore: cast_nullable_to_non_nullable
as List<AnswerReviewData?>?,
  ));
}

}


/// Adds pattern-matching-related methods to [FinalSubmitEndEventData].
extension FinalSubmitEndEventDataPatterns on FinalSubmitEndEventData {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FinalSubmitEndEventData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FinalSubmitEndEventData() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FinalSubmitEndEventData value)  $default,){
final _that = this;
switch (_that) {
case _FinalSubmitEndEventData():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FinalSubmitEndEventData value)?  $default,){
final _that = this;
switch (_that) {
case _FinalSubmitEndEventData() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( FinalRoundPhase phase,  FinalRoundPhase? nextPhase,  List<AnswerReviewData?>? allReviews)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FinalSubmitEndEventData() when $default != null:
return $default(_that.phase,_that.nextPhase,_that.allReviews);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( FinalRoundPhase phase,  FinalRoundPhase? nextPhase,  List<AnswerReviewData?>? allReviews)  $default,) {final _that = this;
switch (_that) {
case _FinalSubmitEndEventData():
return $default(_that.phase,_that.nextPhase,_that.allReviews);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( FinalRoundPhase phase,  FinalRoundPhase? nextPhase,  List<AnswerReviewData?>? allReviews)?  $default,) {final _that = this;
switch (_that) {
case _FinalSubmitEndEventData() when $default != null:
return $default(_that.phase,_that.nextPhase,_that.allReviews);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FinalSubmitEndEventData implements FinalSubmitEndEventData {
  const _FinalSubmitEndEventData({required this.phase, this.nextPhase, final  List<AnswerReviewData?>? allReviews}): _allReviews = allReviews;
  factory _FinalSubmitEndEventData.fromJson(Map<String, dynamic> json) => _$FinalSubmitEndEventDataFromJson(json);

@override final  FinalRoundPhase phase;
@override final  FinalRoundPhase? nextPhase;
/// All answers revealed when transitioning to reviewing phase
 final  List<AnswerReviewData?>? _allReviews;
/// All answers revealed when transitioning to reviewing phase
@override List<AnswerReviewData?>? get allReviews {
  final value = _allReviews;
  if (value == null) return null;
  if (_allReviews is EqualUnmodifiableListView) return _allReviews;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of FinalSubmitEndEventData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalSubmitEndEventDataCopyWith<_FinalSubmitEndEventData> get copyWith => __$FinalSubmitEndEventDataCopyWithImpl<_FinalSubmitEndEventData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalSubmitEndEventDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalSubmitEndEventData&&(identical(other.phase, phase) || other.phase == phase)&&(identical(other.nextPhase, nextPhase) || other.nextPhase == nextPhase)&&const DeepCollectionEquality().equals(other._allReviews, _allReviews));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,phase,nextPhase,const DeepCollectionEquality().hash(_allReviews));

@override
String toString() {
  return 'FinalSubmitEndEventData(phase: $phase, nextPhase: $nextPhase, allReviews: $allReviews)';
}


}

/// @nodoc
abstract mixin class _$FinalSubmitEndEventDataCopyWith<$Res> implements $FinalSubmitEndEventDataCopyWith<$Res> {
  factory _$FinalSubmitEndEventDataCopyWith(_FinalSubmitEndEventData value, $Res Function(_FinalSubmitEndEventData) _then) = __$FinalSubmitEndEventDataCopyWithImpl;
@override @useResult
$Res call({
 FinalRoundPhase phase, FinalRoundPhase? nextPhase, List<AnswerReviewData?>? allReviews
});




}
/// @nodoc
class __$FinalSubmitEndEventDataCopyWithImpl<$Res>
    implements _$FinalSubmitEndEventDataCopyWith<$Res> {
  __$FinalSubmitEndEventDataCopyWithImpl(this._self, this._then);

  final _FinalSubmitEndEventData _self;
  final $Res Function(_FinalSubmitEndEventData) _then;

/// Create a copy of FinalSubmitEndEventData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? phase = null,Object? nextPhase = freezed,Object? allReviews = freezed,}) {
  return _then(_FinalSubmitEndEventData(
phase: null == phase ? _self.phase : phase // ignore: cast_nullable_to_non_nullable
as FinalRoundPhase,nextPhase: freezed == nextPhase ? _self.nextPhase : nextPhase // ignore: cast_nullable_to_non_nullable
as FinalRoundPhase?,allReviews: freezed == allReviews ? _self._allReviews : allReviews // ignore: cast_nullable_to_non_nullable
as List<AnswerReviewData?>?,
  ));
}


}

// dart format on
