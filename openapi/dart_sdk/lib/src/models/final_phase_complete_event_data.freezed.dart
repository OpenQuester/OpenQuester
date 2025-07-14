// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_phase_complete_event_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalPhaseCompleteEventData {

 FinalRoundPhase get phase; FinalRoundPhase get nextPhase; GameStateTimer get timer;
/// Create a copy of FinalPhaseCompleteEventData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalPhaseCompleteEventDataCopyWith<FinalPhaseCompleteEventData> get copyWith => _$FinalPhaseCompleteEventDataCopyWithImpl<FinalPhaseCompleteEventData>(this as FinalPhaseCompleteEventData, _$identity);

  /// Serializes this FinalPhaseCompleteEventData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalPhaseCompleteEventData&&(identical(other.phase, phase) || other.phase == phase)&&(identical(other.nextPhase, nextPhase) || other.nextPhase == nextPhase)&&(identical(other.timer, timer) || other.timer == timer));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,phase,nextPhase,timer);

@override
String toString() {
  return 'FinalPhaseCompleteEventData(phase: $phase, nextPhase: $nextPhase, timer: $timer)';
}


}

/// @nodoc
abstract mixin class $FinalPhaseCompleteEventDataCopyWith<$Res>  {
  factory $FinalPhaseCompleteEventDataCopyWith(FinalPhaseCompleteEventData value, $Res Function(FinalPhaseCompleteEventData) _then) = _$FinalPhaseCompleteEventDataCopyWithImpl;
@useResult
$Res call({
 FinalRoundPhase phase, FinalRoundPhase nextPhase, GameStateTimer timer
});


$GameStateTimerCopyWith<$Res> get timer;

}
/// @nodoc
class _$FinalPhaseCompleteEventDataCopyWithImpl<$Res>
    implements $FinalPhaseCompleteEventDataCopyWith<$Res> {
  _$FinalPhaseCompleteEventDataCopyWithImpl(this._self, this._then);

  final FinalPhaseCompleteEventData _self;
  final $Res Function(FinalPhaseCompleteEventData) _then;

/// Create a copy of FinalPhaseCompleteEventData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? phase = null,Object? nextPhase = null,Object? timer = null,}) {
  return _then(_self.copyWith(
phase: null == phase ? _self.phase : phase // ignore: cast_nullable_to_non_nullable
as FinalRoundPhase,nextPhase: null == nextPhase ? _self.nextPhase : nextPhase // ignore: cast_nullable_to_non_nullable
as FinalRoundPhase,timer: null == timer ? _self.timer : timer // ignore: cast_nullable_to_non_nullable
as GameStateTimer,
  ));
}
/// Create a copy of FinalPhaseCompleteEventData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameStateTimerCopyWith<$Res> get timer {
  
  return $GameStateTimerCopyWith<$Res>(_self.timer, (value) {
    return _then(_self.copyWith(timer: value));
  });
}
}


/// @nodoc
@JsonSerializable()

class _FinalPhaseCompleteEventData implements FinalPhaseCompleteEventData {
  const _FinalPhaseCompleteEventData({required this.phase, required this.nextPhase, required this.timer});
  factory _FinalPhaseCompleteEventData.fromJson(Map<String, dynamic> json) => _$FinalPhaseCompleteEventDataFromJson(json);

@override final  FinalRoundPhase phase;
@override final  FinalRoundPhase nextPhase;
@override final  GameStateTimer timer;

/// Create a copy of FinalPhaseCompleteEventData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalPhaseCompleteEventDataCopyWith<_FinalPhaseCompleteEventData> get copyWith => __$FinalPhaseCompleteEventDataCopyWithImpl<_FinalPhaseCompleteEventData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalPhaseCompleteEventDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalPhaseCompleteEventData&&(identical(other.phase, phase) || other.phase == phase)&&(identical(other.nextPhase, nextPhase) || other.nextPhase == nextPhase)&&(identical(other.timer, timer) || other.timer == timer));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,phase,nextPhase,timer);

@override
String toString() {
  return 'FinalPhaseCompleteEventData(phase: $phase, nextPhase: $nextPhase, timer: $timer)';
}


}

/// @nodoc
abstract mixin class _$FinalPhaseCompleteEventDataCopyWith<$Res> implements $FinalPhaseCompleteEventDataCopyWith<$Res> {
  factory _$FinalPhaseCompleteEventDataCopyWith(_FinalPhaseCompleteEventData value, $Res Function(_FinalPhaseCompleteEventData) _then) = __$FinalPhaseCompleteEventDataCopyWithImpl;
@override @useResult
$Res call({
 FinalRoundPhase phase, FinalRoundPhase nextPhase, GameStateTimer timer
});


@override $GameStateTimerCopyWith<$Res> get timer;

}
/// @nodoc
class __$FinalPhaseCompleteEventDataCopyWithImpl<$Res>
    implements _$FinalPhaseCompleteEventDataCopyWith<$Res> {
  __$FinalPhaseCompleteEventDataCopyWithImpl(this._self, this._then);

  final _FinalPhaseCompleteEventData _self;
  final $Res Function(_FinalPhaseCompleteEventData) _then;

/// Create a copy of FinalPhaseCompleteEventData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? phase = null,Object? nextPhase = null,Object? timer = null,}) {
  return _then(_FinalPhaseCompleteEventData(
phase: null == phase ? _self.phase : phase // ignore: cast_nullable_to_non_nullable
as FinalRoundPhase,nextPhase: null == nextPhase ? _self.nextPhase : nextPhase // ignore: cast_nullable_to_non_nullable
as FinalRoundPhase,timer: null == timer ? _self.timer : timer // ignore: cast_nullable_to_non_nullable
as GameStateTimer,
  ));
}

/// Create a copy of FinalPhaseCompleteEventData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GameStateTimerCopyWith<$Res> get timer {
  
  return $GameStateTimerCopyWith<$Res>(_self.timer, (value) {
    return _then(_self.copyWith(timer: value));
  });
}
}

// dart format on
