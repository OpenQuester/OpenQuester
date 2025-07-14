// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'game_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$GameState {

 GameStateQuestionState? get questionState; bool get isPaused;/// Id of player who is currently answering
 int? get answeringPlayer; List<GameStateAnsweredPlayer>? get answeredPlayers; SocketIOGameStateRoundData? get currentRound; PackageQuestionData? get currentQuestion; GameStateTimer? get timer; FinalRoundGameData? get finalRoundData;/// Id of player whose turn it is to pick a question or eliminate theme
 int? get currentTurnPlayerId;
/// Create a copy of GameState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GameStateCopyWith<GameState> get copyWith => _$GameStateCopyWithImpl<GameState>(this as GameState, _$identity);

  /// Serializes this GameState to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GameState&&(identical(other.questionState, questionState) || other.questionState == questionState)&&(identical(other.isPaused, isPaused) || other.isPaused == isPaused)&&(identical(other.answeringPlayer, answeringPlayer) || other.answeringPlayer == answeringPlayer)&&const DeepCollectionEquality().equals(other.answeredPlayers, answeredPlayers)&&(identical(other.currentRound, currentRound) || other.currentRound == currentRound)&&(identical(other.currentQuestion, currentQuestion) || other.currentQuestion == currentQuestion)&&(identical(other.timer, timer) || other.timer == timer)&&(identical(other.finalRoundData, finalRoundData) || other.finalRoundData == finalRoundData)&&(identical(other.currentTurnPlayerId, currentTurnPlayerId) || other.currentTurnPlayerId == currentTurnPlayerId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,questionState,isPaused,answeringPlayer,const DeepCollectionEquality().hash(answeredPlayers),currentRound,currentQuestion,timer,finalRoundData,currentTurnPlayerId);

@override
String toString() {
  return 'GameState(questionState: $questionState, isPaused: $isPaused, answeringPlayer: $answeringPlayer, answeredPlayers: $answeredPlayers, currentRound: $currentRound, currentQuestion: $currentQuestion, timer: $timer, finalRoundData: $finalRoundData, currentTurnPlayerId: $currentTurnPlayerId)';
}


}

/// @nodoc
abstract mixin class $GameStateCopyWith<$Res>  {
  factory $GameStateCopyWith(GameState value, $Res Function(GameState) _then) = _$GameStateCopyWithImpl;
@useResult
$Res call({
 GameStateQuestionState? questionState, bool isPaused, int? answeringPlayer, List<GameStateAnsweredPlayer>? answeredPlayers, SocketIOGameStateRoundData? currentRound, PackageQuestionData? currentQuestion, GameStateTimer? timer, FinalRoundGameData? finalRoundData, int? currentTurnPlayerId
});


$SocketIOGameStateRoundDataCopyWith<$Res>? get currentRound;$PackageQuestionDataCopyWith<$Res>? get currentQuestion;$GameStateTimerCopyWith<$Res>? get timer;$FinalRoundGameDataCopyWith<$Res>? get finalRoundData;

}
/// @nodoc
class _$GameStateCopyWithImpl<$Res>
    implements $GameStateCopyWith<$Res> {
  _$GameStateCopyWithImpl(this._self, this._then);

  final GameState _self;
  final $Res Function(GameState) _then;

/// Create a copy of GameState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? questionState = freezed,Object? isPaused = null,Object? answeringPlayer = freezed,Object? answeredPlayers = freezed,Object? currentRound = freezed,Object? currentQuestion = freezed,Object? timer = freezed,Object? finalRoundData = freezed,Object? currentTurnPlayerId = freezed,}) {
  return _then(_self.copyWith(
questionState: freezed == questionState ? _self.questionState : questionState // ignore: cast_nullable_to_non_nullable
as GameStateQuestionState?,isPaused: null == isPaused ? _self.isPaused : isPaused // ignore: cast_nullable_to_non_nullable
as bool,answeringPlayer: freezed == answeringPlayer ? _self.answeringPlayer : answeringPlayer // ignore: cast_nullable_to_non_nullable
as int?,answeredPlayers: freezed == answeredPlayers ? _self.answeredPlayers : answeredPlayers // ignore: cast_nullable_to_non_nullable
as List<GameStateAnsweredPlayer>?,currentRound: freezed == currentRound ? _self.currentRound : currentRound // ignore: cast_nullable_to_non_nullable
as SocketIOGameStateRoundData?,currentQuestion: freezed == currentQuestion ? _self.currentQuestion : currentQuestion // ignore: cast_nullable_to_non_nullable
as PackageQuestionData?,timer: freezed == timer ? _self.timer : timer // ignore: cast_nullable_to_non_nullable
as GameStateTimer?,finalRoundData: freezed == finalRoundData ? _self.finalRoundData : finalRoundData // ignore: cast_nullable_to_non_nullable
as FinalRoundGameData?,currentTurnPlayerId: freezed == currentTurnPlayerId ? _self.currentTurnPlayerId : currentTurnPlayerId // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}
/// Create a copy of GameState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SocketIOGameStateRoundDataCopyWith<$Res>? get currentRound {
    if (_self.currentRound == null) {
    return null;
  }

  return $SocketIOGameStateRoundDataCopyWith<$Res>(_self.currentRound!, (value) {
    return _then(_self.copyWith(currentRound: value));
  });
}/// Create a copy of GameState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PackageQuestionDataCopyWith<$Res>? get currentQuestion {
    if (_self.currentQuestion == null) {
    return null;
  }

  return $PackageQuestionDataCopyWith<$Res>(_self.currentQuestion!, (value) {
    return _then(_self.copyWith(currentQuestion: value));
  });
}/// Create a copy of GameState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameStateTimerCopyWith<$Res>? get timer {
    if (_self.timer == null) {
    return null;
  }

  return $GameStateTimerCopyWith<$Res>(_self.timer!, (value) {
    return _then(_self.copyWith(timer: value));
  });
}/// Create a copy of GameState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FinalRoundGameDataCopyWith<$Res>? get finalRoundData {
    if (_self.finalRoundData == null) {
    return null;
  }

  return $FinalRoundGameDataCopyWith<$Res>(_self.finalRoundData!, (value) {
    return _then(_self.copyWith(finalRoundData: value));
  });
}
}


/// Adds pattern-matching-related methods to [GameState].
extension GameStatePatterns on GameState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GameState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GameState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GameState value)  $default,){
final _that = this;
switch (_that) {
case _GameState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GameState value)?  $default,){
final _that = this;
switch (_that) {
case _GameState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( GameStateQuestionState? questionState,  bool isPaused,  int? answeringPlayer,  List<GameStateAnsweredPlayer>? answeredPlayers,  SocketIOGameStateRoundData? currentRound,  PackageQuestionData? currentQuestion,  GameStateTimer? timer,  FinalRoundGameData? finalRoundData,  int? currentTurnPlayerId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GameState() when $default != null:
return $default(_that.questionState,_that.isPaused,_that.answeringPlayer,_that.answeredPlayers,_that.currentRound,_that.currentQuestion,_that.timer,_that.finalRoundData,_that.currentTurnPlayerId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( GameStateQuestionState? questionState,  bool isPaused,  int? answeringPlayer,  List<GameStateAnsweredPlayer>? answeredPlayers,  SocketIOGameStateRoundData? currentRound,  PackageQuestionData? currentQuestion,  GameStateTimer? timer,  FinalRoundGameData? finalRoundData,  int? currentTurnPlayerId)  $default,) {final _that = this;
switch (_that) {
case _GameState():
return $default(_that.questionState,_that.isPaused,_that.answeringPlayer,_that.answeredPlayers,_that.currentRound,_that.currentQuestion,_that.timer,_that.finalRoundData,_that.currentTurnPlayerId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( GameStateQuestionState? questionState,  bool isPaused,  int? answeringPlayer,  List<GameStateAnsweredPlayer>? answeredPlayers,  SocketIOGameStateRoundData? currentRound,  PackageQuestionData? currentQuestion,  GameStateTimer? timer,  FinalRoundGameData? finalRoundData,  int? currentTurnPlayerId)?  $default,) {final _that = this;
switch (_that) {
case _GameState() when $default != null:
return $default(_that.questionState,_that.isPaused,_that.answeringPlayer,_that.answeredPlayers,_that.currentRound,_that.currentQuestion,_that.timer,_that.finalRoundData,_that.currentTurnPlayerId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GameState implements GameState {
  const _GameState({required this.questionState, required this.isPaused, required this.answeringPlayer, required final  List<GameStateAnsweredPlayer>? answeredPlayers, this.currentRound, this.currentQuestion, this.timer, this.finalRoundData, this.currentTurnPlayerId}): _answeredPlayers = answeredPlayers;
  factory _GameState.fromJson(Map<String, dynamic> json) => _$GameStateFromJson(json);

@override final  GameStateQuestionState? questionState;
@override final  bool isPaused;
/// Id of player who is currently answering
@override final  int? answeringPlayer;
 final  List<GameStateAnsweredPlayer>? _answeredPlayers;
@override List<GameStateAnsweredPlayer>? get answeredPlayers {
  final value = _answeredPlayers;
  if (value == null) return null;
  if (_answeredPlayers is EqualUnmodifiableListView) return _answeredPlayers;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

@override final  SocketIOGameStateRoundData? currentRound;
@override final  PackageQuestionData? currentQuestion;
@override final  GameStateTimer? timer;
@override final  FinalRoundGameData? finalRoundData;
/// Id of player whose turn it is to pick a question or eliminate theme
@override final  int? currentTurnPlayerId;

/// Create a copy of GameState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GameStateCopyWith<_GameState> get copyWith => __$GameStateCopyWithImpl<_GameState>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GameStateToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _GameState&&(identical(other.questionState, questionState) || other.questionState == questionState)&&(identical(other.isPaused, isPaused) || other.isPaused == isPaused)&&(identical(other.answeringPlayer, answeringPlayer) || other.answeringPlayer == answeringPlayer)&&const DeepCollectionEquality().equals(other._answeredPlayers, _answeredPlayers)&&(identical(other.currentRound, currentRound) || other.currentRound == currentRound)&&(identical(other.currentQuestion, currentQuestion) || other.currentQuestion == currentQuestion)&&(identical(other.timer, timer) || other.timer == timer)&&(identical(other.finalRoundData, finalRoundData) || other.finalRoundData == finalRoundData)&&(identical(other.currentTurnPlayerId, currentTurnPlayerId) || other.currentTurnPlayerId == currentTurnPlayerId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,questionState,isPaused,answeringPlayer,const DeepCollectionEquality().hash(_answeredPlayers),currentRound,currentQuestion,timer,finalRoundData,currentTurnPlayerId);

@override
String toString() {
  return 'GameState(questionState: $questionState, isPaused: $isPaused, answeringPlayer: $answeringPlayer, answeredPlayers: $answeredPlayers, currentRound: $currentRound, currentQuestion: $currentQuestion, timer: $timer, finalRoundData: $finalRoundData, currentTurnPlayerId: $currentTurnPlayerId)';
}


}

/// @nodoc
abstract mixin class _$GameStateCopyWith<$Res> implements $GameStateCopyWith<$Res> {
  factory _$GameStateCopyWith(_GameState value, $Res Function(_GameState) _then) = __$GameStateCopyWithImpl;
@override @useResult
$Res call({
 GameStateQuestionState? questionState, bool isPaused, int? answeringPlayer, List<GameStateAnsweredPlayer>? answeredPlayers, SocketIOGameStateRoundData? currentRound, PackageQuestionData? currentQuestion, GameStateTimer? timer, FinalRoundGameData? finalRoundData, int? currentTurnPlayerId
});


@override $SocketIOGameStateRoundDataCopyWith<$Res>? get currentRound;@override $PackageQuestionDataCopyWith<$Res>? get currentQuestion;@override $GameStateTimerCopyWith<$Res>? get timer;@override $FinalRoundGameDataCopyWith<$Res>? get finalRoundData;

}
/// @nodoc
class __$GameStateCopyWithImpl<$Res>
    implements _$GameStateCopyWith<$Res> {
  __$GameStateCopyWithImpl(this._self, this._then);

  final _GameState _self;
  final $Res Function(_GameState) _then;

/// Create a copy of GameState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? questionState = freezed,Object? isPaused = null,Object? answeringPlayer = freezed,Object? answeredPlayers = freezed,Object? currentRound = freezed,Object? currentQuestion = freezed,Object? timer = freezed,Object? finalRoundData = freezed,Object? currentTurnPlayerId = freezed,}) {
  return _then(_GameState(
questionState: freezed == questionState ? _self.questionState : questionState // ignore: cast_nullable_to_non_nullable
as GameStateQuestionState?,isPaused: null == isPaused ? _self.isPaused : isPaused // ignore: cast_nullable_to_non_nullable
as bool,answeringPlayer: freezed == answeringPlayer ? _self.answeringPlayer : answeringPlayer // ignore: cast_nullable_to_non_nullable
as int?,answeredPlayers: freezed == answeredPlayers ? _self._answeredPlayers : answeredPlayers // ignore: cast_nullable_to_non_nullable
as List<GameStateAnsweredPlayer>?,currentRound: freezed == currentRound ? _self.currentRound : currentRound // ignore: cast_nullable_to_non_nullable
as SocketIOGameStateRoundData?,currentQuestion: freezed == currentQuestion ? _self.currentQuestion : currentQuestion // ignore: cast_nullable_to_non_nullable
as PackageQuestionData?,timer: freezed == timer ? _self.timer : timer // ignore: cast_nullable_to_non_nullable
as GameStateTimer?,finalRoundData: freezed == finalRoundData ? _self.finalRoundData : finalRoundData // ignore: cast_nullable_to_non_nullable
as FinalRoundGameData?,currentTurnPlayerId: freezed == currentTurnPlayerId ? _self.currentTurnPlayerId : currentTurnPlayerId // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

/// Create a copy of GameState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SocketIOGameStateRoundDataCopyWith<$Res>? get currentRound {
    if (_self.currentRound == null) {
    return null;
  }

  return $SocketIOGameStateRoundDataCopyWith<$Res>(_self.currentRound!, (value) {
    return _then(_self.copyWith(currentRound: value));
  });
}/// Create a copy of GameState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PackageQuestionDataCopyWith<$Res>? get currentQuestion {
    if (_self.currentQuestion == null) {
    return null;
  }

  return $PackageQuestionDataCopyWith<$Res>(_self.currentQuestion!, (value) {
    return _then(_self.copyWith(currentQuestion: value));
  });
}/// Create a copy of GameState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameStateTimerCopyWith<$Res>? get timer {
    if (_self.timer == null) {
    return null;
  }

  return $GameStateTimerCopyWith<$Res>(_self.timer!, (value) {
    return _then(_self.copyWith(timer: value));
  });
}/// Create a copy of GameState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FinalRoundGameDataCopyWith<$Res>? get finalRoundData {
    if (_self.finalRoundData == null) {
    return null;
  }

  return $FinalRoundGameDataCopyWith<$Res>(_self.finalRoundData!, (value) {
    return _then(_self.copyWith(finalRoundData: value));
  });
}
}

// dart format on
