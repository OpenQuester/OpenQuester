// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'socket_io_game_leave_event_payload.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SocketIOGameLeaveEventPayload {

/// Emitted to everyone in game, including sender. ID of the user who left the game
 int get user;
/// Create a copy of SocketIOGameLeaveEventPayload
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SocketIOGameLeaveEventPayloadCopyWith<SocketIOGameLeaveEventPayload> get copyWith => _$SocketIOGameLeaveEventPayloadCopyWithImpl<SocketIOGameLeaveEventPayload>(this as SocketIOGameLeaveEventPayload, _$identity);

  /// Serializes this SocketIOGameLeaveEventPayload to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SocketIOGameLeaveEventPayload&&(identical(other.user, user) || other.user == user));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,user);

@override
String toString() {
  return 'SocketIOGameLeaveEventPayload(user: $user)';
}


}

/// @nodoc
abstract mixin class $SocketIOGameLeaveEventPayloadCopyWith<$Res>  {
  factory $SocketIOGameLeaveEventPayloadCopyWith(SocketIOGameLeaveEventPayload value, $Res Function(SocketIOGameLeaveEventPayload) _then) = _$SocketIOGameLeaveEventPayloadCopyWithImpl;
@useResult
$Res call({
 int user
});




}
/// @nodoc
class _$SocketIOGameLeaveEventPayloadCopyWithImpl<$Res>
    implements $SocketIOGameLeaveEventPayloadCopyWith<$Res> {
  _$SocketIOGameLeaveEventPayloadCopyWithImpl(this._self, this._then);

  final SocketIOGameLeaveEventPayload _self;
  final $Res Function(SocketIOGameLeaveEventPayload) _then;

/// Create a copy of SocketIOGameLeaveEventPayload
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? user = null,}) {
  return _then(_self.copyWith(
user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [SocketIOGameLeaveEventPayload].
extension SocketIOGameLeaveEventPayloadPatterns on SocketIOGameLeaveEventPayload {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SocketIOGameLeaveEventPayload value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SocketIOGameLeaveEventPayload() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SocketIOGameLeaveEventPayload value)  $default,){
final _that = this;
switch (_that) {
case _SocketIOGameLeaveEventPayload():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SocketIOGameLeaveEventPayload value)?  $default,){
final _that = this;
switch (_that) {
case _SocketIOGameLeaveEventPayload() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int user)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SocketIOGameLeaveEventPayload() when $default != null:
return $default(_that.user);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int user)  $default,) {final _that = this;
switch (_that) {
case _SocketIOGameLeaveEventPayload():
return $default(_that.user);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int user)?  $default,) {final _that = this;
switch (_that) {
case _SocketIOGameLeaveEventPayload() when $default != null:
return $default(_that.user);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SocketIOGameLeaveEventPayload implements SocketIOGameLeaveEventPayload {
  const _SocketIOGameLeaveEventPayload({required this.user});
  factory _SocketIOGameLeaveEventPayload.fromJson(Map<String, dynamic> json) => _$SocketIOGameLeaveEventPayloadFromJson(json);

/// Emitted to everyone in game, including sender. ID of the user who left the game
@override final  int user;

/// Create a copy of SocketIOGameLeaveEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SocketIOGameLeaveEventPayloadCopyWith<_SocketIOGameLeaveEventPayload> get copyWith => __$SocketIOGameLeaveEventPayloadCopyWithImpl<_SocketIOGameLeaveEventPayload>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SocketIOGameLeaveEventPayloadToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SocketIOGameLeaveEventPayload&&(identical(other.user, user) || other.user == user));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,user);

@override
String toString() {
  return 'SocketIOGameLeaveEventPayload(user: $user)';
}


}

/// @nodoc
abstract mixin class _$SocketIOGameLeaveEventPayloadCopyWith<$Res> implements $SocketIOGameLeaveEventPayloadCopyWith<$Res> {
  factory _$SocketIOGameLeaveEventPayloadCopyWith(_SocketIOGameLeaveEventPayload value, $Res Function(_SocketIOGameLeaveEventPayload) _then) = __$SocketIOGameLeaveEventPayloadCopyWithImpl;
@override @useResult
$Res call({
 int user
});




}
/// @nodoc
class __$SocketIOGameLeaveEventPayloadCopyWithImpl<$Res>
    implements _$SocketIOGameLeaveEventPayloadCopyWith<$Res> {
  __$SocketIOGameLeaveEventPayloadCopyWithImpl(this._self, this._then);

  final _SocketIOGameLeaveEventPayload _self;
  final $Res Function(_SocketIOGameLeaveEventPayload) _then;

/// Create a copy of SocketIOGameLeaveEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? user = null,}) {
  return _then(_SocketIOGameLeaveEventPayload(
user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
