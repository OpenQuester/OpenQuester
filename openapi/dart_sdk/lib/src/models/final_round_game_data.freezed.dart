// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_round_game_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalRoundGameData {

 FinalRoundPhase get phase;/// Turn order for final round theme elimination
 List<int> get turnOrder;/// Player bids mapped by player ID
 Map<String, int> get bids;/// All submitted answers
 List<FinalRoundAnswer> get answers;/// IDs of eliminated themes
 List<int> get eliminatedThemes;
/// Create a copy of FinalRoundGameData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalRoundGameDataCopyWith<FinalRoundGameData> get copyWith => _$FinalRoundGameDataCopyWithImpl<FinalRoundGameData>(this as FinalRoundGameData, _$identity);

  /// Serializes this FinalRoundGameData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalRoundGameData&&(identical(other.phase, phase) || other.phase == phase)&&const DeepCollectionEquality().equals(other.turnOrder, turnOrder)&&const DeepCollectionEquality().equals(other.bids, bids)&&const DeepCollectionEquality().equals(other.answers, answers)&&const DeepCollectionEquality().equals(other.eliminatedThemes, eliminatedThemes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,phase,const DeepCollectionEquality().hash(turnOrder),const DeepCollectionEquality().hash(bids),const DeepCollectionEquality().hash(answers),const DeepCollectionEquality().hash(eliminatedThemes));

@override
String toString() {
  return 'FinalRoundGameData(phase: $phase, turnOrder: $turnOrder, bids: $bids, answers: $answers, eliminatedThemes: $eliminatedThemes)';
}


}

/// @nodoc
abstract mixin class $FinalRoundGameDataCopyWith<$Res>  {
  factory $FinalRoundGameDataCopyWith(FinalRoundGameData value, $Res Function(FinalRoundGameData) _then) = _$FinalRoundGameDataCopyWithImpl;
@useResult
$Res call({
 FinalRoundPhase phase, List<int> turnOrder, Map<String, int> bids, List<FinalRoundAnswer> answers, List<int> eliminatedThemes
});




}
/// @nodoc
class _$FinalRoundGameDataCopyWithImpl<$Res>
    implements $FinalRoundGameDataCopyWith<$Res> {
  _$FinalRoundGameDataCopyWithImpl(this._self, this._then);

  final FinalRoundGameData _self;
  final $Res Function(FinalRoundGameData) _then;

/// Create a copy of FinalRoundGameData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? phase = null,Object? turnOrder = null,Object? bids = null,Object? answers = null,Object? eliminatedThemes = null,}) {
  return _then(_self.copyWith(
phase: null == phase ? _self.phase : phase // ignore: cast_nullable_to_non_nullable
as FinalRoundPhase,turnOrder: null == turnOrder ? _self.turnOrder : turnOrder // ignore: cast_nullable_to_non_nullable
as List<int>,bids: null == bids ? _self.bids : bids // ignore: cast_nullable_to_non_nullable
as Map<String, int>,answers: null == answers ? _self.answers : answers // ignore: cast_nullable_to_non_nullable
as List<FinalRoundAnswer>,eliminatedThemes: null == eliminatedThemes ? _self.eliminatedThemes : eliminatedThemes // ignore: cast_nullable_to_non_nullable
as List<int>,
  ));
}

}


/// @nodoc
@JsonSerializable()

class _FinalRoundGameData implements FinalRoundGameData {
  const _FinalRoundGameData({required this.phase, required final  List<int> turnOrder, required final  Map<String, int> bids, required final  List<FinalRoundAnswer> answers, required final  List<int> eliminatedThemes}): _turnOrder = turnOrder,_bids = bids,_answers = answers,_eliminatedThemes = eliminatedThemes;
  factory _FinalRoundGameData.fromJson(Map<String, dynamic> json) => _$FinalRoundGameDataFromJson(json);

@override final  FinalRoundPhase phase;
/// Turn order for final round theme elimination
 final  List<int> _turnOrder;
/// Turn order for final round theme elimination
@override List<int> get turnOrder {
  if (_turnOrder is EqualUnmodifiableListView) return _turnOrder;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_turnOrder);
}

/// Player bids mapped by player ID
 final  Map<String, int> _bids;
/// Player bids mapped by player ID
@override Map<String, int> get bids {
  if (_bids is EqualUnmodifiableMapView) return _bids;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_bids);
}

/// All submitted answers
 final  List<FinalRoundAnswer> _answers;
/// All submitted answers
@override List<FinalRoundAnswer> get answers {
  if (_answers is EqualUnmodifiableListView) return _answers;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_answers);
}

/// IDs of eliminated themes
 final  List<int> _eliminatedThemes;
/// IDs of eliminated themes
@override List<int> get eliminatedThemes {
  if (_eliminatedThemes is EqualUnmodifiableListView) return _eliminatedThemes;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_eliminatedThemes);
}


/// Create a copy of FinalRoundGameData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalRoundGameDataCopyWith<_FinalRoundGameData> get copyWith => __$FinalRoundGameDataCopyWithImpl<_FinalRoundGameData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalRoundGameDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalRoundGameData&&(identical(other.phase, phase) || other.phase == phase)&&const DeepCollectionEquality().equals(other._turnOrder, _turnOrder)&&const DeepCollectionEquality().equals(other._bids, _bids)&&const DeepCollectionEquality().equals(other._answers, _answers)&&const DeepCollectionEquality().equals(other._eliminatedThemes, _eliminatedThemes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,phase,const DeepCollectionEquality().hash(_turnOrder),const DeepCollectionEquality().hash(_bids),const DeepCollectionEquality().hash(_answers),const DeepCollectionEquality().hash(_eliminatedThemes));

@override
String toString() {
  return 'FinalRoundGameData(phase: $phase, turnOrder: $turnOrder, bids: $bids, answers: $answers, eliminatedThemes: $eliminatedThemes)';
}


}

/// @nodoc
abstract mixin class _$FinalRoundGameDataCopyWith<$Res> implements $FinalRoundGameDataCopyWith<$Res> {
  factory _$FinalRoundGameDataCopyWith(_FinalRoundGameData value, $Res Function(_FinalRoundGameData) _then) = __$FinalRoundGameDataCopyWithImpl;
@override @useResult
$Res call({
 FinalRoundPhase phase, List<int> turnOrder, Map<String, int> bids, List<FinalRoundAnswer> answers, List<int> eliminatedThemes
});




}
/// @nodoc
class __$FinalRoundGameDataCopyWithImpl<$Res>
    implements _$FinalRoundGameDataCopyWith<$Res> {
  __$FinalRoundGameDataCopyWithImpl(this._self, this._then);

  final _FinalRoundGameData _self;
  final $Res Function(_FinalRoundGameData) _then;

/// Create a copy of FinalRoundGameData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? phase = null,Object? turnOrder = null,Object? bids = null,Object? answers = null,Object? eliminatedThemes = null,}) {
  return _then(_FinalRoundGameData(
phase: null == phase ? _self.phase : phase // ignore: cast_nullable_to_non_nullable
as FinalRoundPhase,turnOrder: null == turnOrder ? _self._turnOrder : turnOrder // ignore: cast_nullable_to_non_nullable
as List<int>,bids: null == bids ? _self._bids : bids // ignore: cast_nullable_to_non_nullable
as Map<String, int>,answers: null == answers ? _self._answers : answers // ignore: cast_nullable_to_non_nullable
as List<FinalRoundAnswer>,eliminatedThemes: null == eliminatedThemes ? _self._eliminatedThemes : eliminatedThemes // ignore: cast_nullable_to_non_nullable
as List<int>,
  ));
}


}

// dart format on
