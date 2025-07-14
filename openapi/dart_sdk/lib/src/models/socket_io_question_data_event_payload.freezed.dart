// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'socket_io_question_data_event_payload.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SocketIOQuestionDataEventPayload {

 PackageQuestionData get data; GameStateTimer get timer;
/// Create a copy of SocketIOQuestionDataEventPayload
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SocketIOQuestionDataEventPayloadCopyWith<SocketIOQuestionDataEventPayload> get copyWith => _$SocketIOQuestionDataEventPayloadCopyWithImpl<SocketIOQuestionDataEventPayload>(this as SocketIOQuestionDataEventPayload, _$identity);

  /// Serializes this SocketIOQuestionDataEventPayload to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SocketIOQuestionDataEventPayload&&(identical(other.data, data) || other.data == data)&&(identical(other.timer, timer) || other.timer == timer));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,data,timer);

@override
String toString() {
  return 'SocketIOQuestionDataEventPayload(data: $data, timer: $timer)';
}


}

/// @nodoc
abstract mixin class $SocketIOQuestionDataEventPayloadCopyWith<$Res>  {
  factory $SocketIOQuestionDataEventPayloadCopyWith(SocketIOQuestionDataEventPayload value, $Res Function(SocketIOQuestionDataEventPayload) _then) = _$SocketIOQuestionDataEventPayloadCopyWithImpl;
@useResult
$Res call({
 PackageQuestionData data, GameStateTimer timer
});


$PackageQuestionDataCopyWith<$Res> get data;$GameStateTimerCopyWith<$Res> get timer;

}
/// @nodoc
class _$SocketIOQuestionDataEventPayloadCopyWithImpl<$Res>
    implements $SocketIOQuestionDataEventPayloadCopyWith<$Res> {
  _$SocketIOQuestionDataEventPayloadCopyWithImpl(this._self, this._then);

  final SocketIOQuestionDataEventPayload _self;
  final $Res Function(SocketIOQuestionDataEventPayload) _then;

/// Create a copy of SocketIOQuestionDataEventPayload
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? data = null,Object? timer = null,}) {
  return _then(_self.copyWith(
data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as PackageQuestionData,timer: null == timer ? _self.timer : timer // ignore: cast_nullable_to_non_nullable
as GameStateTimer,
  ));
}
/// Create a copy of SocketIOQuestionDataEventPayload
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PackageQuestionDataCopyWith<$Res> get data {
  
  return $PackageQuestionDataCopyWith<$Res>(_self.data, (value) {
    return _then(_self.copyWith(data: value));
  });
}/// Create a copy of SocketIOQuestionDataEventPayload
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameStateTimerCopyWith<$Res> get timer {
  
  return $GameStateTimerCopyWith<$Res>(_self.timer, (value) {
    return _then(_self.copyWith(timer: value));
  });
}
}


/// Adds pattern-matching-related methods to [SocketIOQuestionDataEventPayload].
extension SocketIOQuestionDataEventPayloadPatterns on SocketIOQuestionDataEventPayload {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SocketIOQuestionDataEventPayload value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SocketIOQuestionDataEventPayload() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SocketIOQuestionDataEventPayload value)  $default,){
final _that = this;
switch (_that) {
case _SocketIOQuestionDataEventPayload():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SocketIOQuestionDataEventPayload value)?  $default,){
final _that = this;
switch (_that) {
case _SocketIOQuestionDataEventPayload() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( PackageQuestionData data,  GameStateTimer timer)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SocketIOQuestionDataEventPayload() when $default != null:
return $default(_that.data,_that.timer);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( PackageQuestionData data,  GameStateTimer timer)  $default,) {final _that = this;
switch (_that) {
case _SocketIOQuestionDataEventPayload():
return $default(_that.data,_that.timer);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( PackageQuestionData data,  GameStateTimer timer)?  $default,) {final _that = this;
switch (_that) {
case _SocketIOQuestionDataEventPayload() when $default != null:
return $default(_that.data,_that.timer);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SocketIOQuestionDataEventPayload implements SocketIOQuestionDataEventPayload {
  const _SocketIOQuestionDataEventPayload({required this.data, required this.timer});
  factory _SocketIOQuestionDataEventPayload.fromJson(Map<String, dynamic> json) => _$SocketIOQuestionDataEventPayloadFromJson(json);

@override final  PackageQuestionData data;
@override final  GameStateTimer timer;

/// Create a copy of SocketIOQuestionDataEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SocketIOQuestionDataEventPayloadCopyWith<_SocketIOQuestionDataEventPayload> get copyWith => __$SocketIOQuestionDataEventPayloadCopyWithImpl<_SocketIOQuestionDataEventPayload>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SocketIOQuestionDataEventPayloadToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SocketIOQuestionDataEventPayload&&(identical(other.data, data) || other.data == data)&&(identical(other.timer, timer) || other.timer == timer));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,data,timer);

@override
String toString() {
  return 'SocketIOQuestionDataEventPayload(data: $data, timer: $timer)';
}


}

/// @nodoc
abstract mixin class _$SocketIOQuestionDataEventPayloadCopyWith<$Res> implements $SocketIOQuestionDataEventPayloadCopyWith<$Res> {
  factory _$SocketIOQuestionDataEventPayloadCopyWith(_SocketIOQuestionDataEventPayload value, $Res Function(_SocketIOQuestionDataEventPayload) _then) = __$SocketIOQuestionDataEventPayloadCopyWithImpl;
@override @useResult
$Res call({
 PackageQuestionData data, GameStateTimer timer
});


@override $PackageQuestionDataCopyWith<$Res> get data;@override $GameStateTimerCopyWith<$Res> get timer;

}
/// @nodoc
class __$SocketIOQuestionDataEventPayloadCopyWithImpl<$Res>
    implements _$SocketIOQuestionDataEventPayloadCopyWith<$Res> {
  __$SocketIOQuestionDataEventPayloadCopyWithImpl(this._self, this._then);

  final _SocketIOQuestionDataEventPayload _self;
  final $Res Function(_SocketIOQuestionDataEventPayload) _then;

/// Create a copy of SocketIOQuestionDataEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? data = null,Object? timer = null,}) {
  return _then(_SocketIOQuestionDataEventPayload(
data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as PackageQuestionData,timer: null == timer ? _self.timer : timer // ignore: cast_nullable_to_non_nullable
as GameStateTimer,
  ));
}

/// Create a copy of SocketIOQuestionDataEventPayload
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PackageQuestionDataCopyWith<$Res> get data {
  
  return $PackageQuestionDataCopyWith<$Res>(_self.data, (value) {
    return _then(_self.copyWith(data: value));
  });
}/// Create a copy of SocketIOQuestionDataEventPayload
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameStateTimerCopyWith<$Res> get timer {
  
  return $GameStateTimerCopyWith<$Res>(_self.timer, (value) {
    return _then(_self.copyWith(timer: value));
  });
}
}

// dart format on
