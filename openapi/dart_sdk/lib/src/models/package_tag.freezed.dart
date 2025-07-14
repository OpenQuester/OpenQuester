// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_tag.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageTag {

 int get id;/// A single tag for the package
 String get tag;
/// Create a copy of PackageTag
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageTagCopyWith<PackageTag> get copyWith => _$PackageTagCopyWithImpl<PackageTag>(this as PackageTag, _$identity);

  /// Serializes this PackageTag to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageTag&&(identical(other.id, id) || other.id == id)&&(identical(other.tag, tag) || other.tag == tag));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,tag);

@override
String toString() {
  return 'PackageTag(id: $id, tag: $tag)';
}


}

/// @nodoc
abstract mixin class $PackageTagCopyWith<$Res>  {
  factory $PackageTagCopyWith(PackageTag value, $Res Function(PackageTag) _then) = _$PackageTagCopyWithImpl;
@useResult
$Res call({
 int id, String tag
});




}
/// @nodoc
class _$PackageTagCopyWithImpl<$Res>
    implements $PackageTagCopyWith<$Res> {
  _$PackageTagCopyWithImpl(this._self, this._then);

  final PackageTag _self;
  final $Res Function(PackageTag) _then;

/// Create a copy of PackageTag
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? tag = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,tag: null == tag ? _self.tag : tag // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [PackageTag].
extension PackageTagPatterns on PackageTag {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PackageTag value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PackageTag() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PackageTag value)  $default,){
final _that = this;
switch (_that) {
case _PackageTag():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PackageTag value)?  $default,){
final _that = this;
switch (_that) {
case _PackageTag() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String tag)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PackageTag() when $default != null:
return $default(_that.id,_that.tag);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String tag)  $default,) {final _that = this;
switch (_that) {
case _PackageTag():
return $default(_that.id,_that.tag);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String tag)?  $default,) {final _that = this;
switch (_that) {
case _PackageTag() when $default != null:
return $default(_that.id,_that.tag);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PackageTag implements PackageTag {
  const _PackageTag({required this.id, required this.tag});
  factory _PackageTag.fromJson(Map<String, dynamic> json) => _$PackageTagFromJson(json);

@override final  int id;
/// A single tag for the package
@override final  String tag;

/// Create a copy of PackageTag
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PackageTagCopyWith<_PackageTag> get copyWith => __$PackageTagCopyWithImpl<_PackageTag>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageTagToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PackageTag&&(identical(other.id, id) || other.id == id)&&(identical(other.tag, tag) || other.tag == tag));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,tag);

@override
String toString() {
  return 'PackageTag(id: $id, tag: $tag)';
}


}

/// @nodoc
abstract mixin class _$PackageTagCopyWith<$Res> implements $PackageTagCopyWith<$Res> {
  factory _$PackageTagCopyWith(_PackageTag value, $Res Function(_PackageTag) _then) = __$PackageTagCopyWithImpl;
@override @useResult
$Res call({
 int id, String tag
});




}
/// @nodoc
class __$PackageTagCopyWithImpl<$Res>
    implements _$PackageTagCopyWith<$Res> {
  __$PackageTagCopyWithImpl(this._self, this._then);

  final _PackageTag _self;
  final $Res Function(_PackageTag) _then;

/// Create a copy of PackageTag
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? tag = null,}) {
  return _then(_PackageTag(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,tag: null == tag ? _self.tag : tag // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
