// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'socket_io_game_join_meta.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SocketIOGameJoinMeta {

 String get title;
/// Create a copy of SocketIOGameJoinMeta
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SocketIOGameJoinMetaCopyWith<SocketIOGameJoinMeta> get copyWith => _$SocketIOGameJoinMetaCopyWithImpl<SocketIOGameJoinMeta>(this as SocketIOGameJoinMeta, _$identity);

  /// Serializes this SocketIOGameJoinMeta to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SocketIOGameJoinMeta&&(identical(other.title, title) || other.title == title));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,title);

@override
String toString() {
  return 'SocketIOGameJoinMeta(title: $title)';
}


}

/// @nodoc
abstract mixin class $SocketIOGameJoinMetaCopyWith<$Res>  {
  factory $SocketIOGameJoinMetaCopyWith(SocketIOGameJoinMeta value, $Res Function(SocketIOGameJoinMeta) _then) = _$SocketIOGameJoinMetaCopyWithImpl;
@useResult
$Res call({
 String title
});




}
/// @nodoc
class _$SocketIOGameJoinMetaCopyWithImpl<$Res>
    implements $SocketIOGameJoinMetaCopyWith<$Res> {
  _$SocketIOGameJoinMetaCopyWithImpl(this._self, this._then);

  final SocketIOGameJoinMeta _self;
  final $Res Function(SocketIOGameJoinMeta) _then;

/// Create a copy of SocketIOGameJoinMeta
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? title = null,}) {
  return _then(_self.copyWith(
title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [SocketIOGameJoinMeta].
extension SocketIOGameJoinMetaPatterns on SocketIOGameJoinMeta {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SocketIOGameJoinMeta value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SocketIOGameJoinMeta() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SocketIOGameJoinMeta value)  $default,){
final _that = this;
switch (_that) {
case _SocketIOGameJoinMeta():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SocketIOGameJoinMeta value)?  $default,){
final _that = this;
switch (_that) {
case _SocketIOGameJoinMeta() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String title)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SocketIOGameJoinMeta() when $default != null:
return $default(_that.title);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String title)  $default,) {final _that = this;
switch (_that) {
case _SocketIOGameJoinMeta():
return $default(_that.title);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String title)?  $default,) {final _that = this;
switch (_that) {
case _SocketIOGameJoinMeta() when $default != null:
return $default(_that.title);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SocketIOGameJoinMeta implements SocketIOGameJoinMeta {
  const _SocketIOGameJoinMeta({required this.title});
  factory _SocketIOGameJoinMeta.fromJson(Map<String, dynamic> json) => _$SocketIOGameJoinMetaFromJson(json);

@override final  String title;

/// Create a copy of SocketIOGameJoinMeta
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SocketIOGameJoinMetaCopyWith<_SocketIOGameJoinMeta> get copyWith => __$SocketIOGameJoinMetaCopyWithImpl<_SocketIOGameJoinMeta>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SocketIOGameJoinMetaToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SocketIOGameJoinMeta&&(identical(other.title, title) || other.title == title));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,title);

@override
String toString() {
  return 'SocketIOGameJoinMeta(title: $title)';
}


}

/// @nodoc
abstract mixin class _$SocketIOGameJoinMetaCopyWith<$Res> implements $SocketIOGameJoinMetaCopyWith<$Res> {
  factory _$SocketIOGameJoinMetaCopyWith(_SocketIOGameJoinMeta value, $Res Function(_SocketIOGameJoinMeta) _then) = __$SocketIOGameJoinMetaCopyWithImpl;
@override @useResult
$Res call({
 String title
});




}
/// @nodoc
class __$SocketIOGameJoinMetaCopyWithImpl<$Res>
    implements _$SocketIOGameJoinMetaCopyWith<$Res> {
  __$SocketIOGameJoinMetaCopyWithImpl(this._self, this._then);

  final _SocketIOGameJoinMeta _self;
  final $Res Function(_SocketIOGameJoinMeta) _then;

/// Create a copy of SocketIOGameJoinMeta
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? title = null,}) {
  return _then(_SocketIOGameJoinMeta(
title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
