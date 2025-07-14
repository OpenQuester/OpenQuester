// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'game_state_answered_player.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$GameStateAnsweredPlayer {

/// Id of answered player
 int get player; int get result; int get score; SocketIOGameAnswerType get answerType;
/// Create a copy of GameStateAnsweredPlayer
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GameStateAnsweredPlayerCopyWith<GameStateAnsweredPlayer> get copyWith => _$GameStateAnsweredPlayerCopyWithImpl<GameStateAnsweredPlayer>(this as GameStateAnsweredPlayer, _$identity);

  /// Serializes this GameStateAnsweredPlayer to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GameStateAnsweredPlayer&&(identical(other.player, player) || other.player == player)&&(identical(other.result, result) || other.result == result)&&(identical(other.score, score) || other.score == score)&&(identical(other.answerType, answerType) || other.answerType == answerType));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,player,result,score,answerType);

@override
String toString() {
  return 'GameStateAnsweredPlayer(player: $player, result: $result, score: $score, answerType: $answerType)';
}


}

/// @nodoc
abstract mixin class $GameStateAnsweredPlayerCopyWith<$Res>  {
  factory $GameStateAnsweredPlayerCopyWith(GameStateAnsweredPlayer value, $Res Function(GameStateAnsweredPlayer) _then) = _$GameStateAnsweredPlayerCopyWithImpl;
@useResult
$Res call({
 int player, int result, int score, SocketIOGameAnswerType answerType
});




}
/// @nodoc
class _$GameStateAnsweredPlayerCopyWithImpl<$Res>
    implements $GameStateAnsweredPlayerCopyWith<$Res> {
  _$GameStateAnsweredPlayerCopyWithImpl(this._self, this._then);

  final GameStateAnsweredPlayer _self;
  final $Res Function(GameStateAnsweredPlayer) _then;

/// Create a copy of GameStateAnsweredPlayer
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? player = null,Object? result = null,Object? score = null,Object? answerType = null,}) {
  return _then(_self.copyWith(
player: null == player ? _self.player : player // ignore: cast_nullable_to_non_nullable
as int,result: null == result ? _self.result : result // ignore: cast_nullable_to_non_nullable
as int,score: null == score ? _self.score : score // ignore: cast_nullable_to_non_nullable
as int,answerType: null == answerType ? _self.answerType : answerType // ignore: cast_nullable_to_non_nullable
as SocketIOGameAnswerType,
  ));
}

}


/// Adds pattern-matching-related methods to [GameStateAnsweredPlayer].
extension GameStateAnsweredPlayerPatterns on GameStateAnsweredPlayer {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GameStateAnsweredPlayer value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GameStateAnsweredPlayer() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GameStateAnsweredPlayer value)  $default,){
final _that = this;
switch (_that) {
case _GameStateAnsweredPlayer():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GameStateAnsweredPlayer value)?  $default,){
final _that = this;
switch (_that) {
case _GameStateAnsweredPlayer() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int player,  int result,  int score,  SocketIOGameAnswerType answerType)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GameStateAnsweredPlayer() when $default != null:
return $default(_that.player,_that.result,_that.score,_that.answerType);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int player,  int result,  int score,  SocketIOGameAnswerType answerType)  $default,) {final _that = this;
switch (_that) {
case _GameStateAnsweredPlayer():
return $default(_that.player,_that.result,_that.score,_that.answerType);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int player,  int result,  int score,  SocketIOGameAnswerType answerType)?  $default,) {final _that = this;
switch (_that) {
case _GameStateAnsweredPlayer() when $default != null:
return $default(_that.player,_that.result,_that.score,_that.answerType);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GameStateAnsweredPlayer implements GameStateAnsweredPlayer {
  const _GameStateAnsweredPlayer({required this.player, required this.result, required this.score, required this.answerType});
  factory _GameStateAnsweredPlayer.fromJson(Map<String, dynamic> json) => _$GameStateAnsweredPlayerFromJson(json);

/// Id of answered player
@override final  int player;
@override final  int result;
@override final  int score;
@override final  SocketIOGameAnswerType answerType;

/// Create a copy of GameStateAnsweredPlayer
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GameStateAnsweredPlayerCopyWith<_GameStateAnsweredPlayer> get copyWith => __$GameStateAnsweredPlayerCopyWithImpl<_GameStateAnsweredPlayer>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GameStateAnsweredPlayerToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _GameStateAnsweredPlayer&&(identical(other.player, player) || other.player == player)&&(identical(other.result, result) || other.result == result)&&(identical(other.score, score) || other.score == score)&&(identical(other.answerType, answerType) || other.answerType == answerType));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,player,result,score,answerType);

@override
String toString() {
  return 'GameStateAnsweredPlayer(player: $player, result: $result, score: $score, answerType: $answerType)';
}


}

/// @nodoc
abstract mixin class _$GameStateAnsweredPlayerCopyWith<$Res> implements $GameStateAnsweredPlayerCopyWith<$Res> {
  factory _$GameStateAnsweredPlayerCopyWith(_GameStateAnsweredPlayer value, $Res Function(_GameStateAnsweredPlayer) _then) = __$GameStateAnsweredPlayerCopyWithImpl;
@override @useResult
$Res call({
 int player, int result, int score, SocketIOGameAnswerType answerType
});




}
/// @nodoc
class __$GameStateAnsweredPlayerCopyWithImpl<$Res>
    implements _$GameStateAnsweredPlayerCopyWith<$Res> {
  __$GameStateAnsweredPlayerCopyWithImpl(this._self, this._then);

  final _GameStateAnsweredPlayer _self;
  final $Res Function(_GameStateAnsweredPlayer) _then;

/// Create a copy of GameStateAnsweredPlayer
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? player = null,Object? result = null,Object? score = null,Object? answerType = null,}) {
  return _then(_GameStateAnsweredPlayer(
player: null == player ? _self.player : player // ignore: cast_nullable_to_non_nullable
as int,result: null == result ? _self.result : result // ignore: cast_nullable_to_non_nullable
as int,score: null == score ? _self.score : score // ignore: cast_nullable_to_non_nullable
as int,answerType: null == answerType ? _self.answerType : answerType // ignore: cast_nullable_to_non_nullable
as SocketIOGameAnswerType,
  ));
}


}

// dart format on
