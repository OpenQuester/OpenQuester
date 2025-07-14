// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_question_file.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageQuestionFile {

 int? get id; PackageEntitiesOrder get order; FileItem get file;/// Display duration in milliseconds
 int? get displayTime;
/// Create a copy of PackageQuestionFile
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageQuestionFileCopyWith<PackageQuestionFile> get copyWith => _$PackageQuestionFileCopyWithImpl<PackageQuestionFile>(this as PackageQuestionFile, _$identity);

  /// Serializes this PackageQuestionFile to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageQuestionFile&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.file, file) || other.file == file)&&(identical(other.displayTime, displayTime) || other.displayTime == displayTime));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,file,displayTime);

@override
String toString() {
  return 'PackageQuestionFile(id: $id, order: $order, file: $file, displayTime: $displayTime)';
}


}

/// @nodoc
abstract mixin class $PackageQuestionFileCopyWith<$Res>  {
  factory $PackageQuestionFileCopyWith(PackageQuestionFile value, $Res Function(PackageQuestionFile) _then) = _$PackageQuestionFileCopyWithImpl;
@useResult
$Res call({
 int? id, PackageEntitiesOrder order, FileItem file, int? displayTime
});


$FileItemCopyWith<$Res> get file;

}
/// @nodoc
class _$PackageQuestionFileCopyWithImpl<$Res>
    implements $PackageQuestionFileCopyWith<$Res> {
  _$PackageQuestionFileCopyWithImpl(this._self, this._then);

  final PackageQuestionFile _self;
  final $Res Function(PackageQuestionFile) _then;

/// Create a copy of PackageQuestionFile
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = freezed,Object? order = null,Object? file = null,Object? displayTime = freezed,}) {
  return _then(_self.copyWith(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,file: null == file ? _self.file : file // ignore: cast_nullable_to_non_nullable
as FileItem,displayTime: freezed == displayTime ? _self.displayTime : displayTime // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}
/// Create a copy of PackageQuestionFile
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FileItemCopyWith<$Res> get file {
  
  return $FileItemCopyWith<$Res>(_self.file, (value) {
    return _then(_self.copyWith(file: value));
  });
}
}


/// Adds pattern-matching-related methods to [PackageQuestionFile].
extension PackageQuestionFilePatterns on PackageQuestionFile {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PackageQuestionFile value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PackageQuestionFile() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PackageQuestionFile value)  $default,){
final _that = this;
switch (_that) {
case _PackageQuestionFile():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PackageQuestionFile value)?  $default,){
final _that = this;
switch (_that) {
case _PackageQuestionFile() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int? id,  PackageEntitiesOrder order,  FileItem file,  int? displayTime)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PackageQuestionFile() when $default != null:
return $default(_that.id,_that.order,_that.file,_that.displayTime);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int? id,  PackageEntitiesOrder order,  FileItem file,  int? displayTime)  $default,) {final _that = this;
switch (_that) {
case _PackageQuestionFile():
return $default(_that.id,_that.order,_that.file,_that.displayTime);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int? id,  PackageEntitiesOrder order,  FileItem file,  int? displayTime)?  $default,) {final _that = this;
switch (_that) {
case _PackageQuestionFile() when $default != null:
return $default(_that.id,_that.order,_that.file,_that.displayTime);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PackageQuestionFile implements PackageQuestionFile {
  const _PackageQuestionFile({required this.id, required this.order, required this.file, required this.displayTime});
  factory _PackageQuestionFile.fromJson(Map<String, dynamic> json) => _$PackageQuestionFileFromJson(json);

@override final  int? id;
@override final  PackageEntitiesOrder order;
@override final  FileItem file;
/// Display duration in milliseconds
@override final  int? displayTime;

/// Create a copy of PackageQuestionFile
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PackageQuestionFileCopyWith<_PackageQuestionFile> get copyWith => __$PackageQuestionFileCopyWithImpl<_PackageQuestionFile>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageQuestionFileToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PackageQuestionFile&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.file, file) || other.file == file)&&(identical(other.displayTime, displayTime) || other.displayTime == displayTime));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,file,displayTime);

@override
String toString() {
  return 'PackageQuestionFile(id: $id, order: $order, file: $file, displayTime: $displayTime)';
}


}

/// @nodoc
abstract mixin class _$PackageQuestionFileCopyWith<$Res> implements $PackageQuestionFileCopyWith<$Res> {
  factory _$PackageQuestionFileCopyWith(_PackageQuestionFile value, $Res Function(_PackageQuestionFile) _then) = __$PackageQuestionFileCopyWithImpl;
@override @useResult
$Res call({
 int? id, PackageEntitiesOrder order, FileItem file, int? displayTime
});


@override $FileItemCopyWith<$Res> get file;

}
/// @nodoc
class __$PackageQuestionFileCopyWithImpl<$Res>
    implements _$PackageQuestionFileCopyWith<$Res> {
  __$PackageQuestionFileCopyWithImpl(this._self, this._then);

  final _PackageQuestionFile _self;
  final $Res Function(_PackageQuestionFile) _then;

/// Create a copy of PackageQuestionFile
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = freezed,Object? order = null,Object? file = null,Object? displayTime = freezed,}) {
  return _then(_PackageQuestionFile(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,file: null == file ? _self.file : file // ignore: cast_nullable_to_non_nullable
as FileItem,displayTime: freezed == displayTime ? _self.displayTime : displayTime // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

/// Create a copy of PackageQuestionFile
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
