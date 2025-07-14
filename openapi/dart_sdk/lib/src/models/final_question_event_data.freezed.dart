// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_question_event_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalQuestionEventData {

 FinalRoundQuestionData get questionData;
/// Create a copy of FinalQuestionEventData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalQuestionEventDataCopyWith<FinalQuestionEventData> get copyWith => _$FinalQuestionEventDataCopyWithImpl<FinalQuestionEventData>(this as FinalQuestionEventData, _$identity);

  /// Serializes this FinalQuestionEventData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalQuestionEventData&&(identical(other.questionData, questionData) || other.questionData == questionData));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,questionData);

@override
String toString() {
  return 'FinalQuestionEventData(questionData: $questionData)';
}


}

/// @nodoc
abstract mixin class $FinalQuestionEventDataCopyWith<$Res>  {
  factory $FinalQuestionEventDataCopyWith(FinalQuestionEventData value, $Res Function(FinalQuestionEventData) _then) = _$FinalQuestionEventDataCopyWithImpl;
@useResult
$Res call({
 FinalRoundQuestionData questionData
});


$FinalRoundQuestionDataCopyWith<$Res> get questionData;

}
/// @nodoc
class _$FinalQuestionEventDataCopyWithImpl<$Res>
    implements $FinalQuestionEventDataCopyWith<$Res> {
  _$FinalQuestionEventDataCopyWithImpl(this._self, this._then);

  final FinalQuestionEventData _self;
  final $Res Function(FinalQuestionEventData) _then;

/// Create a copy of FinalQuestionEventData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? questionData = null,}) {
  return _then(_self.copyWith(
questionData: null == questionData ? _self.questionData : questionData // ignore: cast_nullable_to_non_nullable
as FinalRoundQuestionData,
  ));
}
/// Create a copy of FinalQuestionEventData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FinalRoundQuestionDataCopyWith<$Res> get questionData {
  
  return $FinalRoundQuestionDataCopyWith<$Res>(_self.questionData, (value) {
    return _then(_self.copyWith(questionData: value));
  });
}
}


/// @nodoc
@JsonSerializable()

class _FinalQuestionEventData implements FinalQuestionEventData {
  const _FinalQuestionEventData({required this.questionData});
  factory _FinalQuestionEventData.fromJson(Map<String, dynamic> json) => _$FinalQuestionEventDataFromJson(json);

@override final  FinalRoundQuestionData questionData;

/// Create a copy of FinalQuestionEventData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalQuestionEventDataCopyWith<_FinalQuestionEventData> get copyWith => __$FinalQuestionEventDataCopyWithImpl<_FinalQuestionEventData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalQuestionEventDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalQuestionEventData&&(identical(other.questionData, questionData) || other.questionData == questionData));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,questionData);

@override
String toString() {
  return 'FinalQuestionEventData(questionData: $questionData)';
}


}

/// @nodoc
abstract mixin class _$FinalQuestionEventDataCopyWith<$Res> implements $FinalQuestionEventDataCopyWith<$Res> {
  factory _$FinalQuestionEventDataCopyWith(_FinalQuestionEventData value, $Res Function(_FinalQuestionEventData) _then) = __$FinalQuestionEventDataCopyWithImpl;
@override @useResult
$Res call({
 FinalRoundQuestionData questionData
});


@override $FinalRoundQuestionDataCopyWith<$Res> get questionData;

}
/// @nodoc
class __$FinalQuestionEventDataCopyWithImpl<$Res>
    implements _$FinalQuestionEventDataCopyWith<$Res> {
  __$FinalQuestionEventDataCopyWithImpl(this._self, this._then);

  final _FinalQuestionEventData _self;
  final $Res Function(_FinalQuestionEventData) _then;

/// Create a copy of FinalQuestionEventData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? questionData = null,}) {
  return _then(_FinalQuestionEventData(
questionData: null == questionData ? _self.questionData : questionData // ignore: cast_nullable_to_non_nullable
as FinalRoundQuestionData,
  ));
}

/// Create a copy of FinalQuestionEventData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FinalRoundQuestionDataCopyWith<$Res> get questionData {
  
  return $FinalRoundQuestionDataCopyWith<$Res>(_self.questionData, (value) {
    return _then(_self.copyWith(questionData: value));
  });
}
}

// dart format on
