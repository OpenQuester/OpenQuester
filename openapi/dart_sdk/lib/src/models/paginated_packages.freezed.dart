// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'paginated_packages.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PaginatedPackages {

 List<PackageListItem> get data; PageInfo get pageInfo;
/// Create a copy of PaginatedPackages
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PaginatedPackagesCopyWith<PaginatedPackages> get copyWith => _$PaginatedPackagesCopyWithImpl<PaginatedPackages>(this as PaginatedPackages, _$identity);

  /// Serializes this PaginatedPackages to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PaginatedPackages&&const DeepCollectionEquality().equals(other.data, data)&&(identical(other.pageInfo, pageInfo) || other.pageInfo == pageInfo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(data),pageInfo);

@override
String toString() {
  return 'PaginatedPackages(data: $data, pageInfo: $pageInfo)';
}


}

/// @nodoc
abstract mixin class $PaginatedPackagesCopyWith<$Res>  {
  factory $PaginatedPackagesCopyWith(PaginatedPackages value, $Res Function(PaginatedPackages) _then) = _$PaginatedPackagesCopyWithImpl;
@useResult
$Res call({
 List<PackageListItem> data, PageInfo pageInfo
});


$PageInfoCopyWith<$Res> get pageInfo;

}
/// @nodoc
class _$PaginatedPackagesCopyWithImpl<$Res>
    implements $PaginatedPackagesCopyWith<$Res> {
  _$PaginatedPackagesCopyWithImpl(this._self, this._then);

  final PaginatedPackages _self;
  final $Res Function(PaginatedPackages) _then;

/// Create a copy of PaginatedPackages
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? data = null,Object? pageInfo = null,}) {
  return _then(_self.copyWith(
data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as List<PackageListItem>,pageInfo: null == pageInfo ? _self.pageInfo : pageInfo // ignore: cast_nullable_to_non_nullable
as PageInfo,
  ));
}
/// Create a copy of PaginatedPackages
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PageInfoCopyWith<$Res> get pageInfo {
  
  return $PageInfoCopyWith<$Res>(_self.pageInfo, (value) {
    return _then(_self.copyWith(pageInfo: value));
  });
}
}


/// Adds pattern-matching-related methods to [PaginatedPackages].
extension PaginatedPackagesPatterns on PaginatedPackages {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PaginatedPackages value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PaginatedPackages() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PaginatedPackages value)  $default,){
final _that = this;
switch (_that) {
case _PaginatedPackages():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PaginatedPackages value)?  $default,){
final _that = this;
switch (_that) {
case _PaginatedPackages() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<PackageListItem> data,  PageInfo pageInfo)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PaginatedPackages() when $default != null:
return $default(_that.data,_that.pageInfo);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<PackageListItem> data,  PageInfo pageInfo)  $default,) {final _that = this;
switch (_that) {
case _PaginatedPackages():
return $default(_that.data,_that.pageInfo);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<PackageListItem> data,  PageInfo pageInfo)?  $default,) {final _that = this;
switch (_that) {
case _PaginatedPackages() when $default != null:
return $default(_that.data,_that.pageInfo);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PaginatedPackages implements PaginatedPackages {
  const _PaginatedPackages({required final  List<PackageListItem> data, required this.pageInfo}): _data = data;
  factory _PaginatedPackages.fromJson(Map<String, dynamic> json) => _$PaginatedPackagesFromJson(json);

 final  List<PackageListItem> _data;
@override List<PackageListItem> get data {
  if (_data is EqualUnmodifiableListView) return _data;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_data);
}

@override final  PageInfo pageInfo;

/// Create a copy of PaginatedPackages
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PaginatedPackagesCopyWith<_PaginatedPackages> get copyWith => __$PaginatedPackagesCopyWithImpl<_PaginatedPackages>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PaginatedPackagesToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PaginatedPackages&&const DeepCollectionEquality().equals(other._data, _data)&&(identical(other.pageInfo, pageInfo) || other.pageInfo == pageInfo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_data),pageInfo);

@override
String toString() {
  return 'PaginatedPackages(data: $data, pageInfo: $pageInfo)';
}


}

/// @nodoc
abstract mixin class _$PaginatedPackagesCopyWith<$Res> implements $PaginatedPackagesCopyWith<$Res> {
  factory _$PaginatedPackagesCopyWith(_PaginatedPackages value, $Res Function(_PaginatedPackages) _then) = __$PaginatedPackagesCopyWithImpl;
@override @useResult
$Res call({
 List<PackageListItem> data, PageInfo pageInfo
});


@override $PageInfoCopyWith<$Res> get pageInfo;

}
/// @nodoc
class __$PaginatedPackagesCopyWithImpl<$Res>
    implements _$PaginatedPackagesCopyWith<$Res> {
  __$PaginatedPackagesCopyWithImpl(this._self, this._then);

  final _PaginatedPackages _self;
  final $Res Function(_PaginatedPackages) _then;

/// Create a copy of PaginatedPackages
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? data = null,Object? pageInfo = null,}) {
  return _then(_PaginatedPackages(
data: null == data ? _self._data : data // ignore: cast_nullable_to_non_nullable
as List<PackageListItem>,pageInfo: null == pageInfo ? _self.pageInfo : pageInfo // ignore: cast_nullable_to_non_nullable
as PageInfo,
  ));
}

/// Create a copy of PaginatedPackages
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PageInfoCopyWith<$Res> get pageInfo {
  
  return $PageInfoCopyWith<$Res>(_self.pageInfo, (value) {
    return _then(_self.copyWith(pageInfo: value));
  });
}
}

// dart format on
