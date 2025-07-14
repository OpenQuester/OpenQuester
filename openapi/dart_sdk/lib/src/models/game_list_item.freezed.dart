// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'game_list_item.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$GameListItem {

 String get id; ShortUserInfo get createdBy; String get title; DateTime get createdAt; AgeRestriction get ageRestriction; bool get isPrivate; int? get currentRound; int? get playedQuestions; int get players; int get maxPlayers; DateTime? get startedAt; DateTime? get finishedAt; PackageItem get package;
/// Create a copy of GameListItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GameListItemCopyWith<GameListItem> get copyWith => _$GameListItemCopyWithImpl<GameListItem>(this as GameListItem, _$identity);

  /// Serializes this GameListItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GameListItem&&(identical(other.id, id) || other.id == id)&&(identical(other.createdBy, createdBy) || other.createdBy == createdBy)&&(identical(other.title, title) || other.title == title)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.ageRestriction, ageRestriction) || other.ageRestriction == ageRestriction)&&(identical(other.isPrivate, isPrivate) || other.isPrivate == isPrivate)&&(identical(other.currentRound, currentRound) || other.currentRound == currentRound)&&(identical(other.playedQuestions, playedQuestions) || other.playedQuestions == playedQuestions)&&(identical(other.players, players) || other.players == players)&&(identical(other.maxPlayers, maxPlayers) || other.maxPlayers == maxPlayers)&&(identical(other.startedAt, startedAt) || other.startedAt == startedAt)&&(identical(other.finishedAt, finishedAt) || other.finishedAt == finishedAt)&&(identical(other.package, package) || other.package == package));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,createdBy,title,createdAt,ageRestriction,isPrivate,currentRound,playedQuestions,players,maxPlayers,startedAt,finishedAt,package);

@override
String toString() {
  return 'GameListItem(id: $id, createdBy: $createdBy, title: $title, createdAt: $createdAt, ageRestriction: $ageRestriction, isPrivate: $isPrivate, currentRound: $currentRound, playedQuestions: $playedQuestions, players: $players, maxPlayers: $maxPlayers, startedAt: $startedAt, finishedAt: $finishedAt, package: $package)';
}


}

/// @nodoc
abstract mixin class $GameListItemCopyWith<$Res>  {
  factory $GameListItemCopyWith(GameListItem value, $Res Function(GameListItem) _then) = _$GameListItemCopyWithImpl;
@useResult
$Res call({
 String id, ShortUserInfo createdBy, String title, DateTime createdAt, AgeRestriction ageRestriction, bool isPrivate, int? currentRound, int? playedQuestions, int players, int maxPlayers, DateTime? startedAt, DateTime? finishedAt, PackageItem package
});


$ShortUserInfoCopyWith<$Res> get createdBy;$PackageItemCopyWith<$Res> get package;

}
/// @nodoc
class _$GameListItemCopyWithImpl<$Res>
    implements $GameListItemCopyWith<$Res> {
  _$GameListItemCopyWithImpl(this._self, this._then);

  final GameListItem _self;
  final $Res Function(GameListItem) _then;

/// Create a copy of GameListItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? createdBy = null,Object? title = null,Object? createdAt = null,Object? ageRestriction = null,Object? isPrivate = null,Object? currentRound = freezed,Object? playedQuestions = freezed,Object? players = null,Object? maxPlayers = null,Object? startedAt = freezed,Object? finishedAt = freezed,Object? package = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,createdBy: null == createdBy ? _self.createdBy : createdBy // ignore: cast_nullable_to_non_nullable
as ShortUserInfo,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,ageRestriction: null == ageRestriction ? _self.ageRestriction : ageRestriction // ignore: cast_nullable_to_non_nullable
as AgeRestriction,isPrivate: null == isPrivate ? _self.isPrivate : isPrivate // ignore: cast_nullable_to_non_nullable
as bool,currentRound: freezed == currentRound ? _self.currentRound : currentRound // ignore: cast_nullable_to_non_nullable
as int?,playedQuestions: freezed == playedQuestions ? _self.playedQuestions : playedQuestions // ignore: cast_nullable_to_non_nullable
as int?,players: null == players ? _self.players : players // ignore: cast_nullable_to_non_nullable
as int,maxPlayers: null == maxPlayers ? _self.maxPlayers : maxPlayers // ignore: cast_nullable_to_non_nullable
as int,startedAt: freezed == startedAt ? _self.startedAt : startedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,finishedAt: freezed == finishedAt ? _self.finishedAt : finishedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,package: null == package ? _self.package : package // ignore: cast_nullable_to_non_nullable
as PackageItem,
  ));
}
/// Create a copy of GameListItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ShortUserInfoCopyWith<$Res> get createdBy {
  
  return $ShortUserInfoCopyWith<$Res>(_self.createdBy, (value) {
    return _then(_self.copyWith(createdBy: value));
  });
}/// Create a copy of GameListItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PackageItemCopyWith<$Res> get package {
  
  return $PackageItemCopyWith<$Res>(_self.package, (value) {
    return _then(_self.copyWith(package: value));
  });
}
}


/// Adds pattern-matching-related methods to [GameListItem].
extension GameListItemPatterns on GameListItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GameListItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GameListItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GameListItem value)  $default,){
final _that = this;
switch (_that) {
case _GameListItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GameListItem value)?  $default,){
final _that = this;
switch (_that) {
case _GameListItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  ShortUserInfo createdBy,  String title,  DateTime createdAt,  AgeRestriction ageRestriction,  bool isPrivate,  int? currentRound,  int? playedQuestions,  int players,  int maxPlayers,  DateTime? startedAt,  DateTime? finishedAt,  PackageItem package)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GameListItem() when $default != null:
return $default(_that.id,_that.createdBy,_that.title,_that.createdAt,_that.ageRestriction,_that.isPrivate,_that.currentRound,_that.playedQuestions,_that.players,_that.maxPlayers,_that.startedAt,_that.finishedAt,_that.package);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  ShortUserInfo createdBy,  String title,  DateTime createdAt,  AgeRestriction ageRestriction,  bool isPrivate,  int? currentRound,  int? playedQuestions,  int players,  int maxPlayers,  DateTime? startedAt,  DateTime? finishedAt,  PackageItem package)  $default,) {final _that = this;
switch (_that) {
case _GameListItem():
return $default(_that.id,_that.createdBy,_that.title,_that.createdAt,_that.ageRestriction,_that.isPrivate,_that.currentRound,_that.playedQuestions,_that.players,_that.maxPlayers,_that.startedAt,_that.finishedAt,_that.package);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  ShortUserInfo createdBy,  String title,  DateTime createdAt,  AgeRestriction ageRestriction,  bool isPrivate,  int? currentRound,  int? playedQuestions,  int players,  int maxPlayers,  DateTime? startedAt,  DateTime? finishedAt,  PackageItem package)?  $default,) {final _that = this;
switch (_that) {
case _GameListItem() when $default != null:
return $default(_that.id,_that.createdBy,_that.title,_that.createdAt,_that.ageRestriction,_that.isPrivate,_that.currentRound,_that.playedQuestions,_that.players,_that.maxPlayers,_that.startedAt,_that.finishedAt,_that.package);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GameListItem implements GameListItem {
  const _GameListItem({required this.id, required this.createdBy, required this.title, required this.createdAt, required this.ageRestriction, required this.isPrivate, required this.currentRound, required this.playedQuestions, required this.players, required this.maxPlayers, required this.startedAt, required this.finishedAt, required this.package});
  factory _GameListItem.fromJson(Map<String, dynamic> json) => _$GameListItemFromJson(json);

@override final  String id;
@override final  ShortUserInfo createdBy;
@override final  String title;
@override final  DateTime createdAt;
@override final  AgeRestriction ageRestriction;
@override final  bool isPrivate;
@override final  int? currentRound;
@override final  int? playedQuestions;
@override final  int players;
@override final  int maxPlayers;
@override final  DateTime? startedAt;
@override final  DateTime? finishedAt;
@override final  PackageItem package;

/// Create a copy of GameListItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GameListItemCopyWith<_GameListItem> get copyWith => __$GameListItemCopyWithImpl<_GameListItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GameListItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _GameListItem&&(identical(other.id, id) || other.id == id)&&(identical(other.createdBy, createdBy) || other.createdBy == createdBy)&&(identical(other.title, title) || other.title == title)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.ageRestriction, ageRestriction) || other.ageRestriction == ageRestriction)&&(identical(other.isPrivate, isPrivate) || other.isPrivate == isPrivate)&&(identical(other.currentRound, currentRound) || other.currentRound == currentRound)&&(identical(other.playedQuestions, playedQuestions) || other.playedQuestions == playedQuestions)&&(identical(other.players, players) || other.players == players)&&(identical(other.maxPlayers, maxPlayers) || other.maxPlayers == maxPlayers)&&(identical(other.startedAt, startedAt) || other.startedAt == startedAt)&&(identical(other.finishedAt, finishedAt) || other.finishedAt == finishedAt)&&(identical(other.package, package) || other.package == package));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,createdBy,title,createdAt,ageRestriction,isPrivate,currentRound,playedQuestions,players,maxPlayers,startedAt,finishedAt,package);

@override
String toString() {
  return 'GameListItem(id: $id, createdBy: $createdBy, title: $title, createdAt: $createdAt, ageRestriction: $ageRestriction, isPrivate: $isPrivate, currentRound: $currentRound, playedQuestions: $playedQuestions, players: $players, maxPlayers: $maxPlayers, startedAt: $startedAt, finishedAt: $finishedAt, package: $package)';
}


}

/// @nodoc
abstract mixin class _$GameListItemCopyWith<$Res> implements $GameListItemCopyWith<$Res> {
  factory _$GameListItemCopyWith(_GameListItem value, $Res Function(_GameListItem) _then) = __$GameListItemCopyWithImpl;
@override @useResult
$Res call({
 String id, ShortUserInfo createdBy, String title, DateTime createdAt, AgeRestriction ageRestriction, bool isPrivate, int? currentRound, int? playedQuestions, int players, int maxPlayers, DateTime? startedAt, DateTime? finishedAt, PackageItem package
});


@override $ShortUserInfoCopyWith<$Res> get createdBy;@override $PackageItemCopyWith<$Res> get package;

}
/// @nodoc
class __$GameListItemCopyWithImpl<$Res>
    implements _$GameListItemCopyWith<$Res> {
  __$GameListItemCopyWithImpl(this._self, this._then);

  final _GameListItem _self;
  final $Res Function(_GameListItem) _then;

/// Create a copy of GameListItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? createdBy = null,Object? title = null,Object? createdAt = null,Object? ageRestriction = null,Object? isPrivate = null,Object? currentRound = freezed,Object? playedQuestions = freezed,Object? players = null,Object? maxPlayers = null,Object? startedAt = freezed,Object? finishedAt = freezed,Object? package = null,}) {
  return _then(_GameListItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,createdBy: null == createdBy ? _self.createdBy : createdBy // ignore: cast_nullable_to_non_nullable
as ShortUserInfo,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,ageRestriction: null == ageRestriction ? _self.ageRestriction : ageRestriction // ignore: cast_nullable_to_non_nullable
as AgeRestriction,isPrivate: null == isPrivate ? _self.isPrivate : isPrivate // ignore: cast_nullable_to_non_nullable
as bool,currentRound: freezed == currentRound ? _self.currentRound : currentRound // ignore: cast_nullable_to_non_nullable
as int?,playedQuestions: freezed == playedQuestions ? _self.playedQuestions : playedQuestions // ignore: cast_nullable_to_non_nullable
as int?,players: null == players ? _self.players : players // ignore: cast_nullable_to_non_nullable
as int,maxPlayers: null == maxPlayers ? _self.maxPlayers : maxPlayers // ignore: cast_nullable_to_non_nullable
as int,startedAt: freezed == startedAt ? _self.startedAt : startedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,finishedAt: freezed == finishedAt ? _self.finishedAt : finishedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,package: null == package ? _self.package : package // ignore: cast_nullable_to_non_nullable
as PackageItem,
  ));
}

/// Create a copy of GameListItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ShortUserInfoCopyWith<$Res> get createdBy {
  
  return $ShortUserInfoCopyWith<$Res>(_self.createdBy, (value) {
    return _then(_self.copyWith(createdBy: value));
  });
}/// Create a copy of GameListItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PackageItemCopyWith<$Res> get package {
  
  return $PackageItemCopyWith<$Res>(_self.package, (value) {
    return _then(_self.copyWith(package: value));
  });
}
}

// dart format on
