// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_logo_file_input.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageLogoFileInput {

 FileInput get file;
/// Create a copy of PackageLogoFileInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageLogoFileInputCopyWith<PackageLogoFileInput> get copyWith => _$PackageLogoFileInputCopyWithImpl<PackageLogoFileInput>(this as PackageLogoFileInput, _$identity);

  /// Serializes this PackageLogoFileInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageLogoFileInput&&(identical(other.file, file) || other.file == file));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,file);

@override
String toString() {
  return 'PackageLogoFileInput(file: $file)';
}


}

/// @nodoc
abstract mixin class $PackageLogoFileInputCopyWith<$Res>  {
  factory $PackageLogoFileInputCopyWith(PackageLogoFileInput value, $Res Function(PackageLogoFileInput) _then) = _$PackageLogoFileInputCopyWithImpl;
@useResult
$Res call({
 FileInput file
});


$FileInputCopyWith<$Res> get file;

}
/// @nodoc
class _$PackageLogoFileInputCopyWithImpl<$Res>
    implements $PackageLogoFileInputCopyWith<$Res> {
  _$PackageLogoFileInputCopyWithImpl(this._self, this._then);

  final PackageLogoFileInput _self;
  final $Res Function(PackageLogoFileInput) _then;

/// Create a copy of PackageLogoFileInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? file = null,}) {
  return _then(_self.copyWith(
file: null == file ? _self.file : file // ignore: cast_nullable_to_non_nullable
as FileInput,
  ));
}
/// Create a copy of PackageLogoFileInput
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FileInputCopyWith<$Res> get file {
  
  return $FileInputCopyWith<$Res>(_self.file, (value) {
    return _then(_self.copyWith(file: value));
  });
}
}


/// Adds pattern-matching-related methods to [PackageLogoFileInput].
extension PackageLogoFileInputPatterns on PackageLogoFileInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PackageLogoFileInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PackageLogoFileInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PackageLogoFileInput value)  $default,){
final _that = this;
switch (_that) {
case _PackageLogoFileInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PackageLogoFileInput value)?  $default,){
final _that = this;
switch (_that) {
case _PackageLogoFileInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( FileInput file)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PackageLogoFileInput() when $default != null:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( FileInput file)  $default,) {final _that = this;
switch (_that) {
case _PackageLogoFileInput():
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( FileInput file)?  $default,) {final _that = this;
switch (_that) {
case _PackageLogoFileInput() when $default != null:
return $default(_that.file);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PackageLogoFileInput implements PackageLogoFileInput {
  const _PackageLogoFileInput({required this.file});
  factory _PackageLogoFileInput.fromJson(Map<String, dynamic> json) => _$PackageLogoFileInputFromJson(json);

@override final  FileInput file;

/// Create a copy of PackageLogoFileInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PackageLogoFileInputCopyWith<_PackageLogoFileInput> get copyWith => __$PackageLogoFileInputCopyWithImpl<_PackageLogoFileInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageLogoFileInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PackageLogoFileInput&&(identical(other.file, file) || other.file == file));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,file);

@override
String toString() {
  return 'PackageLogoFileInput(file: $file)';
}


}

/// @nodoc
abstract mixin class _$PackageLogoFileInputCopyWith<$Res> implements $PackageLogoFileInputCopyWith<$Res> {
  factory _$PackageLogoFileInputCopyWith(_PackageLogoFileInput value, $Res Function(_PackageLogoFileInput) _then) = __$PackageLogoFileInputCopyWithImpl;
@override @useResult
$Res call({
 FileInput file
});


@override $FileInputCopyWith<$Res> get file;

}
/// @nodoc
class __$PackageLogoFileInputCopyWithImpl<$Res>
    implements _$PackageLogoFileInputCopyWith<$Res> {
  __$PackageLogoFileInputCopyWithImpl(this._self, this._then);

  final _PackageLogoFileInput _self;
  final $Res Function(_PackageLogoFileInput) _then;

/// Create a copy of PackageLogoFileInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? file = null,}) {
  return _then(_PackageLogoFileInput(
file: null == file ? _self.file : file // ignore: cast_nullable_to_non_nullable
as FileInput,
  ));
}

/// Create a copy of PackageLogoFileInput
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FileInputCopyWith<$Res> get file {
  
  return $FileInputCopyWith<$Res>(_self.file, (value) {
    return _then(_self.copyWith(file: value));
  });
}
}

// dart format on
