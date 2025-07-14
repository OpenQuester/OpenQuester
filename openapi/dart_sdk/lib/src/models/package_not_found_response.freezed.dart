// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_not_found_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageNotFoundResponse {

 String get error;
/// Create a copy of PackageNotFoundResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageNotFoundResponseCopyWith<PackageNotFoundResponse> get copyWith => _$PackageNotFoundResponseCopyWithImpl<PackageNotFoundResponse>(this as PackageNotFoundResponse, _$identity);

  /// Serializes this PackageNotFoundResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageNotFoundResponse&&(identical(other.error, error) || other.error == error));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,error);

@override
String toString() {
  return 'PackageNotFoundResponse(error: $error)';
}


}

/// @nodoc
abstract mixin class $PackageNotFoundResponseCopyWith<$Res>  {
  factory $PackageNotFoundResponseCopyWith(PackageNotFoundResponse value, $Res Function(PackageNotFoundResponse) _then) = _$PackageNotFoundResponseCopyWithImpl;
@useResult
$Res call({
 String error
});




}
/// @nodoc
class _$PackageNotFoundResponseCopyWithImpl<$Res>
    implements $PackageNotFoundResponseCopyWith<$Res> {
  _$PackageNotFoundResponseCopyWithImpl(this._self, this._then);

  final PackageNotFoundResponse _self;
  final $Res Function(PackageNotFoundResponse) _then;

/// Create a copy of PackageNotFoundResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? error = null,}) {
  return _then(_self.copyWith(
error: null == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [PackageNotFoundResponse].
extension PackageNotFoundResponsePatterns on PackageNotFoundResponse {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PackageNotFoundResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PackageNotFoundResponse() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PackageNotFoundResponse value)  $default,){
final _that = this;
switch (_that) {
case _PackageNotFoundResponse():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PackageNotFoundResponse value)?  $default,){
final _that = this;
switch (_that) {
case _PackageNotFoundResponse() when $default != null:
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
case _PackageNotFoundResponse() when $default != null:
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
case _PackageNotFoundResponse():
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
case _PackageNotFoundResponse() when $default != null:
return $default(_that.error);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PackageNotFoundResponse implements PackageNotFoundResponse {
  const _PackageNotFoundResponse({required this.error});
  factory _PackageNotFoundResponse.fromJson(Map<String, dynamic> json) => _$PackageNotFoundResponseFromJson(json);

@override final  String error;

/// Create a copy of PackageNotFoundResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PackageNotFoundResponseCopyWith<_PackageNotFoundResponse> get copyWith => __$PackageNotFoundResponseCopyWithImpl<_PackageNotFoundResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageNotFoundResponseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PackageNotFoundResponse&&(identical(other.error, error) || other.error == error));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,error);

@override
String toString() {
  return 'PackageNotFoundResponse(error: $error)';
}


}

/// @nodoc
abstract mixin class _$PackageNotFoundResponseCopyWith<$Res> implements $PackageNotFoundResponseCopyWith<$Res> {
  factory _$PackageNotFoundResponseCopyWith(_PackageNotFoundResponse value, $Res Function(_PackageNotFoundResponse) _then) = __$PackageNotFoundResponseCopyWithImpl;
@override @useResult
$Res call({
 String error
});




}
/// @nodoc
class __$PackageNotFoundResponseCopyWithImpl<$Res>
    implements _$PackageNotFoundResponseCopyWith<$Res> {
  __$PackageNotFoundResponseCopyWithImpl(this._self, this._then);

  final _PackageNotFoundResponse _self;
  final $Res Function(_PackageNotFoundResponse) _then;

/// Create a copy of PackageNotFoundResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? error = null,}) {
  return _then(_PackageNotFoundResponse(
error: null == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
