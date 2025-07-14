// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'socket_io_chat_message_event_payload.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SocketIOChatMessageEventPayload {

 String get message; String get uuid;/// ID of the user who sent the message
 int get user; DateTime get timestamp;
/// Create a copy of SocketIOChatMessageEventPayload
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SocketIOChatMessageEventPayloadCopyWith<SocketIOChatMessageEventPayload> get copyWith => _$SocketIOChatMessageEventPayloadCopyWithImpl<SocketIOChatMessageEventPayload>(this as SocketIOChatMessageEventPayload, _$identity);

  /// Serializes this SocketIOChatMessageEventPayload to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SocketIOChatMessageEventPayload&&(identical(other.message, message) || other.message == message)&&(identical(other.uuid, uuid) || other.uuid == uuid)&&(identical(other.user, user) || other.user == user)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,message,uuid,user,timestamp);

@override
String toString() {
  return 'SocketIOChatMessageEventPayload(message: $message, uuid: $uuid, user: $user, timestamp: $timestamp)';
}


}

/// @nodoc
abstract mixin class $SocketIOChatMessageEventPayloadCopyWith<$Res>  {
  factory $SocketIOChatMessageEventPayloadCopyWith(SocketIOChatMessageEventPayload value, $Res Function(SocketIOChatMessageEventPayload) _then) = _$SocketIOChatMessageEventPayloadCopyWithImpl;
@useResult
$Res call({
 String message, String uuid, int user, DateTime timestamp
});




}
/// @nodoc
class _$SocketIOChatMessageEventPayloadCopyWithImpl<$Res>
    implements $SocketIOChatMessageEventPayloadCopyWith<$Res> {
  _$SocketIOChatMessageEventPayloadCopyWithImpl(this._self, this._then);

  final SocketIOChatMessageEventPayload _self;
  final $Res Function(SocketIOChatMessageEventPayload) _then;

/// Create a copy of SocketIOChatMessageEventPayload
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? message = null,Object? uuid = null,Object? user = null,Object? timestamp = null,}) {
  return _then(_self.copyWith(
message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,uuid: null == uuid ? _self.uuid : uuid // ignore: cast_nullable_to_non_nullable
as String,user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as int,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

}


/// Adds pattern-matching-related methods to [SocketIOChatMessageEventPayload].
extension SocketIOChatMessageEventPayloadPatterns on SocketIOChatMessageEventPayload {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SocketIOChatMessageEventPayload value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SocketIOChatMessageEventPayload() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SocketIOChatMessageEventPayload value)  $default,){
final _that = this;
switch (_that) {
case _SocketIOChatMessageEventPayload():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SocketIOChatMessageEventPayload value)?  $default,){
final _that = this;
switch (_that) {
case _SocketIOChatMessageEventPayload() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String message,  String uuid,  int user,  DateTime timestamp)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SocketIOChatMessageEventPayload() when $default != null:
return $default(_that.message,_that.uuid,_that.user,_that.timestamp);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String message,  String uuid,  int user,  DateTime timestamp)  $default,) {final _that = this;
switch (_that) {
case _SocketIOChatMessageEventPayload():
return $default(_that.message,_that.uuid,_that.user,_that.timestamp);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String message,  String uuid,  int user,  DateTime timestamp)?  $default,) {final _that = this;
switch (_that) {
case _SocketIOChatMessageEventPayload() when $default != null:
return $default(_that.message,_that.uuid,_that.user,_that.timestamp);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SocketIOChatMessageEventPayload implements SocketIOChatMessageEventPayload {
  const _SocketIOChatMessageEventPayload({required this.message, required this.uuid, required this.user, required this.timestamp});
  factory _SocketIOChatMessageEventPayload.fromJson(Map<String, dynamic> json) => _$SocketIOChatMessageEventPayloadFromJson(json);

@override final  String message;
@override final  String uuid;
/// ID of the user who sent the message
@override final  int user;
@override final  DateTime timestamp;

/// Create a copy of SocketIOChatMessageEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SocketIOChatMessageEventPayloadCopyWith<_SocketIOChatMessageEventPayload> get copyWith => __$SocketIOChatMessageEventPayloadCopyWithImpl<_SocketIOChatMessageEventPayload>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SocketIOChatMessageEventPayloadToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SocketIOChatMessageEventPayload&&(identical(other.message, message) || other.message == message)&&(identical(other.uuid, uuid) || other.uuid == uuid)&&(identical(other.user, user) || other.user == user)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,message,uuid,user,timestamp);

@override
String toString() {
  return 'SocketIOChatMessageEventPayload(message: $message, uuid: $uuid, user: $user, timestamp: $timestamp)';
}


}

/// @nodoc
abstract mixin class _$SocketIOChatMessageEventPayloadCopyWith<$Res> implements $SocketIOChatMessageEventPayloadCopyWith<$Res> {
  factory _$SocketIOChatMessageEventPayloadCopyWith(_SocketIOChatMessageEventPayload value, $Res Function(_SocketIOChatMessageEventPayload) _then) = __$SocketIOChatMessageEventPayloadCopyWithImpl;
@override @useResult
$Res call({
 String message, String uuid, int user, DateTime timestamp
});




}
/// @nodoc
class __$SocketIOChatMessageEventPayloadCopyWithImpl<$Res>
    implements _$SocketIOChatMessageEventPayloadCopyWith<$Res> {
  __$SocketIOChatMessageEventPayloadCopyWithImpl(this._self, this._then);

  final _SocketIOChatMessageEventPayload _self;
  final $Res Function(_SocketIOChatMessageEventPayload) _then;

/// Create a copy of SocketIOChatMessageEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? message = null,Object? uuid = null,Object? user = null,Object? timestamp = null,}) {
  return _then(_SocketIOChatMessageEventPayload(
message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,uuid: null == uuid ? _self.uuid : uuid // ignore: cast_nullable_to_non_nullable
as String,user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as int,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}


}

// dart format on
