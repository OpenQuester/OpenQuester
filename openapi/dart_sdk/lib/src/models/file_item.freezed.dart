// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'file_item.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FileItem {

 int? get id;/// MD5 hash of the file
 String get md5; PackageFileType get type;/// GET link for file
 String? get link;
/// Create a copy of FileItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FileItemCopyWith<FileItem> get copyWith => _$FileItemCopyWithImpl<FileItem>(this as FileItem, _$identity);

  /// Serializes this FileItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FileItem&&(identical(other.id, id) || other.id == id)&&(identical(other.md5, md5) || other.md5 == md5)&&(identical(other.type, type) || other.type == type)&&(identical(other.link, link) || other.link == link));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,md5,type,link);

@override
String toString() {
  return 'FileItem(id: $id, md5: $md5, type: $type, link: $link)';
}


}

/// @nodoc
abstract mixin class $FileItemCopyWith<$Res>  {
  factory $FileItemCopyWith(FileItem value, $Res Function(FileItem) _then) = _$FileItemCopyWithImpl;
@useResult
$Res call({
 int? id, String md5, PackageFileType type, String? link
});




}
/// @nodoc
class _$FileItemCopyWithImpl<$Res>
    implements $FileItemCopyWith<$Res> {
  _$FileItemCopyWithImpl(this._self, this._then);

  final FileItem _self;
  final $Res Function(FileItem) _then;

/// Create a copy of FileItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = freezed,Object? md5 = null,Object? type = null,Object? link = freezed,}) {
  return _then(_self.copyWith(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,md5: null == md5 ? _self.md5 : md5 // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as PackageFileType,link: freezed == link ? _self.link : link // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [FileItem].
extension FileItemPatterns on FileItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FileItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FileItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FileItem value)  $default,){
final _that = this;
switch (_that) {
case _FileItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FileItem value)?  $default,){
final _that = this;
switch (_that) {
case _FileItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int? id,  String md5,  PackageFileType type,  String? link)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FileItem() when $default != null:
return $default(_that.id,_that.md5,_that.type,_that.link);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int? id,  String md5,  PackageFileType type,  String? link)  $default,) {final _that = this;
switch (_that) {
case _FileItem():
return $default(_that.id,_that.md5,_that.type,_that.link);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int? id,  String md5,  PackageFileType type,  String? link)?  $default,) {final _that = this;
switch (_that) {
case _FileItem() when $default != null:
return $default(_that.id,_that.md5,_that.type,_that.link);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FileItem implements FileItem {
  const _FileItem({required this.id, required this.md5, required this.type, required this.link});
  factory _FileItem.fromJson(Map<String, dynamic> json) => _$FileItemFromJson(json);

@override final  int? id;
/// MD5 hash of the file
@override final  String md5;
@override final  PackageFileType type;
/// GET link for file
@override final  String? link;

/// Create a copy of FileItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FileItemCopyWith<_FileItem> get copyWith => __$FileItemCopyWithImpl<_FileItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FileItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FileItem&&(identical(other.id, id) || other.id == id)&&(identical(other.md5, md5) || other.md5 == md5)&&(identical(other.type, type) || other.type == type)&&(identical(other.link, link) || other.link == link));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,md5,type,link);

@override
String toString() {
  return 'FileItem(id: $id, md5: $md5, type: $type, link: $link)';
}


}

/// @nodoc
abstract mixin class _$FileItemCopyWith<$Res> implements $FileItemCopyWith<$Res> {
  factory _$FileItemCopyWith(_FileItem value, $Res Function(_FileItem) _then) = __$FileItemCopyWithImpl;
@override @useResult
$Res call({
 int? id, String md5, PackageFileType type, String? link
});




}
/// @nodoc
class __$FileItemCopyWithImpl<$Res>
    implements _$FileItemCopyWith<$Res> {
  __$FileItemCopyWithImpl(this._self, this._then);

  final _FileItem _self;
  final $Res Function(_FileItem) _then;

/// Create a copy of FileItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = freezed,Object? md5 = null,Object? type = null,Object? link = freezed,}) {
  return _then(_FileItem(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,md5: null == md5 ? _self.md5 : md5 // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as PackageFileType,link: freezed == link ? _self.link : link // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
