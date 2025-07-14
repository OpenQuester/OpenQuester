// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'socket_io_game_join_event_payload.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SocketIOGameJoinEventPayload {

 SocketIOGameJoinMeta get meta;/// Players in the game
 List<PlayerData> get players;/// Current game state
 GameState get gameState;/// Last 100 chat messages, sorted 'DESC'
 List<SocketIOChatMessageEventPayload> get chatMessages;
/// Create a copy of SocketIOGameJoinEventPayload
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SocketIOGameJoinEventPayloadCopyWith<SocketIOGameJoinEventPayload> get copyWith => _$SocketIOGameJoinEventPayloadCopyWithImpl<SocketIOGameJoinEventPayload>(this as SocketIOGameJoinEventPayload, _$identity);

  /// Serializes this SocketIOGameJoinEventPayload to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SocketIOGameJoinEventPayload&&(identical(other.meta, meta) || other.meta == meta)&&const DeepCollectionEquality().equals(other.players, players)&&(identical(other.gameState, gameState) || other.gameState == gameState)&&const DeepCollectionEquality().equals(other.chatMessages, chatMessages));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,meta,const DeepCollectionEquality().hash(players),gameState,const DeepCollectionEquality().hash(chatMessages));

@override
String toString() {
  return 'SocketIOGameJoinEventPayload(meta: $meta, players: $players, gameState: $gameState, chatMessages: $chatMessages)';
}


}

/// @nodoc
abstract mixin class $SocketIOGameJoinEventPayloadCopyWith<$Res>  {
  factory $SocketIOGameJoinEventPayloadCopyWith(SocketIOGameJoinEventPayload value, $Res Function(SocketIOGameJoinEventPayload) _then) = _$SocketIOGameJoinEventPayloadCopyWithImpl;
@useResult
$Res call({
 SocketIOGameJoinMeta meta, List<PlayerData> players, GameState gameState, List<SocketIOChatMessageEventPayload> chatMessages
});


$SocketIOGameJoinMetaCopyWith<$Res> get meta;$GameStateCopyWith<$Res> get gameState;

}
/// @nodoc
class _$SocketIOGameJoinEventPayloadCopyWithImpl<$Res>
    implements $SocketIOGameJoinEventPayloadCopyWith<$Res> {
  _$SocketIOGameJoinEventPayloadCopyWithImpl(this._self, this._then);

  final SocketIOGameJoinEventPayload _self;
  final $Res Function(SocketIOGameJoinEventPayload) _then;

/// Create a copy of SocketIOGameJoinEventPayload
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? meta = null,Object? players = null,Object? gameState = null,Object? chatMessages = null,}) {
  return _then(_self.copyWith(
meta: null == meta ? _self.meta : meta // ignore: cast_nullable_to_non_nullable
as SocketIOGameJoinMeta,players: null == players ? _self.players : players // ignore: cast_nullable_to_non_nullable
as List<PlayerData>,gameState: null == gameState ? _self.gameState : gameState // ignore: cast_nullable_to_non_nullable
as GameState,chatMessages: null == chatMessages ? _self.chatMessages : chatMessages // ignore: cast_nullable_to_non_nullable
as List<SocketIOChatMessageEventPayload>,
  ));
}
/// Create a copy of SocketIOGameJoinEventPayload
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SocketIOGameJoinMetaCopyWith<$Res> get meta {
  
  return $SocketIOGameJoinMetaCopyWith<$Res>(_self.meta, (value) {
    return _then(_self.copyWith(meta: value));
  });
}/// Create a copy of SocketIOGameJoinEventPayload
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameStateCopyWith<$Res> get gameState {
  
  return $GameStateCopyWith<$Res>(_self.gameState, (value) {
    return _then(_self.copyWith(gameState: value));
  });
}
}


/// Adds pattern-matching-related methods to [SocketIOGameJoinEventPayload].
extension SocketIOGameJoinEventPayloadPatterns on SocketIOGameJoinEventPayload {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SocketIOGameJoinEventPayload value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SocketIOGameJoinEventPayload() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SocketIOGameJoinEventPayload value)  $default,){
final _that = this;
switch (_that) {
case _SocketIOGameJoinEventPayload():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SocketIOGameJoinEventPayload value)?  $default,){
final _that = this;
switch (_that) {
case _SocketIOGameJoinEventPayload() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( SocketIOGameJoinMeta meta,  List<PlayerData> players,  GameState gameState,  List<SocketIOChatMessageEventPayload> chatMessages)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SocketIOGameJoinEventPayload() when $default != null:
return $default(_that.meta,_that.players,_that.gameState,_that.chatMessages);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( SocketIOGameJoinMeta meta,  List<PlayerData> players,  GameState gameState,  List<SocketIOChatMessageEventPayload> chatMessages)  $default,) {final _that = this;
switch (_that) {
case _SocketIOGameJoinEventPayload():
return $default(_that.meta,_that.players,_that.gameState,_that.chatMessages);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( SocketIOGameJoinMeta meta,  List<PlayerData> players,  GameState gameState,  List<SocketIOChatMessageEventPayload> chatMessages)?  $default,) {final _that = this;
switch (_that) {
case _SocketIOGameJoinEventPayload() when $default != null:
return $default(_that.meta,_that.players,_that.gameState,_that.chatMessages);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SocketIOGameJoinEventPayload implements SocketIOGameJoinEventPayload {
  const _SocketIOGameJoinEventPayload({required this.meta, required final  List<PlayerData> players, required this.gameState, required final  List<SocketIOChatMessageEventPayload> chatMessages}): _players = players,_chatMessages = chatMessages;
  factory _SocketIOGameJoinEventPayload.fromJson(Map<String, dynamic> json) => _$SocketIOGameJoinEventPayloadFromJson(json);

@override final  SocketIOGameJoinMeta meta;
/// Players in the game
 final  List<PlayerData> _players;
/// Players in the game
@override List<PlayerData> get players {
  if (_players is EqualUnmodifiableListView) return _players;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_players);
}

/// Current game state
@override final  GameState gameState;
/// Last 100 chat messages, sorted 'DESC'
 final  List<SocketIOChatMessageEventPayload> _chatMessages;
/// Last 100 chat messages, sorted 'DESC'
@override List<SocketIOChatMessageEventPayload> get chatMessages {
  if (_chatMessages is EqualUnmodifiableListView) return _chatMessages;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_chatMessages);
}


/// Create a copy of SocketIOGameJoinEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SocketIOGameJoinEventPayloadCopyWith<_SocketIOGameJoinEventPayload> get copyWith => __$SocketIOGameJoinEventPayloadCopyWithImpl<_SocketIOGameJoinEventPayload>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SocketIOGameJoinEventPayloadToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SocketIOGameJoinEventPayload&&(identical(other.meta, meta) || other.meta == meta)&&const DeepCollectionEquality().equals(other._players, _players)&&(identical(other.gameState, gameState) || other.gameState == gameState)&&const DeepCollectionEquality().equals(other._chatMessages, _chatMessages));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,meta,const DeepCollectionEquality().hash(_players),gameState,const DeepCollectionEquality().hash(_chatMessages));

@override
String toString() {
  return 'SocketIOGameJoinEventPayload(meta: $meta, players: $players, gameState: $gameState, chatMessages: $chatMessages)';
}


}

/// @nodoc
abstract mixin class _$SocketIOGameJoinEventPayloadCopyWith<$Res> implements $SocketIOGameJoinEventPayloadCopyWith<$Res> {
  factory _$SocketIOGameJoinEventPayloadCopyWith(_SocketIOGameJoinEventPayload value, $Res Function(_SocketIOGameJoinEventPayload) _then) = __$SocketIOGameJoinEventPayloadCopyWithImpl;
@override @useResult
$Res call({
 SocketIOGameJoinMeta meta, List<PlayerData> players, GameState gameState, List<SocketIOChatMessageEventPayload> chatMessages
});


@override $SocketIOGameJoinMetaCopyWith<$Res> get meta;@override $GameStateCopyWith<$Res> get gameState;

}
/// @nodoc
class __$SocketIOGameJoinEventPayloadCopyWithImpl<$Res>
    implements _$SocketIOGameJoinEventPayloadCopyWith<$Res> {
  __$SocketIOGameJoinEventPayloadCopyWithImpl(this._self, this._then);

  final _SocketIOGameJoinEventPayload _self;
  final $Res Function(_SocketIOGameJoinEventPayload) _then;

/// Create a copy of SocketIOGameJoinEventPayload
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? meta = null,Object? players = null,Object? gameState = null,Object? chatMessages = null,}) {
  return _then(_SocketIOGameJoinEventPayload(
meta: null == meta ? _self.meta : meta // ignore: cast_nullable_to_non_nullable
as SocketIOGameJoinMeta,players: null == players ? _self._players : players // ignore: cast_nullable_to_non_nullable
as List<PlayerData>,gameState: null == gameState ? _self.gameState : gameState // ignore: cast_nullable_to_non_nullable
as GameState,chatMessages: null == chatMessages ? _self._chatMessages : chatMessages // ignore: cast_nullable_to_non_nullable
as List<SocketIOChatMessageEventPayload>,
  ));
}

/// Create a copy of SocketIOGameJoinEventPayload
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SocketIOGameJoinMetaCopyWith<$Res> get meta {
  
  return $SocketIOGameJoinMetaCopyWith<$Res>(_self.meta, (value) {
    return _then(_self.copyWith(meta: value));
  });
}/// Create a copy of SocketIOGameJoinEventPayload
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameStateCopyWith<$Res> get gameState {
  
  return $GameStateCopyWith<$Res>(_self.gameState, (value) {
    return _then(_self.copyWith(gameState: value));
  });
}
}

// dart format on
