// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'file_input.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FileInput {

/// MD5 hash of the file
 String get md5; PackageFileType get type;
/// Create a copy of FileInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FileInputCopyWith<FileInput> get copyWith => _$FileInputCopyWithImpl<FileInput>(this as FileInput, _$identity);

  /// Serializes this FileInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FileInput&&(identical(other.md5, md5) || other.md5 == md5)&&(identical(other.type, type) || other.type == type));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,md5,type);

@override
String toString() {
  return 'FileInput(md5: $md5, type: $type)';
}


}

/// @nodoc
abstract mixin class $FileInputCopyWith<$Res>  {
  factory $FileInputCopyWith(FileInput value, $Res Function(FileInput) _then) = _$FileInputCopyWithImpl;
@useResult
$Res call({
 String md5, PackageFileType type
});




}
/// @nodoc
class _$FileInputCopyWithImpl<$Res>
    implements $FileInputCopyWith<$Res> {
  _$FileInputCopyWithImpl(this._self, this._then);

  final FileInput _self;
  final $Res Function(FileInput) _then;

/// Create a copy of FileInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? md5 = null,Object? type = null,}) {
  return _then(_self.copyWith(
md5: null == md5 ? _self.md5 : md5 // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as PackageFileType,
  ));
}

}


/// Adds pattern-matching-related methods to [FileInput].
extension FileInputPatterns on FileInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FileInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FileInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FileInput value)  $default,){
final _that = this;
switch (_that) {
case _FileInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FileInput value)?  $default,){
final _that = this;
switch (_that) {
case _FileInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String md5,  PackageFileType type)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FileInput() when $default != null:
return $default(_that.md5,_that.type);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String md5,  PackageFileType type)  $default,) {final _that = this;
switch (_that) {
case _FileInput():
return $default(_that.md5,_that.type);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String md5,  PackageFileType type)?  $default,) {final _that = this;
switch (_that) {
case _FileInput() when $default != null:
return $default(_that.md5,_that.type);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FileInput implements FileInput {
  const _FileInput({required this.md5, required this.type});
  factory _FileInput.fromJson(Map<String, dynamic> json) => _$FileInputFromJson(json);

/// MD5 hash of the file
@override final  String md5;
@override final  PackageFileType type;

/// Create a copy of FileInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FileInputCopyWith<_FileInput> get copyWith => __$FileInputCopyWithImpl<_FileInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FileInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FileInput&&(identical(other.md5, md5) || other.md5 == md5)&&(identical(other.type, type) || other.type == type));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,md5,type);

@override
String toString() {
  return 'FileInput(md5: $md5, type: $type)';
}


}

/// @nodoc
abstract mixin class _$FileInputCopyWith<$Res> implements $FileInputCopyWith<$Res> {
  factory _$FileInputCopyWith(_FileInput value, $Res Function(_FileInput) _then) = __$FileInputCopyWithImpl;
@override @useResult
$Res call({
 String md5, PackageFileType type
});




}
/// @nodoc
class __$FileInputCopyWithImpl<$Res>
    implements _$FileInputCopyWith<$Res> {
  __$FileInputCopyWithImpl(this._self, this._then);

  final _FileInput _self;
  final $Res Function(_FileInput) _then;

/// Create a copy of FileInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? md5 = null,Object? type = null,}) {
  return _then(_FileInput(
md5: null == md5 ? _self.md5 : md5 // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as PackageFileType,
  ));
}


}

// dart format on
