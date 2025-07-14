// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'input_socket_io_auth.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$InputSocketIOAuth {

 String get socketId;
/// Create a copy of InputSocketIOAuth
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$InputSocketIOAuthCopyWith<InputSocketIOAuth> get copyWith => _$InputSocketIOAuthCopyWithImpl<InputSocketIOAuth>(this as InputSocketIOAuth, _$identity);

  /// Serializes this InputSocketIOAuth to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is InputSocketIOAuth&&(identical(other.socketId, socketId) || other.socketId == socketId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,socketId);

@override
String toString() {
  return 'InputSocketIOAuth(socketId: $socketId)';
}


}

/// @nodoc
abstract mixin class $InputSocketIOAuthCopyWith<$Res>  {
  factory $InputSocketIOAuthCopyWith(InputSocketIOAuth value, $Res Function(InputSocketIOAuth) _then) = _$InputSocketIOAuthCopyWithImpl;
@useResult
$Res call({
 String socketId
});




}
/// @nodoc
class _$InputSocketIOAuthCopyWithImpl<$Res>
    implements $InputSocketIOAuthCopyWith<$Res> {
  _$InputSocketIOAuthCopyWithImpl(this._self, this._then);

  final InputSocketIOAuth _self;
  final $Res Function(InputSocketIOAuth) _then;

/// Create a copy of InputSocketIOAuth
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? socketId = null,}) {
  return _then(_self.copyWith(
socketId: null == socketId ? _self.socketId : socketId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [InputSocketIOAuth].
extension InputSocketIOAuthPatterns on InputSocketIOAuth {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _InputSocketIOAuth value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _InputSocketIOAuth() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _InputSocketIOAuth value)  $default,){
final _that = this;
switch (_that) {
case _InputSocketIOAuth():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _InputSocketIOAuth value)?  $default,){
final _that = this;
switch (_that) {
case _InputSocketIOAuth() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String socketId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _InputSocketIOAuth() when $default != null:
return $default(_that.socketId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String socketId)  $default,) {final _that = this;
switch (_that) {
case _InputSocketIOAuth():
return $default(_that.socketId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String socketId)?  $default,) {final _that = this;
switch (_that) {
case _InputSocketIOAuth() when $default != null:
return $default(_that.socketId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _InputSocketIOAuth implements InputSocketIOAuth {
  const _InputSocketIOAuth({required this.socketId});
  factory _InputSocketIOAuth.fromJson(Map<String, dynamic> json) => _$InputSocketIOAuthFromJson(json);

@override final  String socketId;

/// Create a copy of InputSocketIOAuth
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$InputSocketIOAuthCopyWith<_InputSocketIOAuth> get copyWith => __$InputSocketIOAuthCopyWithImpl<_InputSocketIOAuth>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$InputSocketIOAuthToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _InputSocketIOAuth&&(identical(other.socketId, socketId) || other.socketId == socketId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,socketId);

@override
String toString() {
  return 'InputSocketIOAuth(socketId: $socketId)';
}


}

/// @nodoc
abstract mixin class _$InputSocketIOAuthCopyWith<$Res> implements $InputSocketIOAuthCopyWith<$Res> {
  factory _$InputSocketIOAuthCopyWith(_InputSocketIOAuth value, $Res Function(_InputSocketIOAuth) _then) = __$InputSocketIOAuthCopyWithImpl;
@override @useResult
$Res call({
 String socketId
});




}
/// @nodoc
class __$InputSocketIOAuthCopyWithImpl<$Res>
    implements _$InputSocketIOAuthCopyWith<$Res> {
  __$InputSocketIOAuthCopyWithImpl(this._self, this._then);

  final _InputSocketIOAuth _self;
  final $Res Function(_InputSocketIOAuth) _then;

/// Create a copy of InputSocketIOAuth
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? socketId = null,}) {
  return _then(_InputSocketIOAuth(
socketId: null == socketId ? _self.socketId : socketId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
