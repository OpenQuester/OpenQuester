// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'socket_io_answer_submitted_event_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SocketIOAnswerSubmittedEventData {

/// Player's answer text
 String? get answerText;
/// Create a copy of SocketIOAnswerSubmittedEventData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SocketIOAnswerSubmittedEventDataCopyWith<SocketIOAnswerSubmittedEventData> get copyWith => _$SocketIOAnswerSubmittedEventDataCopyWithImpl<SocketIOAnswerSubmittedEventData>(this as SocketIOAnswerSubmittedEventData, _$identity);

  /// Serializes this SocketIOAnswerSubmittedEventData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SocketIOAnswerSubmittedEventData&&(identical(other.answerText, answerText) || other.answerText == answerText));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,answerText);

@override
String toString() {
  return 'SocketIOAnswerSubmittedEventData(answerText: $answerText)';
}


}

/// @nodoc
abstract mixin class $SocketIOAnswerSubmittedEventDataCopyWith<$Res>  {
  factory $SocketIOAnswerSubmittedEventDataCopyWith(SocketIOAnswerSubmittedEventData value, $Res Function(SocketIOAnswerSubmittedEventData) _then) = _$SocketIOAnswerSubmittedEventDataCopyWithImpl;
@useResult
$Res call({
 String? answerText
});




}
/// @nodoc
class _$SocketIOAnswerSubmittedEventDataCopyWithImpl<$Res>
    implements $SocketIOAnswerSubmittedEventDataCopyWith<$Res> {
  _$SocketIOAnswerSubmittedEventDataCopyWithImpl(this._self, this._then);

  final SocketIOAnswerSubmittedEventData _self;
  final $Res Function(SocketIOAnswerSubmittedEventData) _then;

/// Create a copy of SocketIOAnswerSubmittedEventData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? answerText = freezed,}) {
  return _then(_self.copyWith(
answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [SocketIOAnswerSubmittedEventData].
extension SocketIOAnswerSubmittedEventDataPatterns on SocketIOAnswerSubmittedEventData {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SocketIOAnswerSubmittedEventData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SocketIOAnswerSubmittedEventData() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SocketIOAnswerSubmittedEventData value)  $default,){
final _that = this;
switch (_that) {
case _SocketIOAnswerSubmittedEventData():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SocketIOAnswerSubmittedEventData value)?  $default,){
final _that = this;
switch (_that) {
case _SocketIOAnswerSubmittedEventData() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? answerText)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SocketIOAnswerSubmittedEventData() when $default != null:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? answerText)  $default,) {final _that = this;
switch (_that) {
case _SocketIOAnswerSubmittedEventData():
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? answerText)?  $default,) {final _that = this;
switch (_that) {
case _SocketIOAnswerSubmittedEventData() when $default != null:
return $default(_that.answerText);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SocketIOAnswerSubmittedEventData implements SocketIOAnswerSubmittedEventData {
  const _SocketIOAnswerSubmittedEventData({required this.answerText});
  factory _SocketIOAnswerSubmittedEventData.fromJson(Map<String, dynamic> json) => _$SocketIOAnswerSubmittedEventDataFromJson(json);

/// Player's answer text
@override final  String? answerText;

/// Create a copy of SocketIOAnswerSubmittedEventData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SocketIOAnswerSubmittedEventDataCopyWith<_SocketIOAnswerSubmittedEventData> get copyWith => __$SocketIOAnswerSubmittedEventDataCopyWithImpl<_SocketIOAnswerSubmittedEventData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SocketIOAnswerSubmittedEventDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SocketIOAnswerSubmittedEventData&&(identical(other.answerText, answerText) || other.answerText == answerText));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,answerText);

@override
String toString() {
  return 'SocketIOAnswerSubmittedEventData(answerText: $answerText)';
}


}

/// @nodoc
abstract mixin class _$SocketIOAnswerSubmittedEventDataCopyWith<$Res> implements $SocketIOAnswerSubmittedEventDataCopyWith<$Res> {
  factory _$SocketIOAnswerSubmittedEventDataCopyWith(_SocketIOAnswerSubmittedEventData value, $Res Function(_SocketIOAnswerSubmittedEventData) _then) = __$SocketIOAnswerSubmittedEventDataCopyWithImpl;
@override @useResult
$Res call({
 String? answerText
});




}
/// @nodoc
class __$SocketIOAnswerSubmittedEventDataCopyWithImpl<$Res>
    implements _$SocketIOAnswerSubmittedEventDataCopyWith<$Res> {
  __$SocketIOAnswerSubmittedEventDataCopyWithImpl(this._self, this._then);

  final _SocketIOAnswerSubmittedEventData _self;
  final $Res Function(_SocketIOAnswerSubmittedEventData) _then;

/// Create a copy of SocketIOAnswerSubmittedEventData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? answerText = freezed,}) {
  return _then(_SocketIOAnswerSubmittedEventData(
answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
