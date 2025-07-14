// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_auto_loss_event_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalAutoLossEventData {

/// ID of the player who lost
 int get playerId; FinalAnswerLossReason get reason;
/// Create a copy of FinalAutoLossEventData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalAutoLossEventDataCopyWith<FinalAutoLossEventData> get copyWith => _$FinalAutoLossEventDataCopyWithImpl<FinalAutoLossEventData>(this as FinalAutoLossEventData, _$identity);

  /// Serializes this FinalAutoLossEventData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalAutoLossEventData&&(identical(other.playerId, playerId) || other.playerId == playerId)&&(identical(other.reason, reason) || other.reason == reason));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,playerId,reason);

@override
String toString() {
  return 'FinalAutoLossEventData(playerId: $playerId, reason: $reason)';
}


}

/// @nodoc
abstract mixin class $FinalAutoLossEventDataCopyWith<$Res>  {
  factory $FinalAutoLossEventDataCopyWith(FinalAutoLossEventData value, $Res Function(FinalAutoLossEventData) _then) = _$FinalAutoLossEventDataCopyWithImpl;
@useResult
$Res call({
 int playerId, FinalAnswerLossReason reason
});




}
/// @nodoc
class _$FinalAutoLossEventDataCopyWithImpl<$Res>
    implements $FinalAutoLossEventDataCopyWith<$Res> {
  _$FinalAutoLossEventDataCopyWithImpl(this._self, this._then);

  final FinalAutoLossEventData _self;
  final $Res Function(FinalAutoLossEventData) _then;

/// Create a copy of FinalAutoLossEventData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? playerId = null,Object? reason = null,}) {
  return _then(_self.copyWith(
playerId: null == playerId ? _self.playerId : playerId // ignore: cast_nullable_to_non_nullable
as int,reason: null == reason ? _self.reason : reason // ignore: cast_nullable_to_non_nullable
as FinalAnswerLossReason,
  ));
}

}


/// @nodoc
@JsonSerializable()

class _FinalAutoLossEventData implements FinalAutoLossEventData {
  const _FinalAutoLossEventData({required this.playerId, required this.reason});
  factory _FinalAutoLossEventData.fromJson(Map<String, dynamic> json) => _$FinalAutoLossEventDataFromJson(json);

/// ID of the player who lost
@override final  int playerId;
@override final  FinalAnswerLossReason reason;

/// Create a copy of FinalAutoLossEventData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalAutoLossEventDataCopyWith<_FinalAutoLossEventData> get copyWith => __$FinalAutoLossEventDataCopyWithImpl<_FinalAutoLossEventData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalAutoLossEventDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalAutoLossEventData&&(identical(other.playerId, playerId) || other.playerId == playerId)&&(identical(other.reason, reason) || other.reason == reason));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,playerId,reason);

@override
String toString() {
  return 'FinalAutoLossEventData(playerId: $playerId, reason: $reason)';
}


}

/// @nodoc
abstract mixin class _$FinalAutoLossEventDataCopyWith<$Res> implements $FinalAutoLossEventDataCopyWith<$Res> {
  factory _$FinalAutoLossEventDataCopyWith(_FinalAutoLossEventData value, $Res Function(_FinalAutoLossEventData) _then) = __$FinalAutoLossEventDataCopyWithImpl;
@override @useResult
$Res call({
 int playerId, FinalAnswerLossReason reason
});




}
/// @nodoc
class __$FinalAutoLossEventDataCopyWithImpl<$Res>
    implements _$FinalAutoLossEventDataCopyWith<$Res> {
  __$FinalAutoLossEventDataCopyWithImpl(this._self, this._then);

  final _FinalAutoLossEventData _self;
  final $Res Function(_FinalAutoLossEventData) _then;

/// Create a copy of FinalAutoLossEventData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? playerId = null,Object? reason = null,}) {
  return _then(_FinalAutoLossEventData(
playerId: null == playerId ? _self.playerId : playerId // ignore: cast_nullable_to_non_nullable
as int,reason: null == reason ? _self.reason : reason // ignore: cast_nullable_to_non_nullable
as FinalAnswerLossReason,
  ));
}


}

// dart format on
