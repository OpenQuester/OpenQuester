// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'socket_io_chat_message_content.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SocketIOChatMessageContent {

 String get message;
/// Create a copy of SocketIOChatMessageContent
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SocketIOChatMessageContentCopyWith<SocketIOChatMessageContent> get copyWith => _$SocketIOChatMessageContentCopyWithImpl<SocketIOChatMessageContent>(this as SocketIOChatMessageContent, _$identity);

  /// Serializes this SocketIOChatMessageContent to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SocketIOChatMessageContent&&(identical(other.message, message) || other.message == message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,message);

@override
String toString() {
  return 'SocketIOChatMessageContent(message: $message)';
}


}

/// @nodoc
abstract mixin class $SocketIOChatMessageContentCopyWith<$Res>  {
  factory $SocketIOChatMessageContentCopyWith(SocketIOChatMessageContent value, $Res Function(SocketIOChatMessageContent) _then) = _$SocketIOChatMessageContentCopyWithImpl;
@useResult
$Res call({
 String message
});




}
/// @nodoc
class _$SocketIOChatMessageContentCopyWithImpl<$Res>
    implements $SocketIOChatMessageContentCopyWith<$Res> {
  _$SocketIOChatMessageContentCopyWithImpl(this._self, this._then);

  final SocketIOChatMessageContent _self;
  final $Res Function(SocketIOChatMessageContent) _then;

/// Create a copy of SocketIOChatMessageContent
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? message = null,}) {
  return _then(_self.copyWith(
message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [SocketIOChatMessageContent].
extension SocketIOChatMessageContentPatterns on SocketIOChatMessageContent {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SocketIOChatMessageContent value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SocketIOChatMessageContent() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SocketIOChatMessageContent value)  $default,){
final _that = this;
switch (_that) {
case _SocketIOChatMessageContent():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SocketIOChatMessageContent value)?  $default,){
final _that = this;
switch (_that) {
case _SocketIOChatMessageContent() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String message)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SocketIOChatMessageContent() when $default != null:
return $default(_that.message);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String message)  $default,) {final _that = this;
switch (_that) {
case _SocketIOChatMessageContent():
return $default(_that.message);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String message)?  $default,) {final _that = this;
switch (_that) {
case _SocketIOChatMessageContent() when $default != null:
return $default(_that.message);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SocketIOChatMessageContent implements SocketIOChatMessageContent {
  const _SocketIOChatMessageContent({required this.message});
  factory _SocketIOChatMessageContent.fromJson(Map<String, dynamic> json) => _$SocketIOChatMessageContentFromJson(json);

@override final  String message;

/// Create a copy of SocketIOChatMessageContent
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SocketIOChatMessageContentCopyWith<_SocketIOChatMessageContent> get copyWith => __$SocketIOChatMessageContentCopyWithImpl<_SocketIOChatMessageContent>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SocketIOChatMessageContentToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SocketIOChatMessageContent&&(identical(other.message, message) || other.message == message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,message);

@override
String toString() {
  return 'SocketIOChatMessageContent(message: $message)';
}


}

/// @nodoc
abstract mixin class _$SocketIOChatMessageContentCopyWith<$Res> implements $SocketIOChatMessageContentCopyWith<$Res> {
  factory _$SocketIOChatMessageContentCopyWith(_SocketIOChatMessageContent value, $Res Function(_SocketIOChatMessageContent) _then) = __$SocketIOChatMessageContentCopyWithImpl;
@override @useResult
$Res call({
 String message
});




}
/// @nodoc
class __$SocketIOChatMessageContentCopyWithImpl<$Res>
    implements _$SocketIOChatMessageContentCopyWith<$Res> {
  __$SocketIOChatMessageContentCopyWithImpl(this._self, this._then);

  final _SocketIOChatMessageContent _self;
  final $Res Function(_SocketIOChatMessageContent) _then;

/// Create a copy of SocketIOChatMessageContent
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? message = null,}) {
  return _then(_SocketIOChatMessageContent(
message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
