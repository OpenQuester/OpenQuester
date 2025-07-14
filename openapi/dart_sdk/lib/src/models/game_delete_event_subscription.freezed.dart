// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'game_delete_event_subscription.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$GameDeleteEventSubscription {

 GameDeleteEventSubscriptionEvent get event; Data get data;
/// Create a copy of GameDeleteEventSubscription
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GameDeleteEventSubscriptionCopyWith<GameDeleteEventSubscription> get copyWith => _$GameDeleteEventSubscriptionCopyWithImpl<GameDeleteEventSubscription>(this as GameDeleteEventSubscription, _$identity);

  /// Serializes this GameDeleteEventSubscription to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GameDeleteEventSubscription&&(identical(other.event, event) || other.event == event)&&(identical(other.data, data) || other.data == data));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,event,data);

@override
String toString() {
  return 'GameDeleteEventSubscription(event: $event, data: $data)';
}


}

/// @nodoc
abstract mixin class $GameDeleteEventSubscriptionCopyWith<$Res>  {
  factory $GameDeleteEventSubscriptionCopyWith(GameDeleteEventSubscription value, $Res Function(GameDeleteEventSubscription) _then) = _$GameDeleteEventSubscriptionCopyWithImpl;
@useResult
$Res call({
 GameDeleteEventSubscriptionEvent event, Data data
});


$DataCopyWith<$Res> get data;

}
/// @nodoc
class _$GameDeleteEventSubscriptionCopyWithImpl<$Res>
    implements $GameDeleteEventSubscriptionCopyWith<$Res> {
  _$GameDeleteEventSubscriptionCopyWithImpl(this._self, this._then);

  final GameDeleteEventSubscription _self;
  final $Res Function(GameDeleteEventSubscription) _then;

/// Create a copy of GameDeleteEventSubscription
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? event = null,Object? data = null,}) {
  return _then(_self.copyWith(
event: null == event ? _self.event : event // ignore: cast_nullable_to_non_nullable
as GameDeleteEventSubscriptionEvent,data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as Data,
  ));
}
/// Create a copy of GameDeleteEventSubscription
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DataCopyWith<$Res> get data {
  
  return $DataCopyWith<$Res>(_self.data, (value) {
    return _then(_self.copyWith(data: value));
  });
}
}


/// Adds pattern-matching-related methods to [GameDeleteEventSubscription].
extension GameDeleteEventSubscriptionPatterns on GameDeleteEventSubscription {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GameDeleteEventSubscription value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GameDeleteEventSubscription() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GameDeleteEventSubscription value)  $default,){
final _that = this;
switch (_that) {
case _GameDeleteEventSubscription():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GameDeleteEventSubscription value)?  $default,){
final _that = this;
switch (_that) {
case _GameDeleteEventSubscription() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( GameDeleteEventSubscriptionEvent event,  Data data)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GameDeleteEventSubscription() when $default != null:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( GameDeleteEventSubscriptionEvent event,  Data data)  $default,) {final _that = this;
switch (_that) {
case _GameDeleteEventSubscription():
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( GameDeleteEventSubscriptionEvent event,  Data data)?  $default,) {final _that = this;
switch (_that) {
case _GameDeleteEventSubscription() when $default != null:
return $default(_that.event,_that.data);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GameDeleteEventSubscription implements GameDeleteEventSubscription {
  const _GameDeleteEventSubscription({required this.event, required this.data});
  factory _GameDeleteEventSubscription.fromJson(Map<String, dynamic> json) => _$GameDeleteEventSubscriptionFromJson(json);

@override final  GameDeleteEventSubscriptionEvent event;
@override final  Data data;

/// Create a copy of GameDeleteEventSubscription
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GameDeleteEventSubscriptionCopyWith<_GameDeleteEventSubscription> get copyWith => __$GameDeleteEventSubscriptionCopyWithImpl<_GameDeleteEventSubscription>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GameDeleteEventSubscriptionToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _GameDeleteEventSubscription&&(identical(other.event, event) || other.event == event)&&(identical(other.data, data) || other.data == data));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,event,data);

@override
String toString() {
  return 'GameDeleteEventSubscription(event: $event, data: $data)';
}


}

/// @nodoc
abstract mixin class _$GameDeleteEventSubscriptionCopyWith<$Res> implements $GameDeleteEventSubscriptionCopyWith<$Res> {
  factory _$GameDeleteEventSubscriptionCopyWith(_GameDeleteEventSubscription value, $Res Function(_GameDeleteEventSubscription) _then) = __$GameDeleteEventSubscriptionCopyWithImpl;
@override @useResult
$Res call({
 GameDeleteEventSubscriptionEvent event, Data data
});


@override $DataCopyWith<$Res> get data;

}
/// @nodoc
class __$GameDeleteEventSubscriptionCopyWithImpl<$Res>
    implements _$GameDeleteEventSubscriptionCopyWith<$Res> {
  __$GameDeleteEventSubscriptionCopyWithImpl(this._self, this._then);

  final _GameDeleteEventSubscription _self;
  final $Res Function(_GameDeleteEventSubscription) _then;

/// Create a copy of GameDeleteEventSubscription
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? event = null,Object? data = null,}) {
  return _then(_GameDeleteEventSubscription(
event: null == event ? _self.event : event // ignore: cast_nullable_to_non_nullable
as GameDeleteEventSubscriptionEvent,data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as Data,
  ));
}

/// Create a copy of GameDeleteEventSubscription
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DataCopyWith<$Res> get data {
  
  return $DataCopyWith<$Res>(_self.data, (value) {
    return _then(_self.copyWith(data: value));
  });
}
}

// dart format on
