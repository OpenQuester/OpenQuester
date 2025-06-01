// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
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
