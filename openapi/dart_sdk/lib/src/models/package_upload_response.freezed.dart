// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_upload_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageUploadResponse {

 int get id; Map<String, String> get uploadLinks;
/// Create a copy of PackageUploadResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageUploadResponseCopyWith<PackageUploadResponse> get copyWith => _$PackageUploadResponseCopyWithImpl<PackageUploadResponse>(this as PackageUploadResponse, _$identity);

  /// Serializes this PackageUploadResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageUploadResponse&&(identical(other.id, id) || other.id == id)&&const DeepCollectionEquality().equals(other.uploadLinks, uploadLinks));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,const DeepCollectionEquality().hash(uploadLinks));

@override
String toString() {
  return 'PackageUploadResponse(id: $id, uploadLinks: $uploadLinks)';
}


}

/// @nodoc
abstract mixin class $PackageUploadResponseCopyWith<$Res>  {
  factory $PackageUploadResponseCopyWith(PackageUploadResponse value, $Res Function(PackageUploadResponse) _then) = _$PackageUploadResponseCopyWithImpl;
@useResult
$Res call({
 int id, Map<String, String> uploadLinks
});




}
/// @nodoc
class _$PackageUploadResponseCopyWithImpl<$Res>
    implements $PackageUploadResponseCopyWith<$Res> {
  _$PackageUploadResponseCopyWithImpl(this._self, this._then);

  final PackageUploadResponse _self;
  final $Res Function(PackageUploadResponse) _then;

/// Create a copy of PackageUploadResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? uploadLinks = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,uploadLinks: null == uploadLinks ? _self.uploadLinks : uploadLinks // ignore: cast_nullable_to_non_nullable
as Map<String, String>,
  ));
}

}


/// Adds pattern-matching-related methods to [PackageUploadResponse].
extension PackageUploadResponsePatterns on PackageUploadResponse {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PackageUploadResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PackageUploadResponse() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PackageUploadResponse value)  $default,){
final _that = this;
switch (_that) {
case _PackageUploadResponse():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PackageUploadResponse value)?  $default,){
final _that = this;
switch (_that) {
case _PackageUploadResponse() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  Map<String, String> uploadLinks)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PackageUploadResponse() when $default != null:
return $default(_that.id,_that.uploadLinks);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  Map<String, String> uploadLinks)  $default,) {final _that = this;
switch (_that) {
case _PackageUploadResponse():
return $default(_that.id,_that.uploadLinks);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  Map<String, String> uploadLinks)?  $default,) {final _that = this;
switch (_that) {
case _PackageUploadResponse() when $default != null:
return $default(_that.id,_that.uploadLinks);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PackageUploadResponse implements PackageUploadResponse {
  const _PackageUploadResponse({required this.id, required final  Map<String, String> uploadLinks}): _uploadLinks = uploadLinks;
  factory _PackageUploadResponse.fromJson(Map<String, dynamic> json) => _$PackageUploadResponseFromJson(json);

@override final  int id;
 final  Map<String, String> _uploadLinks;
@override Map<String, String> get uploadLinks {
  if (_uploadLinks is EqualUnmodifiableMapView) return _uploadLinks;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_uploadLinks);
}


/// Create a copy of PackageUploadResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PackageUploadResponseCopyWith<_PackageUploadResponse> get copyWith => __$PackageUploadResponseCopyWithImpl<_PackageUploadResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageUploadResponseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PackageUploadResponse&&(identical(other.id, id) || other.id == id)&&const DeepCollectionEquality().equals(other._uploadLinks, _uploadLinks));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,const DeepCollectionEquality().hash(_uploadLinks));

@override
String toString() {
  return 'PackageUploadResponse(id: $id, uploadLinks: $uploadLinks)';
}


}

/// @nodoc
abstract mixin class _$PackageUploadResponseCopyWith<$Res> implements $PackageUploadResponseCopyWith<$Res> {
  factory _$PackageUploadResponseCopyWith(_PackageUploadResponse value, $Res Function(_PackageUploadResponse) _then) = __$PackageUploadResponseCopyWithImpl;
@override @useResult
$Res call({
 int id, Map<String, String> uploadLinks
});




}
/// @nodoc
class __$PackageUploadResponseCopyWithImpl<$Res>
    implements _$PackageUploadResponseCopyWith<$Res> {
  __$PackageUploadResponseCopyWithImpl(this._self, this._then);

  final _PackageUploadResponse _self;
  final $Res Function(_PackageUploadResponse) _then;

/// Create a copy of PackageUploadResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? uploadLinks = null,}) {
  return _then(_PackageUploadResponse(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,uploadLinks: null == uploadLinks ? _self._uploadLinks : uploadLinks // ignore: cast_nullable_to_non_nullable
as Map<String, String>,
  ));
}


}

// dart format on
