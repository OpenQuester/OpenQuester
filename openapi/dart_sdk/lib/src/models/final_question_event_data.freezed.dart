// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_question_event_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalQuestionEventData {

 FinalRoundQuestionData get questionData;
/// Create a copy of FinalQuestionEventData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalQuestionEventDataCopyWith<FinalQuestionEventData> get copyWith => _$FinalQuestionEventDataCopyWithImpl<FinalQuestionEventData>(this as FinalQuestionEventData, _$identity);

  /// Serializes this FinalQuestionEventData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalQuestionEventData&&(identical(other.questionData, questionData) || other.questionData == questionData));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,questionData);

@override
String toString() {
  return 'FinalQuestionEventData(questionData: $questionData)';
}


}

/// @nodoc
abstract mixin class $FinalQuestionEventDataCopyWith<$Res>  {
  factory $FinalQuestionEventDataCopyWith(FinalQuestionEventData value, $Res Function(FinalQuestionEventData) _then) = _$FinalQuestionEventDataCopyWithImpl;
@useResult
$Res call({
 FinalRoundQuestionData questionData
});


$FinalRoundQuestionDataCopyWith<$Res> get questionData;

}
/// @nodoc
class _$FinalQuestionEventDataCopyWithImpl<$Res>
    implements $FinalQuestionEventDataCopyWith<$Res> {
  _$FinalQuestionEventDataCopyWithImpl(this._self, this._then);

  final FinalQuestionEventData _self;
  final $Res Function(FinalQuestionEventData) _then;

/// Create a copy of FinalQuestionEventData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? questionData = null,}) {
  return _then(_self.copyWith(
questionData: null == questionData ? _self.questionData : questionData // ignore: cast_nullable_to_non_nullable
as FinalRoundQuestionData,
  ));
}
/// Create a copy of FinalQuestionEventData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FinalRoundQuestionDataCopyWith<$Res> get questionData {
  
  return $FinalRoundQuestionDataCopyWith<$Res>(_self.questionData, (value) {
    return _then(_self.copyWith(questionData: value));
  });
}
}


/// Adds pattern-matching-related methods to [FinalQuestionEventData].
extension FinalQuestionEventDataPatterns on FinalQuestionEventData {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FinalQuestionEventData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FinalQuestionEventData() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FinalQuestionEventData value)  $default,){
final _that = this;
switch (_that) {
case _FinalQuestionEventData():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FinalQuestionEventData value)?  $default,){
final _that = this;
switch (_that) {
case _FinalQuestionEventData() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( FinalRoundQuestionData questionData)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FinalQuestionEventData() when $default != null:
return $default(_that.questionData);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( FinalRoundQuestionData questionData)  $default,) {final _that = this;
switch (_that) {
case _FinalQuestionEventData():
return $default(_that.questionData);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( FinalRoundQuestionData questionData)?  $default,) {final _that = this;
switch (_that) {
case _FinalQuestionEventData() when $default != null:
return $default(_that.questionData);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FinalQuestionEventData implements FinalQuestionEventData {
  const _FinalQuestionEventData({required this.questionData});
  factory _FinalQuestionEventData.fromJson(Map<String, dynamic> json) => _$FinalQuestionEventDataFromJson(json);

@override final  FinalRoundQuestionData questionData;

/// Create a copy of FinalQuestionEventData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalQuestionEventDataCopyWith<_FinalQuestionEventData> get copyWith => __$FinalQuestionEventDataCopyWithImpl<_FinalQuestionEventData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalQuestionEventDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalQuestionEventData&&(identical(other.questionData, questionData) || other.questionData == questionData));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,questionData);

@override
String toString() {
  return 'FinalQuestionEventData(questionData: $questionData)';
}


}

/// @nodoc
abstract mixin class _$FinalQuestionEventDataCopyWith<$Res> implements $FinalQuestionEventDataCopyWith<$Res> {
  factory _$FinalQuestionEventDataCopyWith(_FinalQuestionEventData value, $Res Function(_FinalQuestionEventData) _then) = __$FinalQuestionEventDataCopyWithImpl;
@override @useResult
$Res call({
 FinalRoundQuestionData questionData
});


@override $FinalRoundQuestionDataCopyWith<$Res> get questionData;

}
/// @nodoc
class __$FinalQuestionEventDataCopyWithImpl<$Res>
    implements _$FinalQuestionEventDataCopyWith<$Res> {
  __$FinalQuestionEventDataCopyWithImpl(this._self, this._then);

  final _FinalQuestionEventData _self;
  final $Res Function(_FinalQuestionEventData) _then;

/// Create a copy of FinalQuestionEventData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? questionData = null,}) {
  return _then(_FinalQuestionEventData(
questionData: null == questionData ? _self.questionData : questionData // ignore: cast_nullable_to_non_nullable
as FinalRoundQuestionData,
  ));
}

/// Create a copy of FinalQuestionEventData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FinalRoundQuestionDataCopyWith<$Res> get questionData {
  
  return $FinalRoundQuestionDataCopyWith<$Res>(_self.questionData, (value) {
    return _then(_self.copyWith(questionData: value));
  });
}
}

// dart format on
