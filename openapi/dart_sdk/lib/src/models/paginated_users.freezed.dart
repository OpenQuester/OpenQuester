// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'paginated_users.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PaginatedUsers {

 List<ResponseUser> get data; PageInfo get pageInfo;
/// Create a copy of PaginatedUsers
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PaginatedUsersCopyWith<PaginatedUsers> get copyWith => _$PaginatedUsersCopyWithImpl<PaginatedUsers>(this as PaginatedUsers, _$identity);

  /// Serializes this PaginatedUsers to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PaginatedUsers&&const DeepCollectionEquality().equals(other.data, data)&&(identical(other.pageInfo, pageInfo) || other.pageInfo == pageInfo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(data),pageInfo);

@override
String toString() {
  return 'PaginatedUsers(data: $data, pageInfo: $pageInfo)';
}


}

/// @nodoc
abstract mixin class $PaginatedUsersCopyWith<$Res>  {
  factory $PaginatedUsersCopyWith(PaginatedUsers value, $Res Function(PaginatedUsers) _then) = _$PaginatedUsersCopyWithImpl;
@useResult
$Res call({
 List<ResponseUser> data, PageInfo pageInfo
});


$PageInfoCopyWith<$Res> get pageInfo;

}
/// @nodoc
class _$PaginatedUsersCopyWithImpl<$Res>
    implements $PaginatedUsersCopyWith<$Res> {
  _$PaginatedUsersCopyWithImpl(this._self, this._then);

  final PaginatedUsers _self;
  final $Res Function(PaginatedUsers) _then;

/// Create a copy of PaginatedUsers
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? data = null,Object? pageInfo = null,}) {
  return _then(_self.copyWith(
data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as List<ResponseUser>,pageInfo: null == pageInfo ? _self.pageInfo : pageInfo // ignore: cast_nullable_to_non_nullable
as PageInfo,
  ));
}
/// Create a copy of PaginatedUsers
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PageInfoCopyWith<$Res> get pageInfo {
  
  return $PageInfoCopyWith<$Res>(_self.pageInfo, (value) {
    return _then(_self.copyWith(pageInfo: value));
  });
}
}


/// Adds pattern-matching-related methods to [PaginatedUsers].
extension PaginatedUsersPatterns on PaginatedUsers {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PaginatedUsers value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PaginatedUsers() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PaginatedUsers value)  $default,){
final _that = this;
switch (_that) {
case _PaginatedUsers():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PaginatedUsers value)?  $default,){
final _that = this;
switch (_that) {
case _PaginatedUsers() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<ResponseUser> data,  PageInfo pageInfo)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PaginatedUsers() when $default != null:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<ResponseUser> data,  PageInfo pageInfo)  $default,) {final _that = this;
switch (_that) {
case _PaginatedUsers():
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<ResponseUser> data,  PageInfo pageInfo)?  $default,) {final _that = this;
switch (_that) {
case _PaginatedUsers() when $default != null:
return $default(_that.data,_that.pageInfo);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PaginatedUsers implements PaginatedUsers {
  const _PaginatedUsers({required final  List<ResponseUser> data, required this.pageInfo}): _data = data;
  factory _PaginatedUsers.fromJson(Map<String, dynamic> json) => _$PaginatedUsersFromJson(json);

 final  List<ResponseUser> _data;
@override List<ResponseUser> get data {
  if (_data is EqualUnmodifiableListView) return _data;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_data);
}

@override final  PageInfo pageInfo;

/// Create a copy of PaginatedUsers
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PaginatedUsersCopyWith<_PaginatedUsers> get copyWith => __$PaginatedUsersCopyWithImpl<_PaginatedUsers>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PaginatedUsersToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PaginatedUsers&&const DeepCollectionEquality().equals(other._data, _data)&&(identical(other.pageInfo, pageInfo) || other.pageInfo == pageInfo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_data),pageInfo);

@override
String toString() {
  return 'PaginatedUsers(data: $data, pageInfo: $pageInfo)';
}


}

/// @nodoc
abstract mixin class _$PaginatedUsersCopyWith<$Res> implements $PaginatedUsersCopyWith<$Res> {
  factory _$PaginatedUsersCopyWith(_PaginatedUsers value, $Res Function(_PaginatedUsers) _then) = __$PaginatedUsersCopyWithImpl;
@override @useResult
$Res call({
 List<ResponseUser> data, PageInfo pageInfo
});


@override $PageInfoCopyWith<$Res> get pageInfo;

}
/// @nodoc
class __$PaginatedUsersCopyWithImpl<$Res>
    implements _$PaginatedUsersCopyWith<$Res> {
  __$PaginatedUsersCopyWithImpl(this._self, this._then);

  final _PaginatedUsers _self;
  final $Res Function(_PaginatedUsers) _then;

/// Create a copy of PaginatedUsers
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? data = null,Object? pageInfo = null,}) {
  return _then(_PaginatedUsers(
data: null == data ? _self._data : data // ignore: cast_nullable_to_non_nullable
as List<ResponseUser>,pageInfo: null == pageInfo ? _self.pageInfo : pageInfo // ignore: cast_nullable_to_non_nullable
as PageInfo,
  ));
}

/// Create a copy of PaginatedUsers
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
