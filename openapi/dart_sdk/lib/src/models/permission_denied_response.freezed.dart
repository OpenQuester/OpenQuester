// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'permission_denied_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PermissionDeniedResponse {

 String get error;
/// Create a copy of PermissionDeniedResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PermissionDeniedResponseCopyWith<PermissionDeniedResponse> get copyWith => _$PermissionDeniedResponseCopyWithImpl<PermissionDeniedResponse>(this as PermissionDeniedResponse, _$identity);

  /// Serializes this PermissionDeniedResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PermissionDeniedResponse&&(identical(other.error, error) || other.error == error));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,error);

@override
String toString() {
  return 'PermissionDeniedResponse(error: $error)';
}


}

/// @nodoc
abstract mixin class $PermissionDeniedResponseCopyWith<$Res>  {
  factory $PermissionDeniedResponseCopyWith(PermissionDeniedResponse value, $Res Function(PermissionDeniedResponse) _then) = _$PermissionDeniedResponseCopyWithImpl;
@useResult
$Res call({
 String error
});




}
/// @nodoc
class _$PermissionDeniedResponseCopyWithImpl<$Res>
    implements $PermissionDeniedResponseCopyWith<$Res> {
  _$PermissionDeniedResponseCopyWithImpl(this._self, this._then);

  final PermissionDeniedResponse _self;
  final $Res Function(PermissionDeniedResponse) _then;

/// Create a copy of PermissionDeniedResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? error = null,}) {
  return _then(_self.copyWith(
error: null == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [PermissionDeniedResponse].
extension PermissionDeniedResponsePatterns on PermissionDeniedResponse {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PermissionDeniedResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PermissionDeniedResponse() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PermissionDeniedResponse value)  $default,){
final _that = this;
switch (_that) {
case _PermissionDeniedResponse():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PermissionDeniedResponse value)?  $default,){
final _that = this;
switch (_that) {
case _PermissionDeniedResponse() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String error)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PermissionDeniedResponse() when $default != null:
return $default(_that.error);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String error)  $default,) {final _that = this;
switch (_that) {
case _PermissionDeniedResponse():
return $default(_that.error);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String error)?  $default,) {final _that = this;
switch (_that) {
case _PermissionDeniedResponse() when $default != null:
return $default(_that.error);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PermissionDeniedResponse implements PermissionDeniedResponse {
  const _PermissionDeniedResponse({required this.error});
  factory _PermissionDeniedResponse.fromJson(Map<String, dynamic> json) => _$PermissionDeniedResponseFromJson(json);

@override final  String error;

/// Create a copy of PermissionDeniedResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PermissionDeniedResponseCopyWith<_PermissionDeniedResponse> get copyWith => __$PermissionDeniedResponseCopyWithImpl<_PermissionDeniedResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PermissionDeniedResponseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PermissionDeniedResponse&&(identical(other.error, error) || other.error == error));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,error);

@override
String toString() {
  return 'PermissionDeniedResponse(error: $error)';
}


}

/// @nodoc
abstract mixin class _$PermissionDeniedResponseCopyWith<$Res> implements $PermissionDeniedResponseCopyWith<$Res> {
  factory _$PermissionDeniedResponseCopyWith(_PermissionDeniedResponse value, $Res Function(_PermissionDeniedResponse) _then) = __$PermissionDeniedResponseCopyWithImpl;
@override @useResult
$Res call({
 String error
});




}
/// @nodoc
class __$PermissionDeniedResponseCopyWithImpl<$Res>
    implements _$PermissionDeniedResponseCopyWith<$Res> {
  __$PermissionDeniedResponseCopyWithImpl(this._self, this._then);

  final _PermissionDeniedResponse _self;
  final $Res Function(_PermissionDeniedResponse) _then;

/// Create a copy of PermissionDeniedResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? error = null,}) {
  return _then(_PermissionDeniedResponse(
error: null == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
