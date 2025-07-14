// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'game_event_subscription_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
GameEventSubscriptionUnion _$GameEventSubscriptionUnionFromJson(
  Map<String, dynamic> json
) {
        switch (json['event']) {
                  case 'created':
          return GameEventSubscriptionUnionCreated.fromJson(
            json
          );
                case 'changed':
          return GameEventSubscriptionUnionChanged.fromJson(
            json
          );
                case 'started':
          return GameEventSubscriptionUnionStarted.fromJson(
            json
          );
                case 'deleted':
          return GameEventSubscriptionUnionDeleted.fromJson(
            json
          );
        
          default:
            throw CheckedFromJsonException(
  json,
  'event',
  'GameEventSubscriptionUnion',
  'Invalid union type "${json['event']}"!'
);
        }
      
}

/// @nodoc
mixin _$GameEventSubscriptionUnion {

 Enum get event; Object get data;

  /// Serializes this GameEventSubscriptionUnion to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GameEventSubscriptionUnion&&(identical(other.event, event) || other.event == event)&&const DeepCollectionEquality().equals(other.data, data));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,event,const DeepCollectionEquality().hash(data));

@override
String toString() {
  return 'GameEventSubscriptionUnion(event: $event, data: $data)';
}


}

/// @nodoc
class $GameEventSubscriptionUnionCopyWith<$Res>  {
$GameEventSubscriptionUnionCopyWith(GameEventSubscriptionUnion _, $Res Function(GameEventSubscriptionUnion) __);
}


/// Adds pattern-matching-related methods to [GameEventSubscriptionUnion].
extension GameEventSubscriptionUnionPatterns on GameEventSubscriptionUnion {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>({TResult Function( GameEventSubscriptionUnionCreated value)?  created,TResult Function( GameEventSubscriptionUnionChanged value)?  changed,TResult Function( GameEventSubscriptionUnionStarted value)?  started,TResult Function( GameEventSubscriptionUnionDeleted value)?  deleted,required TResult orElse(),}){
final _that = this;
switch (_that) {
case GameEventSubscriptionUnionCreated() when created != null:
return created(_that);case GameEventSubscriptionUnionChanged() when changed != null:
return changed(_that);case GameEventSubscriptionUnionStarted() when started != null:
return started(_that);case GameEventSubscriptionUnionDeleted() when deleted != null:
return deleted(_that);case _:
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

@optionalTypeArgs TResult map<TResult extends Object?>({required TResult Function( GameEventSubscriptionUnionCreated value)  created,required TResult Function( GameEventSubscriptionUnionChanged value)  changed,required TResult Function( GameEventSubscriptionUnionStarted value)  started,required TResult Function( GameEventSubscriptionUnionDeleted value)  deleted,}){
final _that = this;
switch (_that) {
case GameEventSubscriptionUnionCreated():
return created(_that);case GameEventSubscriptionUnionChanged():
return changed(_that);case GameEventSubscriptionUnionStarted():
return started(_that);case GameEventSubscriptionUnionDeleted():
return deleted(_that);}
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>({TResult? Function( GameEventSubscriptionUnionCreated value)?  created,TResult? Function( GameEventSubscriptionUnionChanged value)?  changed,TResult? Function( GameEventSubscriptionUnionStarted value)?  started,TResult? Function( GameEventSubscriptionUnionDeleted value)?  deleted,}){
final _that = this;
switch (_that) {
case GameEventSubscriptionUnionCreated() when created != null:
return created(_that);case GameEventSubscriptionUnionChanged() when changed != null:
return changed(_that);case GameEventSubscriptionUnionStarted() when started != null:
return started(_that);case GameEventSubscriptionUnionDeleted() when deleted != null:
return deleted(_that);case _:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>({TResult Function( GameUpdateEventSubscriptionEvent event,  GameListItem data)?  created,TResult Function( GameUpdateEventSubscriptionEvent event,  GameListItem data)?  changed,TResult Function( GameUpdateEventSubscriptionEvent event,  GameListItem data)?  started,TResult Function( GameDeleteEventSubscriptionEvent event,  Data data)?  deleted,required TResult orElse(),}) {final _that = this;
switch (_that) {
case GameEventSubscriptionUnionCreated() when created != null:
return created(_that.event,_that.data);case GameEventSubscriptionUnionChanged() when changed != null:
return changed(_that.event,_that.data);case GameEventSubscriptionUnionStarted() when started != null:
return started(_that.event,_that.data);case GameEventSubscriptionUnionDeleted() when deleted != null:
return deleted(_that.event,_that.data);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>({required TResult Function( GameUpdateEventSubscriptionEvent event,  GameListItem data)  created,required TResult Function( GameUpdateEventSubscriptionEvent event,  GameListItem data)  changed,required TResult Function( GameUpdateEventSubscriptionEvent event,  GameListItem data)  started,required TResult Function( GameDeleteEventSubscriptionEvent event,  Data data)  deleted,}) {final _that = this;
switch (_that) {
case GameEventSubscriptionUnionCreated():
return created(_that.event,_that.data);case GameEventSubscriptionUnionChanged():
return changed(_that.event,_that.data);case GameEventSubscriptionUnionStarted():
return started(_that.event,_that.data);case GameEventSubscriptionUnionDeleted():
return deleted(_that.event,_that.data);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>({TResult? Function( GameUpdateEventSubscriptionEvent event,  GameListItem data)?  created,TResult? Function( GameUpdateEventSubscriptionEvent event,  GameListItem data)?  changed,TResult? Function( GameUpdateEventSubscriptionEvent event,  GameListItem data)?  started,TResult? Function( GameDeleteEventSubscriptionEvent event,  Data data)?  deleted,}) {final _that = this;
switch (_that) {
case GameEventSubscriptionUnionCreated() when created != null:
return created(_that.event,_that.data);case GameEventSubscriptionUnionChanged() when changed != null:
return changed(_that.event,_that.data);case GameEventSubscriptionUnionStarted() when started != null:
return started(_that.event,_that.data);case GameEventSubscriptionUnionDeleted() when deleted != null:
return deleted(_that.event,_that.data);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class GameEventSubscriptionUnionCreated implements GameEventSubscriptionUnion {
  const GameEventSubscriptionUnionCreated({required this.event, required this.data});
  factory GameEventSubscriptionUnionCreated.fromJson(Map<String, dynamic> json) => _$GameEventSubscriptionUnionCreatedFromJson(json);

@override final  GameUpdateEventSubscriptionEvent event;
@override final  GameListItem data;

/// Create a copy of GameEventSubscriptionUnion
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GameEventSubscriptionUnionCreatedCopyWith<GameEventSubscriptionUnionCreated> get copyWith => _$GameEventSubscriptionUnionCreatedCopyWithImpl<GameEventSubscriptionUnionCreated>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GameEventSubscriptionUnionCreatedToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GameEventSubscriptionUnionCreated&&(identical(other.event, event) || other.event == event)&&(identical(other.data, data) || other.data == data));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,event,data);

@override
String toString() {
  return 'GameEventSubscriptionUnion.created(event: $event, data: $data)';
}


}

/// @nodoc
abstract mixin class $GameEventSubscriptionUnionCreatedCopyWith<$Res> implements $GameEventSubscriptionUnionCopyWith<$Res> {
  factory $GameEventSubscriptionUnionCreatedCopyWith(GameEventSubscriptionUnionCreated value, $Res Function(GameEventSubscriptionUnionCreated) _then) = _$GameEventSubscriptionUnionCreatedCopyWithImpl;
@useResult
$Res call({
 GameUpdateEventSubscriptionEvent event, GameListItem data
});


$GameListItemCopyWith<$Res> get data;

}
/// @nodoc
class _$GameEventSubscriptionUnionCreatedCopyWithImpl<$Res>
    implements $GameEventSubscriptionUnionCreatedCopyWith<$Res> {
  _$GameEventSubscriptionUnionCreatedCopyWithImpl(this._self, this._then);

  final GameEventSubscriptionUnionCreated _self;
  final $Res Function(GameEventSubscriptionUnionCreated) _then;

/// Create a copy of GameEventSubscriptionUnion
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? event = null,Object? data = null,}) {
  return _then(GameEventSubscriptionUnionCreated(
event: null == event ? _self.event : event // ignore: cast_nullable_to_non_nullable
as GameUpdateEventSubscriptionEvent,data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as GameListItem,
  ));
}

/// Create a copy of GameEventSubscriptionUnion
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameListItemCopyWith<$Res> get data {
  
  return $GameListItemCopyWith<$Res>(_self.data, (value) {
    return _then(_self.copyWith(data: value));
  });
}
}

/// @nodoc
@JsonSerializable()

class GameEventSubscriptionUnionChanged implements GameEventSubscriptionUnion {
  const GameEventSubscriptionUnionChanged({required this.event, required this.data});
  factory GameEventSubscriptionUnionChanged.fromJson(Map<String, dynamic> json) => _$GameEventSubscriptionUnionChangedFromJson(json);

@override final  GameUpdateEventSubscriptionEvent event;
@override final  GameListItem data;

/// Create a copy of GameEventSubscriptionUnion
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GameEventSubscriptionUnionChangedCopyWith<GameEventSubscriptionUnionChanged> get copyWith => _$GameEventSubscriptionUnionChangedCopyWithImpl<GameEventSubscriptionUnionChanged>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GameEventSubscriptionUnionChangedToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GameEventSubscriptionUnionChanged&&(identical(other.event, event) || other.event == event)&&(identical(other.data, data) || other.data == data));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,event,data);

@override
String toString() {
  return 'GameEventSubscriptionUnion.changed(event: $event, data: $data)';
}


}

/// @nodoc
abstract mixin class $GameEventSubscriptionUnionChangedCopyWith<$Res> implements $GameEventSubscriptionUnionCopyWith<$Res> {
  factory $GameEventSubscriptionUnionChangedCopyWith(GameEventSubscriptionUnionChanged value, $Res Function(GameEventSubscriptionUnionChanged) _then) = _$GameEventSubscriptionUnionChangedCopyWithImpl;
@useResult
$Res call({
 GameUpdateEventSubscriptionEvent event, GameListItem data
});


$GameListItemCopyWith<$Res> get data;

}
/// @nodoc
class _$GameEventSubscriptionUnionChangedCopyWithImpl<$Res>
    implements $GameEventSubscriptionUnionChangedCopyWith<$Res> {
  _$GameEventSubscriptionUnionChangedCopyWithImpl(this._self, this._then);

  final GameEventSubscriptionUnionChanged _self;
  final $Res Function(GameEventSubscriptionUnionChanged) _then;

/// Create a copy of GameEventSubscriptionUnion
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? event = null,Object? data = null,}) {
  return _then(GameEventSubscriptionUnionChanged(
event: null == event ? _self.event : event // ignore: cast_nullable_to_non_nullable
as GameUpdateEventSubscriptionEvent,data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as GameListItem,
  ));
}

/// Create a copy of GameEventSubscriptionUnion
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameListItemCopyWith<$Res> get data {
  
  return $GameListItemCopyWith<$Res>(_self.data, (value) {
    return _then(_self.copyWith(data: value));
  });
}
}

/// @nodoc
@JsonSerializable()

class GameEventSubscriptionUnionStarted implements GameEventSubscriptionUnion {
  const GameEventSubscriptionUnionStarted({required this.event, required this.data});
  factory GameEventSubscriptionUnionStarted.fromJson(Map<String, dynamic> json) => _$GameEventSubscriptionUnionStartedFromJson(json);

@override final  GameUpdateEventSubscriptionEvent event;
@override final  GameListItem data;

/// Create a copy of GameEventSubscriptionUnion
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GameEventSubscriptionUnionStartedCopyWith<GameEventSubscriptionUnionStarted> get copyWith => _$GameEventSubscriptionUnionStartedCopyWithImpl<GameEventSubscriptionUnionStarted>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GameEventSubscriptionUnionStartedToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GameEventSubscriptionUnionStarted&&(identical(other.event, event) || other.event == event)&&(identical(other.data, data) || other.data == data));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,event,data);

@override
String toString() {
  return 'GameEventSubscriptionUnion.started(event: $event, data: $data)';
}


}

/// @nodoc
abstract mixin class $GameEventSubscriptionUnionStartedCopyWith<$Res> implements $GameEventSubscriptionUnionCopyWith<$Res> {
  factory $GameEventSubscriptionUnionStartedCopyWith(GameEventSubscriptionUnionStarted value, $Res Function(GameEventSubscriptionUnionStarted) _then) = _$GameEventSubscriptionUnionStartedCopyWithImpl;
@useResult
$Res call({
 GameUpdateEventSubscriptionEvent event, GameListItem data
});


$GameListItemCopyWith<$Res> get data;

}
/// @nodoc
class _$GameEventSubscriptionUnionStartedCopyWithImpl<$Res>
    implements $GameEventSubscriptionUnionStartedCopyWith<$Res> {
  _$GameEventSubscriptionUnionStartedCopyWithImpl(this._self, this._then);

  final GameEventSubscriptionUnionStarted _self;
  final $Res Function(GameEventSubscriptionUnionStarted) _then;

/// Create a copy of GameEventSubscriptionUnion
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? event = null,Object? data = null,}) {
  return _then(GameEventSubscriptionUnionStarted(
event: null == event ? _self.event : event // ignore: cast_nullable_to_non_nullable
as GameUpdateEventSubscriptionEvent,data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as GameListItem,
  ));
}

/// Create a copy of GameEventSubscriptionUnion
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameListItemCopyWith<$Res> get data {
  
  return $GameListItemCopyWith<$Res>(_self.data, (value) {
    return _then(_self.copyWith(data: value));
  });
}
}

/// @nodoc
@JsonSerializable()

class GameEventSubscriptionUnionDeleted implements GameEventSubscriptionUnion {
  const GameEventSubscriptionUnionDeleted({required this.event, required this.data});
  factory GameEventSubscriptionUnionDeleted.fromJson(Map<String, dynamic> json) => _$GameEventSubscriptionUnionDeletedFromJson(json);

@override final  GameDeleteEventSubscriptionEvent event;
@override final  Data data;

/// Create a copy of GameEventSubscriptionUnion
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GameEventSubscriptionUnionDeletedCopyWith<GameEventSubscriptionUnionDeleted> get copyWith => _$GameEventSubscriptionUnionDeletedCopyWithImpl<GameEventSubscriptionUnionDeleted>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GameEventSubscriptionUnionDeletedToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GameEventSubscriptionUnionDeleted&&(identical(other.event, event) || other.event == event)&&(identical(other.data, data) || other.data == data));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,event,data);

@override
String toString() {
  return 'GameEventSubscriptionUnion.deleted(event: $event, data: $data)';
}


}

/// @nodoc
abstract mixin class $GameEventSubscriptionUnionDeletedCopyWith<$Res> implements $GameEventSubscriptionUnionCopyWith<$Res> {
  factory $GameEventSubscriptionUnionDeletedCopyWith(GameEventSubscriptionUnionDeleted value, $Res Function(GameEventSubscriptionUnionDeleted) _then) = _$GameEventSubscriptionUnionDeletedCopyWithImpl;
@useResult
$Res call({
 GameDeleteEventSubscriptionEvent event, Data data
});


$DataCopyWith<$Res> get data;

}
/// @nodoc
class _$GameEventSubscriptionUnionDeletedCopyWithImpl<$Res>
    implements $GameEventSubscriptionUnionDeletedCopyWith<$Res> {
  _$GameEventSubscriptionUnionDeletedCopyWithImpl(this._self, this._then);

  final GameEventSubscriptionUnionDeleted _self;
  final $Res Function(GameEventSubscriptionUnionDeleted) _then;

/// Create a copy of GameEventSubscriptionUnion
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? event = null,Object? data = null,}) {
  return _then(GameEventSubscriptionUnionDeleted(
event: null == event ? _self.event : event // ignore: cast_nullable_to_non_nullable
as GameDeleteEventSubscriptionEvent,data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as Data,
  ));
}

/// Create a copy of GameEventSubscriptionUnion
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
