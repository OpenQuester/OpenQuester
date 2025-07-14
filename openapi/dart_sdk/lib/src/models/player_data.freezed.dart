// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'player_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PlayerData {

 PlayerMeta get meta; PlayerRole get role; RestrictionsEventData get restrictionData; int get score;/// Slot null has only showman and spectators
 int? get slot; PlayerDataStatus get status;
/// Create a copy of PlayerData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PlayerDataCopyWith<PlayerData> get copyWith => _$PlayerDataCopyWithImpl<PlayerData>(this as PlayerData, _$identity);

  /// Serializes this PlayerData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PlayerData&&(identical(other.meta, meta) || other.meta == meta)&&(identical(other.role, role) || other.role == role)&&(identical(other.restrictionData, restrictionData) || other.restrictionData == restrictionData)&&(identical(other.score, score) || other.score == score)&&(identical(other.slot, slot) || other.slot == slot)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,meta,role,restrictionData,score,slot,status);

@override
String toString() {
  return 'PlayerData(meta: $meta, role: $role, restrictionData: $restrictionData, score: $score, slot: $slot, status: $status)';
}


}

/// @nodoc
abstract mixin class $PlayerDataCopyWith<$Res>  {
  factory $PlayerDataCopyWith(PlayerData value, $Res Function(PlayerData) _then) = _$PlayerDataCopyWithImpl;
@useResult
$Res call({
 PlayerMeta meta, PlayerRole role, RestrictionsEventData restrictionData, int score, int? slot, PlayerDataStatus status
});


$PlayerMetaCopyWith<$Res> get meta;$RestrictionsEventDataCopyWith<$Res> get restrictionData;

}
/// @nodoc
class _$PlayerDataCopyWithImpl<$Res>
    implements $PlayerDataCopyWith<$Res> {
  _$PlayerDataCopyWithImpl(this._self, this._then);

  final PlayerData _self;
  final $Res Function(PlayerData) _then;

/// Create a copy of PlayerData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? meta = null,Object? role = null,Object? restrictionData = null,Object? score = null,Object? slot = freezed,Object? status = null,}) {
  return _then(_self.copyWith(
meta: null == meta ? _self.meta : meta // ignore: cast_nullable_to_non_nullable
as PlayerMeta,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as PlayerRole,restrictionData: null == restrictionData ? _self.restrictionData : restrictionData // ignore: cast_nullable_to_non_nullable
as RestrictionsEventData,score: null == score ? _self.score : score // ignore: cast_nullable_to_non_nullable
as int,slot: freezed == slot ? _self.slot : slot // ignore: cast_nullable_to_non_nullable
as int?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as PlayerDataStatus,
  ));
}
/// Create a copy of PlayerData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PlayerMetaCopyWith<$Res> get meta {
  
  return $PlayerMetaCopyWith<$Res>(_self.meta, (value) {
    return _then(_self.copyWith(meta: value));
  });
}/// Create a copy of PlayerData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RestrictionsEventDataCopyWith<$Res> get restrictionData {
  
  return $RestrictionsEventDataCopyWith<$Res>(_self.restrictionData, (value) {
    return _then(_self.copyWith(restrictionData: value));
  });
}
}


/// Adds pattern-matching-related methods to [PlayerData].
extension PlayerDataPatterns on PlayerData {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PlayerData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PlayerData() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PlayerData value)  $default,){
final _that = this;
switch (_that) {
case _PlayerData():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PlayerData value)?  $default,){
final _that = this;
switch (_that) {
case _PlayerData() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( PlayerMeta meta,  PlayerRole role,  RestrictionsEventData restrictionData,  int score,  int? slot,  PlayerDataStatus status)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PlayerData() when $default != null:
return $default(_that.meta,_that.role,_that.restrictionData,_that.score,_that.slot,_that.status);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( PlayerMeta meta,  PlayerRole role,  RestrictionsEventData restrictionData,  int score,  int? slot,  PlayerDataStatus status)  $default,) {final _that = this;
switch (_that) {
case _PlayerData():
return $default(_that.meta,_that.role,_that.restrictionData,_that.score,_that.slot,_that.status);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( PlayerMeta meta,  PlayerRole role,  RestrictionsEventData restrictionData,  int score,  int? slot,  PlayerDataStatus status)?  $default,) {final _that = this;
switch (_that) {
case _PlayerData() when $default != null:
return $default(_that.meta,_that.role,_that.restrictionData,_that.score,_that.slot,_that.status);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PlayerData implements PlayerData {
  const _PlayerData({required this.meta, required this.role, required this.restrictionData, required this.score, required this.slot, required this.status});
  factory _PlayerData.fromJson(Map<String, dynamic> json) => _$PlayerDataFromJson(json);

@override final  PlayerMeta meta;
@override final  PlayerRole role;
@override final  RestrictionsEventData restrictionData;
@override final  int score;
/// Slot null has only showman and spectators
@override final  int? slot;
@override final  PlayerDataStatus status;

/// Create a copy of PlayerData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PlayerDataCopyWith<_PlayerData> get copyWith => __$PlayerDataCopyWithImpl<_PlayerData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PlayerDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PlayerData&&(identical(other.meta, meta) || other.meta == meta)&&(identical(other.role, role) || other.role == role)&&(identical(other.restrictionData, restrictionData) || other.restrictionData == restrictionData)&&(identical(other.score, score) || other.score == score)&&(identical(other.slot, slot) || other.slot == slot)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,meta,role,restrictionData,score,slot,status);

@override
String toString() {
  return 'PlayerData(meta: $meta, role: $role, restrictionData: $restrictionData, score: $score, slot: $slot, status: $status)';
}


}

/// @nodoc
abstract mixin class _$PlayerDataCopyWith<$Res> implements $PlayerDataCopyWith<$Res> {
  factory _$PlayerDataCopyWith(_PlayerData value, $Res Function(_PlayerData) _then) = __$PlayerDataCopyWithImpl;
@override @useResult
$Res call({
 PlayerMeta meta, PlayerRole role, RestrictionsEventData restrictionData, int score, int? slot, PlayerDataStatus status
});


@override $PlayerMetaCopyWith<$Res> get meta;@override $RestrictionsEventDataCopyWith<$Res> get restrictionData;

}
/// @nodoc
class __$PlayerDataCopyWithImpl<$Res>
    implements _$PlayerDataCopyWith<$Res> {
  __$PlayerDataCopyWithImpl(this._self, this._then);

  final _PlayerData _self;
  final $Res Function(_PlayerData) _then;

/// Create a copy of PlayerData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? meta = null,Object? role = null,Object? restrictionData = null,Object? score = null,Object? slot = freezed,Object? status = null,}) {
  return _then(_PlayerData(
meta: null == meta ? _self.meta : meta // ignore: cast_nullable_to_non_nullable
as PlayerMeta,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as PlayerRole,restrictionData: null == restrictionData ? _self.restrictionData : restrictionData // ignore: cast_nullable_to_non_nullable
as RestrictionsEventData,score: null == score ? _self.score : score // ignore: cast_nullable_to_non_nullable
as int,slot: freezed == slot ? _self.slot : slot // ignore: cast_nullable_to_non_nullable
as int?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as PlayerDataStatus,
  ));
}

/// Create a copy of PlayerData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PlayerMetaCopyWith<$Res> get meta {
  
  return $PlayerMetaCopyWith<$Res>(_self.meta, (value) {
    return _then(_self.copyWith(meta: value));
  });
}/// Create a copy of PlayerData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RestrictionsEventDataCopyWith<$Res> get restrictionData {
  
  return $RestrictionsEventDataCopyWith<$Res>(_self.restrictionData, (value) {
    return _then(_self.copyWith(restrictionData: value));
  });
}
}

// dart format on
