// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_logo_file_item.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageLogoFileItem {

 FileItem get file;
/// Create a copy of PackageLogoFileItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageLogoFileItemCopyWith<PackageLogoFileItem> get copyWith => _$PackageLogoFileItemCopyWithImpl<PackageLogoFileItem>(this as PackageLogoFileItem, _$identity);

  /// Serializes this PackageLogoFileItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageLogoFileItem&&(identical(other.file, file) || other.file == file));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,file);

@override
String toString() {
  return 'PackageLogoFileItem(file: $file)';
}


}

/// @nodoc
abstract mixin class $PackageLogoFileItemCopyWith<$Res>  {
  factory $PackageLogoFileItemCopyWith(PackageLogoFileItem value, $Res Function(PackageLogoFileItem) _then) = _$PackageLogoFileItemCopyWithImpl;
@useResult
$Res call({
 FileItem file
});


$FileItemCopyWith<$Res> get file;

}
/// @nodoc
class _$PackageLogoFileItemCopyWithImpl<$Res>
    implements $PackageLogoFileItemCopyWith<$Res> {
  _$PackageLogoFileItemCopyWithImpl(this._self, this._then);

  final PackageLogoFileItem _self;
  final $Res Function(PackageLogoFileItem) _then;

/// Create a copy of PackageLogoFileItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? file = null,}) {
  return _then(_self.copyWith(
file: null == file ? _self.file : file // ignore: cast_nullable_to_non_nullable
as FileItem,
  ));
}
/// Create a copy of PackageLogoFileItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FileItemCopyWith<$Res> get file {
  
  return $FileItemCopyWith<$Res>(_self.file, (value) {
    return _then(_self.copyWith(file: value));
  });
}
}


/// Adds pattern-matching-related methods to [PackageLogoFileItem].
extension PackageLogoFileItemPatterns on PackageLogoFileItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PackageLogoFileItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PackageLogoFileItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PackageLogoFileItem value)  $default,){
final _that = this;
switch (_that) {
case _PackageLogoFileItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PackageLogoFileItem value)?  $default,){
final _that = this;
switch (_that) {
case _PackageLogoFileItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( FileItem file)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PackageLogoFileItem() when $default != null:
return $default(_that.file);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( FileItem file)  $default,) {final _that = this;
switch (_that) {
case _PackageLogoFileItem():
return $default(_that.file);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( FileItem file)?  $default,) {final _that = this;
switch (_that) {
case _PackageLogoFileItem() when $default != null:
return $default(_that.file);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PackageLogoFileItem implements PackageLogoFileItem {
  const _PackageLogoFileItem({required this.file});
  factory _PackageLogoFileItem.fromJson(Map<String, dynamic> json) => _$PackageLogoFileItemFromJson(json);

@override final  FileItem file;

/// Create a copy of PackageLogoFileItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PackageLogoFileItemCopyWith<_PackageLogoFileItem> get copyWith => __$PackageLogoFileItemCopyWithImpl<_PackageLogoFileItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageLogoFileItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PackageLogoFileItem&&(identical(other.file, file) || other.file == file));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,file);

@override
String toString() {
  return 'PackageLogoFileItem(file: $file)';
}


}

/// @nodoc
abstract mixin class _$PackageLogoFileItemCopyWith<$Res> implements $PackageLogoFileItemCopyWith<$Res> {
  factory _$PackageLogoFileItemCopyWith(_PackageLogoFileItem value, $Res Function(_PackageLogoFileItem) _then) = __$PackageLogoFileItemCopyWithImpl;
@override @useResult
$Res call({
 FileItem file
});


@override $FileItemCopyWith<$Res> get file;

}
/// @nodoc
class __$PackageLogoFileItemCopyWithImpl<$Res>
    implements _$PackageLogoFileItemCopyWith<$Res> {
  __$PackageLogoFileItemCopyWithImpl(this._self, this._then);

  final _PackageLogoFileItem _self;
  final $Res Function(_PackageLogoFileItem) _then;

/// Create a copy of PackageLogoFileItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? file = null,}) {
  return _then(_PackageLogoFileItem(
file: null == file ? _self.file : file // ignore: cast_nullable_to_non_nullable
as FileItem,
  ));
}

/// Create a copy of PackageLogoFileItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FileItemCopyWith<$Res> get file {
  
  return $FileItemCopyWith<$Res>(_self.file, (value) {
    return _then(_self.copyWith(file: value));
  });
}
}

// dart format on
