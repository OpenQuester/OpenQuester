// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'socket_io_game_pause_event_payload.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SocketIOGamePauseEventPayload {

 GameStateTimer get timer;
/// Create a copy of SocketIOGamePauseEventPayload
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SocketIOGamePauseEventPayloadCopyWith<SocketIOGamePauseEventPayload> get copyWith => _$SocketIOGamePauseEventPayloadCopyWithImpl<SocketIOGamePauseEventPayload>(this as SocketIOGamePauseEventPayload, _$identity);

  /// Serializes this SocketIOGamePauseEventPayload to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SocketIOGamePauseEventPayload&&(identical(other.timer, timer) || other.timer == timer));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,timer);

@override
String toString() {
  return 'SocketIOGamePauseEventPayload(timer: $timer)';
}


}

/// @nodoc
abstract mixin class $SocketIOGamePauseEventPayloadCopyWith<$Res>  {
  factory $SocketIOGamePauseEventPayloadCopyWith(SocketIOGamePauseEventPayload value, $Res Function(SocketIOGamePauseEventPayload) _then) = _$SocketIOGamePauseEventPayloadCopyWithImpl;
@useResult
$Res call({
 GameStateTimer timer
});


$GameStateTimerCopyWith<$Res> get timer;

}
/// @nodoc
class _$SocketIOGamePauseEventPayloadCopyWithImpl<$Res>
    implements $SocketIOGamePauseEventPayloadCopyWith<$Res> {
  _$SocketIOGamePauseEventPayloadCopyWithImpl(this._self, this._then);

  final SocketIOGamePauseEventPayload _self;
  final $Res Function(SocketIOGamePauseEventPayload) _then;

/// Create a copy of SocketIOGamePauseEventPayload
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? timer = null,}) {
  return _then(_self.copyWith(
timer: null == timer ? _self.timer : timer // ignore: cast_nullable_to_non_nullable
as GameStateTimer,
  ));
}
/// Create a copy of SocketIOGamePauseEventPayload
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameStateTimerCopyWith<$Res> get timer {
  
  return $GameStateTimerCopyWith<$Res>(_self.timer, (value) {
    return _then(_self.copyWith(timer: value));
  });
}
}


/// Adds pattern-matching-related methods to [SocketIOGamePauseEventPayload].
extension SocketIOGamePauseEventPayloadPatterns on SocketIOGamePauseEventPayload {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SocketIOGamePauseEventPayload value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SocketIOGamePauseEventPayload() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SocketIOGamePauseEventPayload value)  $default,){
final _that = this;
switch (_that) {
case _SocketIOGamePauseEventPayload():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SocketIOGamePauseEventPayload value)?  $default,){
final _that = this;
switch (_that) {
case _SocketIOGamePauseEventPayload() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( GameStateTimer timer)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SocketIOGamePauseEventPayload() when $default != null:
return $default(_that.timer);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( GameStateTimer timer)  $default,) {final _that = this;
switch (_that) {
case _SocketIOGamePauseEventPayload():
return $default(_that.timer);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( GameStateTimer timer)?  $default,) {final _that = this;
switch (_that) {
case _SocketIOGamePauseEventPayload() when $default != null:
return $default(_that.timer);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SocketIOGamePauseEventPayload implements SocketIOGamePauseEventPayload {
  const _SocketIOGamePauseEventPayload({required this.timer});
  factory _SocketIOGamePauseEventPayload.fromJson(Map<String, dynamic> json) => _$SocketIOGamePauseEventPayloadFromJson(json);

@override final  GameStateTimer timer;

/// Create a copy of SocketIOGamePauseEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SocketIOGamePauseEventPayloadCopyWith<_SocketIOGamePauseEventPayload> get copyWith => __$SocketIOGamePauseEventPayloadCopyWithImpl<_SocketIOGamePauseEventPayload>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SocketIOGamePauseEventPayloadToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SocketIOGamePauseEventPayload&&(identical(other.timer, timer) || other.timer == timer));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,timer);

@override
String toString() {
  return 'SocketIOGamePauseEventPayload(timer: $timer)';
}


}

/// @nodoc
abstract mixin class _$SocketIOGamePauseEventPayloadCopyWith<$Res> implements $SocketIOGamePauseEventPayloadCopyWith<$Res> {
  factory _$SocketIOGamePauseEventPayloadCopyWith(_SocketIOGamePauseEventPayload value, $Res Function(_SocketIOGamePauseEventPayload) _then) = __$SocketIOGamePauseEventPayloadCopyWithImpl;
@override @useResult
$Res call({
 GameStateTimer timer
});


@override $GameStateTimerCopyWith<$Res> get timer;

}
/// @nodoc
class __$SocketIOGamePauseEventPayloadCopyWithImpl<$Res>
    implements _$SocketIOGamePauseEventPayloadCopyWith<$Res> {
  __$SocketIOGamePauseEventPayloadCopyWithImpl(this._self, this._then);

  final _SocketIOGamePauseEventPayload _self;
  final $Res Function(_SocketIOGamePauseEventPayload) _then;

/// Create a copy of SocketIOGamePauseEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? timer = null,}) {
  return _then(_SocketIOGamePauseEventPayload(
timer: null == timer ? _self.timer : timer // ignore: cast_nullable_to_non_nullable
as GameStateTimer,
  ));
}

/// Create a copy of SocketIOGamePauseEventPayload
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
