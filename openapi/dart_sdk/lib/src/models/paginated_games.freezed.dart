// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'paginated_games.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PaginatedGames {

 List<GameListItem> get data; PageInfo get pageInfo;
/// Create a copy of PaginatedGames
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PaginatedGamesCopyWith<PaginatedGames> get copyWith => _$PaginatedGamesCopyWithImpl<PaginatedGames>(this as PaginatedGames, _$identity);

  /// Serializes this PaginatedGames to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PaginatedGames&&const DeepCollectionEquality().equals(other.data, data)&&(identical(other.pageInfo, pageInfo) || other.pageInfo == pageInfo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(data),pageInfo);

@override
String toString() {
  return 'PaginatedGames(data: $data, pageInfo: $pageInfo)';
}


}

/// @nodoc
abstract mixin class $PaginatedGamesCopyWith<$Res>  {
  factory $PaginatedGamesCopyWith(PaginatedGames value, $Res Function(PaginatedGames) _then) = _$PaginatedGamesCopyWithImpl;
@useResult
$Res call({
 List<GameListItem> data, PageInfo pageInfo
});


$PageInfoCopyWith<$Res> get pageInfo;

}
/// @nodoc
class _$PaginatedGamesCopyWithImpl<$Res>
    implements $PaginatedGamesCopyWith<$Res> {
  _$PaginatedGamesCopyWithImpl(this._self, this._then);

  final PaginatedGames _self;
  final $Res Function(PaginatedGames) _then;

/// Create a copy of PaginatedGames
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? data = null,Object? pageInfo = null,}) {
  return _then(_self.copyWith(
data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as List<GameListItem>,pageInfo: null == pageInfo ? _self.pageInfo : pageInfo // ignore: cast_nullable_to_non_nullable
as PageInfo,
  ));
}
/// Create a copy of PaginatedGames
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PageInfoCopyWith<$Res> get pageInfo {
  
  return $PageInfoCopyWith<$Res>(_self.pageInfo, (value) {
    return _then(_self.copyWith(pageInfo: value));
  });
}
}


/// Adds pattern-matching-related methods to [PaginatedGames].
extension PaginatedGamesPatterns on PaginatedGames {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PaginatedGames value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PaginatedGames() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PaginatedGames value)  $default,){
final _that = this;
switch (_that) {
case _PaginatedGames():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PaginatedGames value)?  $default,){
final _that = this;
switch (_that) {
case _PaginatedGames() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<GameListItem> data,  PageInfo pageInfo)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PaginatedGames() when $default != null:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<GameListItem> data,  PageInfo pageInfo)  $default,) {final _that = this;
switch (_that) {
case _PaginatedGames():
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<GameListItem> data,  PageInfo pageInfo)?  $default,) {final _that = this;
switch (_that) {
case _PaginatedGames() when $default != null:
return $default(_that.data,_that.pageInfo);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PaginatedGames implements PaginatedGames {
  const _PaginatedGames({required final  List<GameListItem> data, required this.pageInfo}): _data = data;
  factory _PaginatedGames.fromJson(Map<String, dynamic> json) => _$PaginatedGamesFromJson(json);

 final  List<GameListItem> _data;
@override List<GameListItem> get data {
  if (_data is EqualUnmodifiableListView) return _data;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_data);
}

@override final  PageInfo pageInfo;

/// Create a copy of PaginatedGames
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PaginatedGamesCopyWith<_PaginatedGames> get copyWith => __$PaginatedGamesCopyWithImpl<_PaginatedGames>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PaginatedGamesToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PaginatedGames&&const DeepCollectionEquality().equals(other._data, _data)&&(identical(other.pageInfo, pageInfo) || other.pageInfo == pageInfo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_data),pageInfo);

@override
String toString() {
  return 'PaginatedGames(data: $data, pageInfo: $pageInfo)';
}


}

/// @nodoc
abstract mixin class _$PaginatedGamesCopyWith<$Res> implements $PaginatedGamesCopyWith<$Res> {
  factory _$PaginatedGamesCopyWith(_PaginatedGames value, $Res Function(_PaginatedGames) _then) = __$PaginatedGamesCopyWithImpl;
@override @useResult
$Res call({
 List<GameListItem> data, PageInfo pageInfo
});


@override $PageInfoCopyWith<$Res> get pageInfo;

}
/// @nodoc
class __$PaginatedGamesCopyWithImpl<$Res>
    implements _$PaginatedGamesCopyWith<$Res> {
  __$PaginatedGamesCopyWithImpl(this._self, this._then);

  final _PaginatedGames _self;
  final $Res Function(_PaginatedGames) _then;

/// Create a copy of PaginatedGames
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? data = null,Object? pageInfo = null,}) {
  return _then(_PaginatedGames(
data: null == data ? _self._data : data // ignore: cast_nullable_to_non_nullable
as List<GameListItem>,pageInfo: null == pageInfo ? _self.pageInfo : pageInfo // ignore: cast_nullable_to_non_nullable
as PageInfo,
  ));
}

/// Create a copy of PaginatedGames
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
