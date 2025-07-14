// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'game_update_event_subscription.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$GameUpdateEventSubscription {

 GameUpdateEventSubscriptionEvent get event; GameListItem get data;
/// Create a copy of GameUpdateEventSubscription
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GameUpdateEventSubscriptionCopyWith<GameUpdateEventSubscription> get copyWith => _$GameUpdateEventSubscriptionCopyWithImpl<GameUpdateEventSubscription>(this as GameUpdateEventSubscription, _$identity);

  /// Serializes this GameUpdateEventSubscription to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GameUpdateEventSubscription&&(identical(other.event, event) || other.event == event)&&(identical(other.data, data) || other.data == data));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,event,data);

@override
String toString() {
  return 'GameUpdateEventSubscription(event: $event, data: $data)';
}


}

/// @nodoc
abstract mixin class $GameUpdateEventSubscriptionCopyWith<$Res>  {
  factory $GameUpdateEventSubscriptionCopyWith(GameUpdateEventSubscription value, $Res Function(GameUpdateEventSubscription) _then) = _$GameUpdateEventSubscriptionCopyWithImpl;
@useResult
$Res call({
 GameUpdateEventSubscriptionEvent event, GameListItem data
});


$GameListItemCopyWith<$Res> get data;

}
/// @nodoc
class _$GameUpdateEventSubscriptionCopyWithImpl<$Res>
    implements $GameUpdateEventSubscriptionCopyWith<$Res> {
  _$GameUpdateEventSubscriptionCopyWithImpl(this._self, this._then);

  final GameUpdateEventSubscription _self;
  final $Res Function(GameUpdateEventSubscription) _then;

/// Create a copy of GameUpdateEventSubscription
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? event = null,Object? data = null,}) {
  return _then(_self.copyWith(
event: null == event ? _self.event : event // ignore: cast_nullable_to_non_nullable
as GameUpdateEventSubscriptionEvent,data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as GameListItem,
  ));
}
/// Create a copy of GameUpdateEventSubscription
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameListItemCopyWith<$Res> get data {
  
  return $GameListItemCopyWith<$Res>(_self.data, (value) {
    return _then(_self.copyWith(data: value));
  });
}
}


/// Adds pattern-matching-related methods to [GameUpdateEventSubscription].
extension GameUpdateEventSubscriptionPatterns on GameUpdateEventSubscription {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GameUpdateEventSubscription value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GameUpdateEventSubscription() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GameUpdateEventSubscription value)  $default,){
final _that = this;
switch (_that) {
case _GameUpdateEventSubscription():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GameUpdateEventSubscription value)?  $default,){
final _that = this;
switch (_that) {
case _GameUpdateEventSubscription() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( GameUpdateEventSubscriptionEvent event,  GameListItem data)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GameUpdateEventSubscription() when $default != null:
return $default(_that.event,_that.data);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( GameUpdateEventSubscriptionEvent event,  GameListItem data)  $default,) {final _that = this;
switch (_that) {
case _GameUpdateEventSubscription():
return $default(_that.event,_that.data);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( GameUpdateEventSubscriptionEvent event,  GameListItem data)?  $default,) {final _that = this;
switch (_that) {
case _GameUpdateEventSubscription() when $default != null:
return $default(_that.event,_that.data);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GameUpdateEventSubscription implements GameUpdateEventSubscription {
  const _GameUpdateEventSubscription({required this.event, required this.data});
  factory _GameUpdateEventSubscription.fromJson(Map<String, dynamic> json) => _$GameUpdateEventSubscriptionFromJson(json);

@override final  GameUpdateEventSubscriptionEvent event;
@override final  GameListItem data;

/// Create a copy of GameUpdateEventSubscription
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GameUpdateEventSubscriptionCopyWith<_GameUpdateEventSubscription> get copyWith => __$GameUpdateEventSubscriptionCopyWithImpl<_GameUpdateEventSubscription>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GameUpdateEventSubscriptionToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _GameUpdateEventSubscription&&(identical(other.event, event) || other.event == event)&&(identical(other.data, data) || other.data == data));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,event,data);

@override
String toString() {
  return 'GameUpdateEventSubscription(event: $event, data: $data)';
}


}

/// @nodoc
abstract mixin class _$GameUpdateEventSubscriptionCopyWith<$Res> implements $GameUpdateEventSubscriptionCopyWith<$Res> {
  factory _$GameUpdateEventSubscriptionCopyWith(_GameUpdateEventSubscription value, $Res Function(_GameUpdateEventSubscription) _then) = __$GameUpdateEventSubscriptionCopyWithImpl;
@override @useResult
$Res call({
 GameUpdateEventSubscriptionEvent event, GameListItem data
});


@override $GameListItemCopyWith<$Res> get data;

}
/// @nodoc
class __$GameUpdateEventSubscriptionCopyWithImpl<$Res>
    implements _$GameUpdateEventSubscriptionCopyWith<$Res> {
  __$GameUpdateEventSubscriptionCopyWithImpl(this._self, this._then);

  final _GameUpdateEventSubscription _self;
  final $Res Function(_GameUpdateEventSubscription) _then;

/// Create a copy of GameUpdateEventSubscription
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? event = null,Object? data = null,}) {
  return _then(_GameUpdateEventSubscription(
event: null == event ? _self.event : event // ignore: cast_nullable_to_non_nullable
as GameUpdateEventSubscriptionEvent,data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as GameListItem,
  ));
}

/// Create a copy of GameUpdateEventSubscription
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameListItemCopyWith<$Res> get data {
  
  return $GameListItemCopyWith<$Res>(_self.data, (value) {
    return _then(_self.copyWith(data: value));
  });
}
}

// dart format on
